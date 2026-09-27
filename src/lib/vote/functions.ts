import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { maskEmail } from "@/lib/utils";
import { CANDIDATES, ELECTION, OFFICES } from "./catalog";
import {
  appendBallot,
  getChain,
  getReceipt,
  getRecentBallots,
  getTallies,
  hasVoted,
} from "./chain.server";
import {
  emailHash,
  newId,
  otpHash,
  safeEqualHex,
  safeEqualText,
  sixDigitCode,
} from "./crypto.server";
import { sendOtpEmail } from "./mailer.server";
import { VOTERS } from "./roll.server";
import { ensureElection } from "./seed.server";
import {
  clearSession,
  issueSession,
  lastSixOfReg,
  lookupVoter,
  lookupVoterByEmail,
  readSession,
  requireSession,
} from "./session.server";

const credentialsSchema = z.object({
  email: z.string().trim().min(3).max(120),
  reg: z.string().trim().min(6).max(20),
});

const otpSchema = z.object({
  email: z.string().trim().min(3).max(120),
  code: z.string().regex(/^\d{6}$/),
});

const ballotSchema = z.object({
  choices: z.record(z.string(), z.string()),
});

function publicError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function withTimeCap<T>(
  work: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const getBoothSession = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      await ensureElection();
      const session = await readSession();
      if (!session) return { authenticated: false as const };
      const voted = await hasVoted(session.emailHash);
      const receipt = voted ? await getReceipt(session.emailHash) : null;
      return {
        authenticated: true as const,
        givenName: session.givenName,
        maskedEmail: session.maskedEmail,
        emailHash: session.emailHash,
        voted,
        receipt,
      };
    } catch (err) {
      console.error("[soe-session]", err);
      return { authenticated: false as const };
    }
  },
);

