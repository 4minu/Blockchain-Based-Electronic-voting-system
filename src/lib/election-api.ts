import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  BFT_FAULT_TOLERANCE,
  BFT_QUORUM,
  GENESIS_PREV,
  VALIDATORS,
  attestBlock,
  buildTransaction,
  sealBlock,
  type BftCertificate,
  type ChainBlock,
  type VoteTx,
} from "@/lib/chain";
import { CANDIDATES, ELECTION_ID, POSITIONS } from "@/lib/election-data";
import type { BoothUnlock, CastResult, ElectionSnapshot, TallyRow } from "@/lib/election-types";
import { getSql } from "@/lib/db";

type BlockRow = {
  block_index: number;
  timestamp_ms: number;
  previous_hash: string;
  merkle_root: string;
  hash: string;
  nonce: number;
  payload: unknown;
};

function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function parsePayload(payload: unknown): { transactions: VoteTx[]; bft?: BftCertificate } {
  const raw = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (Array.isArray(raw)) return { transactions: raw as VoteTx[] };
  if (raw && typeof raw === "object" && "transactions" in (raw as object)) {
    return raw as { transactions: VoteTx[]; bft?: BftCertificate };
  }
  return { transactions: [] };
}

async function rowToBlock(row: BlockRow): Promise<ChainBlock & { bft: BftCertificate }> {
  const parsed = parsePayload(row.payload);
  return {
    index: Number(row.block_index),
    timestamp: Number(row.timestamp_ms),
    previousHash: row.previous_hash,
    merkleRoot: row.merkle_root,
    hash: row.hash,
    nonce: Number(row.nonce),
    transactions: parsed.transactions,
    bft: parsed.bft ?? (await attestBlock(row.hash)),
  };
}

async function seed() {
  const { ensureSeeded } = await import("@/lib/election-seed.server");
  await ensureSeeded();
}

export const getElectionSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<ElectionSnapshot> => {
    await seed();
    const sql = await getSql();
    const elections = await sql<{
      id: string;
      title: string;
      department: string;
      session_label: string;
      reference_code: string;
      status: "open" | "closed";
      opens_at: string | Date;
      closes_at: string | Date;
    }>`select * from elections where id = ${ELECTION_ID}`;
    const electionRow = elections[0]!;
    const blocks = await sql<{ c: number }>`select count(*)::int as c from chain_blocks`;
    const ballots = await sql<{ c: number }>`
      select count(distinct voter_commitment)::int as c from vote_receipts
    `;
    const head = await sql<{ hash: string }>`
      select hash from chain_blocks order by block_index desc limit 1
    `;
    const eligible = await sql<{ commitment: string }>`select commitment from eligible_voters`;
    const tallies = await sql<TallyRow>`
      select position_id as "positionId", candidate_id as "candidateId", count(*)::int as votes
      from vote_receipts
      group by position_id, candidate_id
    `;
    return {
      election: {
        id: electionRow.id,
        title: electionRow.title,
        department: electionRow.department,
        sessionLabel: electionRow.session_label,
        referenceCode: electionRow.reference_code,
        status: electionRow.status,
        opensAt: asIso(electionRow.opens_at),
        closesAt: asIso(electionRow.closes_at),
      },
      positions: POSITIONS,
      candidates: CANDIDATES,
      blockCount: blocks[0]?.c ?? 0,
      ballotCount: ballots[0]?.c ?? 0,
      headHash: head[0]?.hash ?? "",
      eligibleCommitments: eligible.map((r) => r.commitment),
      tallies,
      bft: {
        validators: VALIDATORS.map((v) => ({ id: v.id, name: v.name })),
        faultTolerance: BFT_FAULT_TOLERANCE,
        quorum: BFT_QUORUM,
      },
    };
  },
);

export const getChainBlocks = createServerFn({ method: "GET" }).handler(async () => {
  await seed();
  const sql = await getSql();
  const rows = await sql<BlockRow>`
    select block_index, timestamp_ms, previous_hash, merkle_root, hash, nonce, payload
    from chain_blocks
    order by block_index asc
  `;
  const blocks = [];
  for (const row of rows) blocks.push(await rowToBlock(row));
  return { blocks };
});

