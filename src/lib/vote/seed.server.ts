import { getSql } from "@/lib/db";
import { CANDIDATES, ELECTION, ELECTION_ID, OFFICES } from "./catalog";
import { computeBlockHash, merkleRoot, newId, sha256Hex } from "./crypto.server";

export async function ensureElection(): Promise<void> {
  const g = globalThis as typeof globalThis & { __soeSeedV3__?: Promise<void> };
  if (!g.__soeSeedV3__) {
    g.__soeSeedV3__ = seed().catch((err) => {
      g.__soeSeedV3__ = undefined;
      throw err;
    });
  }
  await g.__soeSeedV3__;
}

async function seed() {
  const sql = await getSql();
  await sql
    .query(
      "alter table otp_challenges add column if not exists channel text not null default 'outlook'",
    )
    .catch(() => undefined);

  const existing = await sql<{ id: string }>`
    select id from elections where id = ${ELECTION_ID}
  `;
  if (existing.length === 0) {
    await sql`
      insert into elections (id, title, session_label, status)
      values (${ELECTION.id}, ${ELECTION.title}, ${ELECTION.session}, 'open')
    `;
  }

  for (const office of OFFICES) {
    await sql`
      insert into offices (id, election_id, title, sort_order)
      values (${office.id}, ${ELECTION_ID}, ${office.title}, ${office.sortOrder})
      on conflict (id) do nothing
    `;
  }

  for (const candidate of CANDIDATES) {
    const parts = candidate.fullName.split(/\s+/).filter(Boolean);
    const initials = (
      (parts[0]?.[0] ?? "S") + (parts[parts.length - 1]?.[0] ?? "E")
    ).toUpperCase();
    await sql`
      insert into candidates (id, office_id, full_name, manifesto, initials, sort_order)
      values (
        ${candidate.id},
        ${candidate.officeId},
        ${candidate.fullName},
        ${candidate.manifesto},
        ${initials},
        ${candidate.sortOrder}
      )
      on conflict (id) do nothing
    `;
  }

  const genesis = await sql<{ id: string }>`
    select id from chain_blocks
    where election_id = ${ELECTION_ID} and block_index = 0
  `;
  if (genesis.length === 0) {
    const prevHash = "0".repeat(64);
    const root = merkleRoot([sha256Hex("SOE-CHAINVOTE-GENESIS-2025-2026")]);
    const blockHash = computeBlockHash({
      index: 0,
      prevHash,
      merkleRoot: root,
      ballotCount: 0,
    });
    await sql`
      insert into chain_blocks (
        id, election_id, block_index, prev_hash, merkle_root, block_hash, ballot_count
      ) values (
        ${newId()},
        ${ELECTION_ID},
        0,
        ${prevHash},
        ${root},
        ${blockHash},
        0
      )
    `;
  }
}
