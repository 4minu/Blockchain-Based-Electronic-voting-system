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
    if (!navigator.onLine) {
      setError(
        "Internet is required for the first sign-in. After that, this device stays signed in and can vote offline.",
      );
      return;
    }
    setBusy(true);
    try {
      const result = await signInVoter({ data: { email, regNumber } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
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
        description: "This device stays signed in. You can vote even if the network drops.",
      });
      await navigate({ to: "/" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reach the roll. Check your connection and try again.",
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
          First sign-in needs the internet. Use the FUTO email on the class list
          (Outlook / firstname.lastname@futo.edu.ng is fine) and your registration
          number. After that this phone stays signed in, so you can mark a ballot
          offline and sync when you are back.
        </p>

        {!networkOnline && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-secondary p-4">
            <WifiOff className="mt-0.5 size-4 shrink-0 text-accent" />
            <p className="text-sm text-muted-foreground">
              You are offline. Connect once to authenticate against the class roll.
            </p>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">FUTO student email</Label>
            <Input
              id="email"
              type="text"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="firstname.lastname@futo.edu.ng"
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
            disabled={busy || !networkOnline}
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