export const unlockBooth = createServerFn({ method: "POST" })
  .validator(z.object({ commitment: z.string().min(16) }))
  .handler(async ({ data }): Promise<BoothUnlock> => {
    await seed();
    const sql = await getSql();
    const election = await sql<{ status: "open" | "closed" }>`
      select status from elections where id = ${ELECTION_ID}
    `;
    const eligible = await sql`select 1 from eligible_voters where commitment = ${data.commitment}`;
    const voted = await sql<{ position_id: string }>`
      select position_id from vote_receipts where voter_commitment = ${data.commitment}
    `;
    return {
      eligible: eligible.length > 0,
      votedPositionIds: voted.map((row) => row.position_id),
      status: election[0]?.status ?? "closed",
    };
  });

const selectionSchema = z.object({
  positionId: z.string().min(1),
  candidateId: z.string().min(1),
});

export const castBallot = createServerFn({ method: "POST" })
  .validator(
    z.object({
      sessionToken: z.string().min(20),
      selections: z.array(selectionSchema).min(1),
    }),
  )
  .handler(async ({ data }): Promise<CastResult> => {
    await seed();
    const { lookupVoterSession } = await import("@/lib/voter-session.server");
    const { insertBlock } = await import("@/lib/election-seed.server");
    const session = await lookupVoterSession(data.sessionToken);
    if (!session) {
      return {
        ok: false,
        code: "invalid",
        message: "Your session expired. Sign in once while online to keep voting on this device.",
      };
    }
    const commitment = session.commitment;
    const sql = await getSql();
    const election = await sql<{ status: string }>`select status from elections where id = ${ELECTION_ID}`;
    if (election[0]?.status !== "open") {
      return { ok: false, code: "closed", message: "Polls are closed." };
    }
    const eligible = await sql`select 1 from eligible_voters where commitment = ${commitment}`;
    if (eligible.length === 0) {
      return { ok: false, code: "ineligible", message: "This commitment is not on the roll." };
    }

    const already = await sql<{ position_id: string }>`
      select position_id from vote_receipts where voter_commitment = ${commitment}
    `;
    const voted = new Set(already.map((r) => r.position_id));
    const fresh = data.selections.filter((s) => !voted.has(s.positionId));
    if (fresh.length === 0) {
      return {
        ok: false,
        code: "duplicate",
        message: "This roll already has a sealed ballot for those offices.",
      };
    }

    const head = await sql<{ hash: string; block_index: number }>`
      select hash, block_index from chain_blocks order by block_index desc limit 1
    `;
    const txs: VoteTx[] = [];
    for (const pick of fresh) {
      const candidate = CANDIDATES.find(
        (c) => c.id === pick.candidateId && c.positionId === pick.positionId,
      );
      if (!candidate) {
        return { ok: false, code: "invalid", message: "A selection does not match the published slate." };
      }
      txs.push(await buildTransaction(commitment, pick.positionId, pick.candidateId));
    }
    const block = await sealBlock({
      index: Number(head[0]?.block_index ?? 0) + 1,
      previousHash: head[0]?.hash ?? GENESIS_PREV,
      transactions: txs,
    });
    const bft = await insertBlock(sql, block);
    for (const vote of txs) {
      await sql`
        insert into vote_receipts (voter_commitment, position_id, candidate_id, block_hash)
        values (${vote.voterCommitment}, ${vote.positionId}, ${vote.candidateId}, ${block.hash})
        on conflict (voter_commitment, position_id) do nothing
      `;
    }
    const allVoted = await sql<{ position_id: string }>`
      select position_id from vote_receipts where voter_commitment = ${commitment}
    `;
    return {
      ok: true,
      receiptHash: block.hash,
      blockHash: block.hash,
      blockIndex: block.index,
      merkleRoot: block.merkleRoot,
      votedPositionIds: allVoted.map((r) => r.position_id),
      bft,
    };
  });
