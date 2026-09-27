import {
  GENESIS_PREV,
  attestBlock,
  sealBlock,
  voterCommitment,
  buildTransaction,
  type ChainBlock,
  type VoteTx,
} from "@/lib/chain";
import { ELECTION_META } from "@/lib/election-data";
import { getSql } from "@/lib/db";

async function insertBlock(sql: Awaited<ReturnType<typeof getSql>>, block: ChainBlock) {
  const bft = await attestBlock(block.hash);
  await sql`
    insert into chain_blocks (
      block_index, timestamp_ms, previous_hash, merkle_root, hash, nonce, payload
    ) values (
      ${block.index}, ${block.timestamp}, ${block.previousHash},
      ${block.merkleRoot}, ${block.hash}, ${block.nonce},
      ${JSON.stringify({ transactions: block.transactions, bft })}::jsonb
    )
    on conflict (block_index) do nothing
  `;
  return bft;
}

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded() {
  seedPromise ??= (async () => {
    const sql = await getSql();
    const { CLASS_ROLL, PRECAST_BALLOTS } = await import("./class-roll.server");

    await sql`
      insert into elections (
        id, title, department, session_label, reference_code, status, opens_at, closes_at
      ) values (
        ${ELECTION_META.id},
        ${ELECTION_META.title},
        ${ELECTION_META.department},
        ${ELECTION_META.sessionLabel},
        ${ELECTION_META.referenceCode},
        ${"open"},
        ${ELECTION_META.opensAt},
        ${ELECTION_META.closesAt}
      )
      on conflict (id) do nothing
    `;

    const roll = await Promise.all(
      CLASS_ROLL.map(async (cred) => ({
        commitment: await voterCommitment(cred.studentId, cred.pin),
      })),
    );
    if (roll.length > 0) {
      const placeholders = roll.map((_, i) => `($${i + 1})`).join(",");
      await sql.query(
        `insert into eligible_voters (commitment) values ${placeholders} on conflict (commitment) do nothing`,
        roll.map((r) => r.commitment),
      );
    }

    const existing = await sql<{ c: number }>`select count(*)::int as c from chain_blocks`;
    if ((existing[0]?.c ?? 0) > 0) return;

    const genesis = await sealBlock({
      index: 0,
      previousHash: GENESIS_PREV,
      transactions: [],
      timestamp: Date.parse(ELECTION_META.opensAt),
    });
    await insertBlock(sql, genesis);

    let prev = genesis.hash;
    let index = 1;
    for (const ballot of PRECAST_BALLOTS) {
      const commitment = await voterCommitment(ballot.studentId, ballot.pin);
      const txs: VoteTx[] = [];
      for (const [positionId, candidateId] of Object.entries(ballot.picks)) {
        txs.push(await buildTransaction(commitment, positionId, candidateId, Date.now() + index));
      }
      const block = await sealBlock({ index, previousHash: prev, transactions: txs });
      await insertBlock(sql, block);
      for (const vote of txs) {
        await sql`
          insert into vote_receipts (voter_commitment, position_id, candidate_id, block_hash)
          values (${vote.voterCommitment}, ${vote.positionId}, ${vote.candidateId}, ${block.hash})
          on conflict (voter_commitment, position_id) do nothing
        `;
      }
      prev = block.hash;
      index += 1;
    }
  })().catch((err) => {
    seedPromise = null;
    throw err;
  });
  await seedPromise;
}

export { insertBlock };
