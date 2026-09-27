import { sha256Hex, voterCommitment } from "@/lib/chain";
import { getSql } from "@/lib/db";
import type { ElectionStatus } from "@/lib/election-types";

export type RollMatch = { studentId: string; pin: string; commitment: string };

export type LiveSession = {
  commitment: string;
  maskedEmail: string;
  expiresAt: number;
};

export type OpenedBooth = LiveSession & {
  token: string;
  votedPositionIds: string[];
  electionStatus: ElectionStatus;
};

function randomHex(bytes: number) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomOtp() {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const n = new DataView(buf.buffer).getUint32(0) % 1_000_000;
  return String(n).padStart(6, "0");
}

export function randomToken(bytes = 32) {
  return randomHex(bytes);
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  if (local.length <= 3) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-2)}@${domain}`;
}

export function normalizeEmail(raw: string) {
  const e = raw.trim().toLowerCase();
  if (!e) return e;
  if (!e.includes("@")) return `${e}@futo.edu.ng`;
  return e;
}

export function normalizeReg(raw: string) {
  return raw.trim().replace(/[\s\-/]/g, "");
}

export async function matchRoll(email: string, pin: string): Promise<RollMatch | null> {
  const { CLASS_ROLL } = await import("./class-roll.server");
  const e = normalizeEmail(email);
  const p = normalizeReg(pin);
  const row = CLASS_ROLL.find(
    (r) => r.studentId.toLowerCase() === e && r.pin === p,
  );
  if (!row) return null;
  const commitment = await voterCommitment(row.studentId, row.pin);
  return { studentId: row.studentId, pin: row.pin, commitment };
}

export async function lookupVoterSession(token: string): Promise<LiveSession | null> {
  if (!token || token.length < 20) return null;
  const sql = await getSql();
  const tokenHash = await sha256Hex(token);
  const rows = await sql<{
    commitment: string;
    masked_email: string;
    expires_at: string | Date;
  }>`
    select commitment, masked_email, expires_at
    from voter_sessions
    where token_hash = ${tokenHash}
  `;
  const row = rows[0];
  if (!row) return null;
  const expiresAt = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return {
    commitment: row.commitment,
    maskedEmail: row.masked_email,
    expiresAt,
  };
}

export async function insertVoterSession(input: {
  token: string;
  commitment: string;
  maskedEmail: string;
  ttlMs?: number;
}): Promise<LiveSession> {
  const sql = await getSql();
  const tokenHash = await sha256Hex(input.token);
  const expiresAt = Date.now() + (input.ttlMs ?? 12 * 60 * 60 * 1000);
  await sql`
    insert into voter_sessions (token_hash, commitment, masked_email, expires_at)
    values (
      ${tokenHash},
      ${input.commitment},
      ${input.maskedEmail},
      ${new Date(expiresAt).toISOString()}
    )
  `;
  return {
    commitment: input.commitment,
    maskedEmail: input.maskedEmail,
    expiresAt,
  };
}

export async function openBoothSession(match: RollMatch): Promise<OpenedBooth> {
  const token = randomToken(32);
  const masked = maskEmail(match.studentId);
  const session = await insertVoterSession({
    token,
    commitment: match.commitment,
    maskedEmail: masked,
    ttlMs: 30 * 24 * 60 * 60 * 1000,
  });
  const sql = await getSql();
  const voted = await sql<{ position_id: string }>`
    select position_id from vote_receipts where voter_commitment = ${match.commitment}
  `;
  const election = await sql<{ status: ElectionStatus }>`
    select status from elections where id = ${"soe-2025-2026"}
  `;
  return {
    token,
    commitment: session.commitment,
    maskedEmail: session.maskedEmail,
    expiresAt: session.expiresAt,
    votedPositionIds: voted.map((row) => row.position_id),
    electionStatus: election[0]?.status ?? "closed",
  };
}

export async function revokeVoterSession(token: string) {
  const sql = await getSql();
  const tokenHash = await sha256Hex(token);
  await sql`delete from voter_sessions where token_hash = ${tokenHash}`;
}
