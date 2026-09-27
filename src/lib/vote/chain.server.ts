import { getSql } from "@/lib/db";
import { CANDIDATES, ELECTION_ID, OFFICES } from "./catalog";
import {
  computeBlockHash,
  merkleRoot,
  newId,
  sha256Hex,
} from "./crypto.server";
import type { BoothSession } from "./session.server";

export type ChainBlock = {
  index: number;
  prevHash: string;
  merkleRoot: string;
  blockHash: string;
  ballotCount: number;
  createdAt: string;
};

export type LedgerBallot = {
  id: string;
  officeId: string;
  candidateId: string;
  ballotHash: string;
  createdAt: string;
};

export async function getChain(): Promise<{
  blocks: ChainBlock[];
  valid: boolean;
  ballotCount: number;
}> {
  const sql = await getSql();
  const blocks = await sql<ChainBlock>`
    select block_index as "index",
           prev_hash as "prevHash",
           merkle_root as "merkleRoot",
           block_hash as "blockHash",
           ballot_count as "ballotCount",
           created_at as "createdAt"
    from chain_blocks
    where election_id = ${ELECTION_ID}
    order by block_index asc
  `;

  let valid = true;
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!;
    const expected = computeBlockHash({
      index: Number(block.index),
      prevHash: block.prevHash,
      merkleRoot: block.merkleRoot,
      ballotCount: Number(block.ballotCount),
    });
    if (expected !== block.blockHash) valid = false;
    if (i > 0 && block.prevHash !== blocks[i - 1]!.blockHash) valid = false;
    if (i === 0 && Number(block.index) !== 0) valid = false;
  }

  const countRows = await sql<{ n: number }>`
    select count(*)::int as n from ballots where election_id = ${ELECTION_ID}
  `;

  return {
    blocks,
    valid,
    ballotCount: countRows[0]?.n ?? 0,
  };
}

export async function getRecentBallots(limit = 24): Promise<LedgerBallot[]> {
  const sql = await getSql();
  return sql<LedgerBallot>`
    select id, office_id as "officeId", candidate_id as "candidateId",
           ballot_hash as "ballotHash", created_at as "createdAt"
    from ballots
    where election_id = ${ELECTION_ID}
    order by created_at desc
    limit ${limit}
  `;
}

export async function getTallies(): Promise<
  Array<{ candidateId: string; officeId: string; votes: number }>
> {
  const sql = await getSql();
  return sql<{ candidateId: string; officeId: string; votes: number }>`
    select candidate_id as "candidateId",
           office_id as "officeId",
           count(*)::int as votes
    from ballots
    where election_id = ${ELECTION_ID}
    group by candidate_id, office_id
  `;
}

export async function hasVoted(emailHash: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n
    from voter_receipts
    where election_id = ${ELECTION_ID} and email_hash = ${emailHash}
  `;
  return (rows[0]?.n ?? 0) > 0;
}

export async function getReceipt(emailHash: string) {
  const sql = await getSql();
  const rows = await sql<{
    receiptHash: string;
    blockHash: string;
    castAt: string;
  }>`
    select receipt_hash as "receiptHash",
           block_hash as "blockHash",
           cast_at as "castAt"
    from voter_receipts
    where election_id = ${ELECTION_ID} and email_hash = ${emailHash}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function appendBallot(input: {
  session: BoothSession;
  choices: Record<string, string>;
}): Promise<{ receiptHash: string; blockHash: string; blockIndex: number }> {
  const sql = await getSql();
  if (await hasVoted(input.session.emailHash)) {
    throw new Error("This roll number has already cast a ballot.");
  }

  const officeIds = OFFICES.map((o) => o.id);
  for (const officeId of officeIds) {
    const candidateId = input.choices[officeId];
    if (!candidateId) {
      throw new Error("Select a candidate for every office before sealing.");
    }
    const ok = CANDIDATES.some(
      (c) => c.id === candidateId && c.officeId === officeId,
    );
    if (!ok) throw new Error("A selected candidate is not on this ballot.");
  }

  const head = await sql<{
    blockHash: string;
    index: number;
  }>`
    select block_hash as "blockHash", block_index as "index"
    from chain_blocks
    where election_id = ${ELECTION_ID}
    order by block_index desc
    limit 1
  `;
  const prev = head[0];
  if (!prev) throw new Error("Genesis block missing.");

  const ballots = officeIds.map((officeId) => {
    const candidateId = input.choices[officeId]!;
    const salt = newId();
    const ballotHash = sha256Hex(
      `ballot|${ELECTION_ID}|${officeId}|${candidateId}|${salt}`,
    );
    return {
      id: newId(),
      officeId,
      candidateId,
      salt,
      ballotHash,
    };
  });

  const root = merkleRoot(ballots.map((b) => b.ballotHash));
  const nextIndex = Number(prev.index) + 1;
  const blockHash = computeBlockHash({
    index: nextIndex,
    prevHash: prev.blockHash,
    merkleRoot: root,
    ballotCount: ballots.length,
  });
  const blockId = newId();
  const receiptHash = sha256Hex(
    `receipt|${input.session.emailHash}|${blockHash}|${root}`,
  );

  await sql`
    insert into chain_blocks (
      id, election_id, block_index, prev_hash, merkle_root, block_hash, ballot_count
    ) values (
      ${blockId},
      ${ELECTION_ID},
      ${nextIndex},
      ${prev.blockHash},
      ${root},
      ${blockHash},
      ${ballots.length}
    )
  `;

  for (const ballot of ballots) {
    await sql`
      insert into ballots (
        id, election_id, block_id, office_id, candidate_id, ballot_hash, salt
      ) values (
        ${ballot.id},
        ${ELECTION_ID},
        ${blockId},
        ${ballot.officeId},
        ${ballot.candidateId},
        ${ballot.ballotHash},
        ${ballot.salt}
      )
    `;
  }

  await sql`
    insert into voter_receipts (
      election_id, email_hash, receipt_hash, block_hash, queued
    ) values (
      ${ELECTION_ID},
      ${input.session.emailHash},
      ${receiptHash},
      ${blockHash},
      false
    )
  `;

  return { receiptHash, blockHash, blockIndex: nextIndex };
}
