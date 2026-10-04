import { useNavigate } from "@tanstack/react-router";
import { LoaderCircle, ShieldCheck, WifiOff } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { Seal } from "@/components/seal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInVoter } from "@/lib/voter-api";
import { getElectionSnapshot } from "@/lib/election-api";
import { cacheElectionSnapshot } from "@/lib/use-election";
import { useVoterStore, type VoterSession } from "@/lib/voter-store";
import { useOfflineStore } from "@/lib/offline-store";
import { CLASS_ROLL } from "@/lib/class-roll";
import { findOnRoll } from "@/lib/roll-match";
import { voterCommitment } from "@/lib/chain";

async function openLocalBooth(email: string, regNumber: string): Promise<VoterSession | null> {
  const row = findOnRoll(CLASS_ROLL, email, regNumber);
  if (!row) return null;
  const commitment = await voterCommitment(row.studentId, row.pin);
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const token = `local-${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  const [local, domain] = row.studentId.split("@");
  const maskedEmail =
    local && domain ? `${local.slice(0, 2)}***@${domain}` : row.name;
  return {
    token,
    commitment,
    maskedEmail,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 120,
    votedPositionIds: [],
  };
}

export function LoginScreen() {
  const navigate = useNavigate();
  const session = useVoterStore((s) => s.session);
  const hydrate = useVoterStore((s) => s.hydrate);
  const setSession = useVoterStore((s) => s.setSession);
  const networkOnline = useOfflineStore((s) => s.networkOnline);
  const setNetworkOnline = useOfflineStore((s) => s.setNetworkOnline);
  const [email, setEmail] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const on = () => setNetworkOnline(true);
    const off = () => setNetworkOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setNetworkOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [setNetworkOnline]);

  useEffect(() => {
    if (session) void navigate({ to: "/" });
  }, [session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const local = await openLocalBooth(email, regNumber);
      if (!local) {
        setError(
          "This registration number is not on the 2025/2026 Software Engineering class list.",
        );
        return;
      }

      if (navigator.onLine) {
        try {
          const result = await Promise.race([
            signInVoter({ data: { email, regNumber } }),
            new Promise<null>((resolve) => {
              window.setTimeout(() => resolve(null), 8000);
            }),
          ]);
          if (result?.ok) {
            const next: VoterSession = {
              token: result.token,
              commitment: result.commitment,
              maskedEmail: result.maskedEmail,
              expiresAt: result.expiresAt,
              votedPositionIds: result.votedPositionIds,
            };
            setSession(next);
            void getElectionSnapshot()
              .then(cacheElectionSnapshot)
              .catch(() => undefined);
            toast("Signed in", {
              description:
                "This device stays signed in. You can vote even if the network drops.",
            });
            await navigate({ to: "/" });
            return;
          }
        } catch {
          /* chain server unreachable — continue with the on-device roll */
        }
      }

      setSession(local);
      toast("Signed in", {
        description:
          "Booth opened on this device. Ballots seal locally and sync when the chain is reachable.",
      });
      await navigate({ to: "/" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not open the booth. Check the class-list details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-10 sm:max-w-lg">
        <div className="flex items-center gap-3">
          <Seal size={48} />
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-primary">
              Department of Software Engineering
            </p>
            <p className="font-display text-2xl leading-tight">SOE Chainvote</p>
          </div>
        </div>
        <h1 className="mt-10 font-display text-4xl leading-[1.1] tracking-tight">
          Sign in to the 2025/2026 booth.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          First sign-in checks the 2025/2026 Software Engineering class list
          (88 students) on this device. Use your registration number plus FUTO
          email or full name. The session stays here so you can vote even if
          the chain server is unreachable.
        </p>

        {!networkOnline && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-secondary p-4">
            <WifiOff className="mt-0.5 size-4 shrink-0 text-accent" />
            <p className="text-sm text-muted-foreground">
              You are offline. The class roll still opens on this device; ballots
              queue until the chain is reachable.
            </p>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">FUTO email or student name</Label>
            <Input
              id="email"
              type="text"
              autoComplete="username"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Garba Aminu or you@futo.edu.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg">Registration number</Label>
            <Input
              id="reg"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 20211288832"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              required
              className="h-12"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="h-12 w-full"
            disabled={busy}
          >
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {busy ? "Checking the roll…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-auto flex items-start gap-2 pt-10 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
          Private BFT chain · one ballot per student · marks stored as a SHA-256 commitment, never a name.
        </p>
      </div>
    </div>
  );
}
