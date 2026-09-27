import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type MutableRefObject,
} from "react";
import { LoaderCircle } from "lucide-react";
import { Seal } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBoothSession, requestOtp, verifyOtp } from "@/lib/vote/functions";
import { cn } from "@/lib/utils";

type OtpChannel = "outlook" | "confirm";

function fnError(err: unknown, fallback: string): string {
  const pull = (value: unknown): string | null => {
    if (typeof value === "string" && value.trim()) {
      const raw = value.trim();
      if (raw.startsWith("{")) {
        try {
          const parsed = JSON.parse(raw) as { message?: string };
          if (parsed.message) return parsed.message;
        } catch {
          /* keep raw */
        }
      }
      if (raw.includes("Failed to fetch") || raw.includes("NetworkError")) {
        return "Could not reach the electoral server. Check your connection and try again.";
      }
      return raw;
    }
    if (value instanceof Error) return pull(value.message);
    if (value && typeof value === "object" && "message" in value) {
      return pull((value as { message: unknown }).message);
    }
    return null;
  };
  return pull(err) ?? fallback;
}

export function VoterLogin() {
  const navigate = useNavigate();
  const requestOtpFn = useServerFn(requestOtp);
  const verifyOtpFn = useServerFn(verifyOtp);
  const sessionFn = useServerFn(getBoothSession);

  const [email, setEmail] = useState("");
  const [reg, setReg] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [channel, setChannel] = useState<OtpChannel>("outlook");
  const [activation, setActivation] = useState(false);
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const inflight = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qEmail = params.get("email");
    const qReg = params.get("reg");
    if (qEmail) setEmail(qEmail);
    if (qReg) setReg(qReg);
  }, []);

  useEffect(() => {
    let alive = true;
    void sessionFn()
      .then((session) => {
        if (!alive) return;
        if (session.authenticated) void navigate({ to: "/app" });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [navigate, sessionFn]);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    const nextEmail = email.trim();
    const nextReg = reg.trim();
    if (!nextEmail || nextReg.replace(/[\s-]/g, "").length < 6) {
      setError("Enter your FUTO student email and full registration number.");
      return;
    }
    const ticket = ++inflight.current;
    setBusy(true);
    setError(null);
    setStatus("Contacting the electoral server…");
    const timeout = window.setTimeout(() => {
      if (inflight.current !== ticket) return;
      inflight.current += 1;
      setBusy(false);
      setStatus(null);
      setError(
        "The electoral server took too long. Check your connection and try again.",
      );
    }, 8000);
    try {
      const result = await requestOtpFn({
        data: { email: nextEmail, reg: nextReg },
      });
      if (inflight.current !== ticket) return;
      setMasked(result.maskedEmail);
      setChannel(result.channel === "confirm" ? "confirm" : "outlook");
      setActivation(Boolean(result.activation));
      setStep("otp");
      setCode(["", "", "", "", "", ""]);
      setStatus(null);
      setError(null);
      queueMicrotask(() => inputs.current[0]?.focus());
    } catch (err) {
      if (inflight.current !== ticket) return;
      setError(fnError(err, "Could not send the code."));
      setStatus(null);
    } finally {
      window.clearTimeout(timeout);
      if (inflight.current === ticket) setBusy(false);
    }
  }

  async function confirmCode(digits: string[]) {
    const value = digits.join("");
    if (value.length !== 6) {
      setError("Enter all six digits.");
      return;
    }
    const ticket = ++inflight.current;
    setBusy(true);
    setError(null);
    setStatus("Verifying…");
    try {
      await verifyOtpFn({ data: { email: email.trim(), code: value } });
      if (inflight.current !== ticket) return;
      await navigate({ to: "/app" });
    } catch (err) {
      if (inflight.current !== ticket) return;
      setError(fnError(err, "That code was rejected."));
      setCode(["", "", "", "", "", ""]);
      setStatus(null);
      queueMicrotask(() => inputs.current[0]?.focus());
    } finally {
      if (inflight.current === ticket) setBusy(false);
    }
  }

  function onDigit(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    setCode((prev) => {
      const next = [...prev];
      if (!digits) {
        next[index] = "";
        return next;
      }
      digits.split("").forEach((d, offset) => {
        if (index + offset < 6) next[index + offset] = d;
      });
      const focusAt = Math.min(index + digits.length, 5);
      queueMicrotask(() => inputs.current[focusAt]?.focus());
      if (next.every((d) => d)) queueMicrotask(() => void confirmCode(next));
      return next;
    });
  }

  function onKey(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    event.preventDefault();
    const next = ["", "", "", "", "", ""];
    text.split("").forEach((d, i) => {
      next[i] = d;
    });
    setCode(next);
    if (text.length === 6) void confirmCode(next);
  }

  return (
    <div className="relative min-h-dvh">
      <div className="mx-auto grid min-h-dvh max-w-6xl lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="hidden flex-col justify-between border-r border-border px-10 py-10 lg:flex">
          <div>
            <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
              Department of Software Engineering
            </p>
            <h1 className="mt-6 font-display text-5xl leading-[1.1] tracking-tight">
              SOE Chainvote
            </h1>
            <p className="mt-3 text-lg text-muted-foreground italic">
              2025/2026 session — authenticate before the booth opens.
            </p>
          </div>
          <div className="space-y-6">
            <Seal size={120} />
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="font-mono text-xs text-primary">01</span> Prove
                you are on the class roll with your FUTO email and registration
                number.
              </li>
              <li>
                <span className="font-mono text-xs text-primary">02</span> A
                six-digit code is delivered to your Outlook inbox. If mail is
                blocked, use the last six digits of your registration number.
              </li>
              <li>
                <span className="font-mono text-xs text-primary">03</span> After
                the code, you can read the election, inspect the ledger, and
                vote.
              </li>
            </ol>
          </div>
        </aside>

        <main className="flex flex-col justify-center px-4 py-10 pb-28 sm:px-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <Seal size={48} />
              <div>
                <p className="text-[10px] tracking-[0.22em] text-primary uppercase">
                  SOE
                </p>
                <p className="font-display text-xl">Chainvote</p>
              </div>
            </div>

            {step === "credentials" ? (
              <>
                <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
                  Voter authentication
                </p>
                <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
                  Identify, then confirm.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Only students on the Software Engineering class list can
                  request a code.
                </p>
                <form
                  id="soe-login-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void sendCode();
                  }}
                  method="post"
                  action="#"
                  noValidate
                  className="mt-8 space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="email">FUTO student email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="text"
                      autoComplete="username"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      placeholder="you.reg@futo.edu.ng"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void sendCode();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg">Registration number</Label>
                    <Input
                      id="reg"
                      name="reg"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      placeholder="e.g. 20211288832"
                      value={reg}
                      onChange={(e) => setReg(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void sendCode();
                        }
                      }}
                    />
                  </div>
                  {error ? (
                    <p
                      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : status ? (
                    <p className="text-sm text-muted-foreground">{status}</p>
                  ) : null}
                  <Button
                    type="button"
                    className="w-full"
                    disabled={busy}
                    onClick={() => void sendCode()}
                  >
                    {busy ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : null}
                    {busy ? "Sending code…" : "Send code to Outlook"}
                  </Button>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    The code is generated on the coordinating peer, hashed at
                    rest, and delivered to your Microsoft 365 / Outlook mailbox
                    (@futo.edu.ng). This booth never stores your email or
                    registration number in the open, and never displays the
                    generated code.
                  </p>
                </form>
              </>
            ) : channel === "confirm" ? (
              <>
                <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
                  Confirm your identity
                </p>
                <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
                  Enter your roll PIN.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  A generated code could not be delivered to{" "}
                  {masked || "your mailbox"} from this booth. Enter the last six
                  digits of your registration number. It is not shown here.
                </p>
                <OtpForm
                  code={code}
                  busy={busy}
                  error={error}
                  status={status}
                  submitLabel="Verify and enter"
                  inputs={inputs}
                  onDigit={onDigit}
                  onKey={onKey}
                  onPaste={onPaste}
                  onSubmit={() => void confirmCode(code)}
                  onResend={() => void sendCode()}
                  onBack={() => {
                    inflight.current += 1;
                    setStep("credentials");
                    setError(null);
                    setStatus(null);
                    setBusy(false);
                  }}
                />
              </>
            ) : (
              <>
                <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
                  Sent to your Outlook inbox
                </p>
                <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
                  Enter the Outlook code.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  A six-digit code was sent to {masked}. Open Outlook — it is
                  not shown here. If the message is missing, use the last six
                  digits of your registration number instead.
                </p>
                {activation ? (
                  <p className="mt-2 text-sm text-foreground">
                    First sign-in: approve the mailbox confirmation sitting in
                    Outlook, then tap Resend code. Check Junk if Inbox is empty.
                  </p>
                ) : null}
                <OtpForm
                  code={code}
                  busy={busy}
                  error={error}
                  status={status}
                  submitLabel="Verify and enter"
                  outlook
                  inputs={inputs}
                  onDigit={onDigit}
                  onKey={onKey}
                  onPaste={onPaste}
                  onSubmit={() => void confirmCode(code)}
                  onResend={() => void sendCode()}
                  onBack={() => {
                    inflight.current += 1;
                    setStep("credentials");
                    setError(null);
                    setStatus(null);
                    setBusy(false);
                  }}
                />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function OtpForm({
  code,
  busy,
  error,
  status,
  submitLabel,
  outlook,
  inputs,
  onDigit,
  onKey,
  onPaste,
  onSubmit,
  onResend,
  onBack,
}: {
  code: string[];
  busy: boolean;
  error: string | null;
  status: string | null;
  submitLabel: string;
  outlook?: boolean;
  inputs: MutableRefObject<Array<HTMLInputElement | null>>;
  onDigit: (index: number, raw: string) => void;
  onKey: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onResend: () => void;
  onBack: () => void;
}) {
  return (
    <form
      className="mt-8 space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSubmit();
      }}
    >
      <div>
        <Label>One-time code</Label>
        <div className="mt-2 flex justify-between gap-2" onPaste={onPaste}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputs.current[index] = el;
              }}
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${index + 1}`}
              maxLength={1}
              value={digit}
              disabled={busy}
              onChange={(e) => onDigit(index, e.target.value)}
              onKeyDown={(e) => onKey(index, e)}
              className={cn(
                "h-12 w-10 rounded-md border border-input bg-background text-center font-mono text-lg text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-14 sm:w-12",
              )}
            />
          ))}
        </div>
      </div>
      {error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : status ? (
        <p className="text-sm text-muted-foreground">{status}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {busy ? "Verifying…" : submitLabel}
      </Button>
      {outlook ? (
        <a
          href="https://outlook.office.com/mail/"
          target="_blank"
          rel="noreferrer"
          className="block w-full text-center text-sm text-foreground underline-offset-4 hover:underline"
        >
          Open Outlook
        </a>
      ) : null}
      {outlook ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Subject: “Your SOE Chainvote one-time code”. Check Focused, Other,
          and Junk. The generated code is not shown on this page.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Use the last six digits of the registration number you just entered.
          Example: 20211234567 → 234567. The generated Outlook code is not shown
          here.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          disabled={busy}
          onClick={onResend}
        >
          Resend code
        </button>
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          Use different details
        </button>
      </div>
    </form>
  );
}