export const requestOtp = createServerFn({ method: "POST" })
  .validator(credentialsSchema)
  .handler(async ({ data }) => {
    await ensureElection();
    const voter = lookupVoter(data.email, data.reg);
    if (!voter) {
      throw new Error(
        "Those credentials are not on the Software Engineering class roll.",
      );
    }
    if (!voter.email.endsWith("@futo.edu.ng")) {
      throw new Error("Use your FUTO student mailbox.");
    }

    const hash = emailHash(voter.email);
    const sql = await getSql();
    const rate = await sql<{ last: string; send_count: number }>`
      select last_sent_at as last, send_count from otp_rate where email_hash = ${hash}
    `;
    const last = rate[0];
    if (last) {
      const elapsed = Date.now() - new Date(last.last).getTime();
      if (elapsed < 45_000) {
        const challengeId = newId();
        const code = lastSixOfReg(voter.reg);
        const codeDigest = otpHash(code, challengeId);
        await sql`update otp_challenges set consumed = true where email_hash = ${hash}`;
        await sql`
          insert into otp_challenges (id, email_hash, code_hash, expires_at, channel)
          values (${challengeId}, ${hash}, ${codeDigest}, now() + interval '10 minutes', ${"confirm"})
        `;
        return {
          sent: true as const,
          alreadySent: true as const,
          channel: "confirm" as const,
          activation: false,
          maskedEmail: maskEmail(voter.email),
          expiresInSec: 600,
        };
      }
    }

    const mailedCode = sixDigitCode();
    const delivery = await withTimeCap(
      sendOtpEmail(voter.email, mailedCode),
      3200,
      { ok: false as const, reason: "mail-timeout" },
    );
    const channel = delivery.ok ? ("outlook" as const) : ("confirm" as const);
    const code = delivery.ok ? mailedCode : lastSixOfReg(voter.reg);
    const challengeId = newId();
    const codeDigest = otpHash(code, challengeId);

    await sql`update otp_challenges set consumed = true where email_hash = ${hash}`;
    await sql`
      insert into otp_challenges (id, email_hash, code_hash, expires_at, channel)
      values (${challengeId}, ${hash}, ${codeDigest}, now() + interval '10 minutes', ${channel})
    `;
    await sql`
      insert into otp_rate (email_hash, last_sent_at, send_count)
      values (${hash}, now(), 1)
      on conflict (email_hash) do update
        set last_sent_at = now(), send_count = otp_rate.send_count + 1
    `;

    return {
      sent: true as const,
      channel,
      activation: Boolean(delivery.activation),
      maskedEmail: maskEmail(voter.email),
      expiresInSec: 600,
    };
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .validator(otpSchema)
  .handler(async ({ data }) => {
    await ensureElection();
    const voter = lookupVoterByEmail(data.email);
    if (!voter) {
      throw new Error("That mailbox is not on the departmental roll.");
    }
    const hash = emailHash(voter.email);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      code_hash: string;
      expires_at: string;
      attempts: number;
      consumed: boolean;
    }>`
      select id, code_hash, expires_at, attempts, consumed
      from otp_challenges
      where email_hash = ${hash}
      order by created_at desc
      limit 1
    `;
    const challenge = rows[0];
    if (!challenge) {
      throw new Error("Request a new code from the sign-in page.");
    }
    const consumed =
      challenge.consumed === true ||
      challenge.consumed === ("t" as unknown as boolean) ||
      String(challenge.consumed) === "true";
    if (consumed) {
      throw new Error("Request a new code from the sign-in page.");
    }
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      throw new Error("That code has expired. Request a new one.");
    }
    if (Number(challenge.attempts) >= 5) {
      await sql`update otp_challenges set consumed = true where id = ${challenge.id}`;
      throw new Error("Too many attempts. Request a new code.");
    }

    const expected = otpHash(data.code, challenge.id);
    const rollPin = lastSixOfReg(voter.reg);
    const matchesStored = safeEqualHex(expected, challenge.code_hash);
    const matchesRoll = safeEqualText(data.code, rollPin);
    if (!matchesStored && !matchesRoll) {
      await sql`
        update otp_challenges
        set attempts = attempts + 1
        where id = ${challenge.id}
      `;
      throw new Error(
        "That code does not match. Check Outlook, or use the last six digits of your registration number.",
      );
    }

    await sql`update otp_challenges set consumed = true where id = ${challenge.id}`;
    await issueSession(voter);
    return { ok: true as const, givenName: voter.name.split(/\s+/)[0] ?? "Student" };
  });

export const signOutBooth = createServerFn({ method: "POST" }).handler(
  async () => {
    await clearSession();
    return { ok: true as const };
  },
);

export const getElectionState = createServerFn({ method: "POST" }).handler(
  async () => {
    await ensureElection();
    const session = await requireSession();
    const voted = await hasVoted(session.emailHash);
    const [chain, tallies, receipt] = await Promise.all([
      getChain(),
      getTallies(),
      voted ? getReceipt(session.emailHash) : Promise.resolve(null),
    ]);
    const head = chain.blocks[chain.blocks.length - 1];
    return {
      election: ELECTION,
      offices: OFFICES,
      candidates: CANDIDATES,
      chain,
      tallies,
      voted,
      receipt,
      voterCount: VOTERS.length,
      maskedEmail: session.maskedEmail,
      emailHash: session.emailHash,
      chainTip: head
        ? { index: head.index, hash: head.blockHash }
        : null,
      blockCount: chain.blocks.length,
      ballotCount: chain.ballotCount,
    };
  },
);

export const getLedgerState = createServerFn({ method: "POST" }).handler(
  async () => {
    await ensureElection();
    await requireSession();
    const [chain, ballots] = await Promise.all([getChain(), getRecentBallots(40)]);
    return { election: ELECTION, chain, ballots };
  },
);

export const castBallot = createServerFn({ method: "POST" })
  .validator(ballotSchema)
  .handler(async ({ data }) => {
    await ensureElection();
    const session = await requireSession();
    try {
      return await appendBallot({ session, choices: data.choices });
    } catch (err) {
      throw new Error(publicError(err, "The ballot could not be sealed."));
    }
  });
