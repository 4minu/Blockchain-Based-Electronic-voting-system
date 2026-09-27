import { env } from "@/lib/env.server";

const FROM_NAME = "SOE Electoral Commission";

export type MailDelivery = {
  ok: boolean;
  via?: "resend" | "formsubmit";
  activation?: boolean;
  reason?: string;
};

function otpText(code: string) {
  return [
    "SOE Chainvote — FUTO Software Engineering",
    "2025/2026 departmental elections",
    "",
    `Your one-time sign-in code is ${code}`,
    "",
    "It expires in 10 minutes. Enter it in the booth. Nobody from the electoral committee will ask you for this code.",
    "",
    "If you did not request a code, ignore this message.",
    "",
    "— SOE Electoral Commission",
  ].join("\n");
}

async function tryResend(to: string, code: string): Promise<MailDelivery> {
  const key = env("RESEND_API_KEY");
  if (!key) return { ok: false, reason: "no-resend-key" };
  const from =
    env("RESEND_FROM") ?? "SOE Electoral Commission <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Your SOE Chainvote one-time code",
        text: otpText(code),
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, reason: `resend:${res.status}:${body.slice(0, 120)}` };
    }
    return { ok: true, via: "resend" };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "resend-failed",
    };
  }
}

async function tryFormSubmit(to: string, code: string): Promise<MailDelivery> {
  try {
    const res = await fetch(
      `https://formsubmit.co/ajax/${encodeURIComponent(to)}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          _subject: "Your SOE Chainvote one-time code",
          _template: "box",
          _captcha: "false",
          _replyto: "noreply@soechainvote.app",
          name: FROM_NAME,
          message: otpText(code),
        }),
        signal: AbortSignal.timeout(2500),
      },
    );
    const body = await res.text().catch(() => "");
    let parsed: { success?: string | boolean; message?: string } = {};
    try {
      parsed = JSON.parse(body) as typeof parsed;
    } catch {
      /* plain text */
    }
    const message = String(parsed.message ?? body);
    const lower = message.toLowerCase();
    if (lower.includes("rate limit")) {
      return { ok: false, reason: "formsubmit-rate-limit" };
    }
    if (!res.ok) {
      return { ok: false, reason: `formsubmit:${res.status}` };
    }
    if (
      lower.includes("activate") ||
      lower.includes("confirm") ||
      lower.includes("check your email")
    ) {
      return { ok: true, via: "formsubmit", activation: true };
    }
    if (parsed.success === false) {
      return { ok: false, reason: message.slice(0, 160) || "formsubmit-rejected" };
    }
    return { ok: true, via: "formsubmit" };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "formsubmit-failed",
    };
  }
}

/**
 * Deliver the OTP to the student's FUTO mailbox (Outlook / Microsoft 365).
 * Never uses raw SMTP on port 25 — serverless hosts hang on it, which made
 * "Send code" look dead. HTTP relays only, with a hard timeout.
 */
export async function sendOtpEmail(
  to: string,
  code: string,
): Promise<MailDelivery> {
  const resend = await tryResend(to, code);
  if (resend.ok) return resend;

  const formsubmit = await tryFormSubmit(to, code);
  if (formsubmit.ok) return formsubmit;

  console.error("[soe-mailer]", { resend, formsubmit });
  return {
    ok: false,
    reason: formsubmit.reason || resend.reason || "Could not deliver the code",
  };
}
