import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import type { ElectionStatus } from "@/lib/election-types";

const credentialsSchema = z.object({
  email: z.string().trim().min(1).max(160),
  regNumber: z.string().trim().min(8).max(24),
});

async function seed() {
  const { ensureSeeded } = await import("@/lib/election-seed.server");
  await ensureSeeded();
}

export const signInVoter = createServerFn({ method: "POST" })
  .validator(credentialsSchema)
  .handler(async ({ data }) => {
    await seed();
    const { matchRoll, openBoothSession } = await import(
      "@/lib/voter-session.server"
    );
    const match = await matchRoll(data.email, data.regNumber);
    if (!match) {
      return {
        ok: false as const,
        message:
          "This registration number is not on the 2025/2026 Software Engineering class list.",
      };
    }
    const booth = await openBoothSession(match);
    return { ok: true as const, ...booth };
  });

export const getVoterSession = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(20) }))
  .handler(async ({ data }) => {
    await seed();
    const { lookupVoterSession } = await import("@/lib/voter-session.server");
    const session = await lookupVoterSession(data.token);
    if (!session) return { ok: false as const };
    const sql = await getSql();
    const voted = await sql<{ position_id: string }>`
      select position_id from vote_receipts where voter_commitment = ${session.commitment}
    `;
    const election = await sql<{ status: ElectionStatus }>`
      select status from elections where id = ${"soe-2025-2026"}
    `;
    return {
      ok: true as const,
      commitment: session.commitment,
      maskedEmail: session.maskedEmail,
      expiresAt: session.expiresAt,
      votedPositionIds: voted.map((row) => row.position_id),
      electionStatus: election[0]?.status ?? "closed",
    };
  });

export const signOutVoter = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(20) }))
  .handler(async ({ data }) => {
    const { revokeVoterSession } = await import("@/lib/voter-session.server");
    await revokeVoterSession(data.token);
    return { ok: true as const };
  });
