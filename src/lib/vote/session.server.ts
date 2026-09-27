import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { emailHash, newId, sessionToken, sha256Hex } from "./crypto.server";
import { VOTERS, type VoterRecord } from "./roll.server";
import { maskEmail } from "@/lib/utils";

export const SESSION_COOKIE = "soe_booth";

export type BoothSession = {
  givenName: string;
  maskedEmail: string;
  emailHash: string;
};

function normalizeEmail(value: string) {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, "");
  if (!trimmed) return "";
  if (!trimmed.includes("@")) return `${trimmed}@futo.edu.ng`;
  return trimmed;
}

function normalizeReg(value: string) {
  return value.replace(/[\s-]/g, "");
}

function localPart(email: string) {
  return email.split("@")[0] ?? email;
}

function localWithoutReg(email: string, reg: string) {
  const local = localPart(email).toLowerCase();
  return local.replace(new RegExp(`\\.?${reg}$`), "");
}

export function lookupVoter(email: string, reg: string): VoterRecord | null {
  const e = normalizeEmail(email);
  const r = normalizeReg(reg);
  if (!e.endsWith("@futo.edu.ng") || r.length < 6) return null;

  const exact = VOTERS.find((v) => v.email.toLowerCase() === e && v.reg === r);
  if (exact) return exact;

  const typedLocal = localPart(e);
  const byReg = VOTERS.filter((v) => v.reg === r);
  for (const voter of byReg) {
    const vEmail = voter.email.toLowerCase();
    const vLocal = localPart(vEmail);
    const vBase = localWithoutReg(vEmail, voter.reg);
    if (
      typedLocal === vLocal ||
      typedLocal === vBase ||
      typedLocal === `${vBase}.${voter.reg}` ||
      e === vEmail
    ) {
      return voter;
    }
  }

  const byEmail = VOTERS.find((v) => {
    const vEmail = v.email.toLowerCase();
    const vLocal = localPart(vEmail);
    const vBase = localWithoutReg(vEmail, v.reg);
    return e === vEmail || typedLocal === vLocal || typedLocal === vBase;
  });
  if (byEmail && byEmail.reg === r) return byEmail;
  return null;
}

export function lookupVoterByEmail(email: string): VoterRecord | null {
  const e = normalizeEmail(email);
  const exact = VOTERS.find((v) => v.email.toLowerCase() === e);
  if (exact) return exact;
  const typedLocal = localPart(e);
  const matches = VOTERS.filter((v) => {
    const vEmail = v.email.toLowerCase();
    const vLocal = localPart(vEmail);
    const vBase = localWithoutReg(vEmail, v.reg);
    return typedLocal === vLocal || typedLocal === vBase || typedLocal === `${vBase}.${v.reg}`;
  });
  return matches.length === 1 ? matches[0]! : null;
}

export function givenNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "Student";
}

export function lastSixOfReg(reg: string): string {
  const digits = normalizeReg(reg).replace(/\D/g, "");
  return digits.slice(-6).padStart(6, "0");
}

function cookieSecure(): boolean {
  try {
    const req = getRequest();
    const forwarded = req.headers.get("x-forwarded-proto") ?? "";
    if (forwarded.includes("https")) return true;
    if (req.url.startsWith("https://")) return true;
  } catch {
    /* request context missing */
  }
  return process.env.NODE_ENV === "production";
}

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: cookieSecure(),
  };
}

export async function readSession(): Promise<BoothSession | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const sql = await getSql();
  const rows = await sql<BoothSession & { expires_at: string }>`
    select given_name as "givenName",
           masked_email as "maskedEmail",
           email_hash as "emailHash",
           expires_at
    from voter_sessions
    where token_hash = ${sha256Hex(token)}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sql`delete from voter_sessions where token_hash = ${sha256Hex(token)}`;
    return null;
  }
  return {
    givenName: row.givenName,
    maskedEmail: row.maskedEmail,
    emailHash: row.emailHash,
  };
}

export async function requireSession(): Promise<BoothSession> {
  const session = await readSession();
  if (!session) {
    throw new Error("Your booth session expired. Sign in again.");
  }
  return session;
}

export async function issueSession(voter: VoterRecord): Promise<void> {
  const sql = await getSql();
  const token = sessionToken();
  const hash = sha256Hex(token);
  const id = newId();
  const email = emailHash(voter.email);
  await sql`delete from voter_sessions where email_hash = ${email}`;
  await sql`
    insert into voter_sessions (
      id, token_hash, email_hash, given_name, masked_email, expires_at
    ) values (
      ${id},
      ${hash},
      ${email},
      ${givenNameOf(voter.name)},
      ${maskEmail(voter.email)},
      now() + interval '12 hours'
    )
  `;
  setCookie(SESSION_COOKIE, token, sessionCookieOptions(60 * 60 * 12));
}

export async function clearSession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    const sql = await getSql();
    await sql`delete from voter_sessions where token_hash = ${sha256Hex(token)}`;
  }
  setCookie(SESSION_COOKIE, "", sessionCookieOptions(0));
}
