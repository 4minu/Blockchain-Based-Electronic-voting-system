import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Landmark, Link2, LogOut, Radio, ScrollText, WifiOff } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Seal } from "@/components/seal";
import { VoterGate } from "@/components/voter-gate";
import { Badge } from "@/components/ui/badge";
import { syncPendingBallots, useElection } from "@/lib/use-election";
import { useOfflineStore } from "@/lib/offline-store";
import { useVoterStore } from "@/lib/voter-store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Landmark },
  { to: "/vote", label: "Vote", icon: Radio },
  { to: "/ledger", label: "Chain", icon: Link2 },
  { to: "/results", label: "Tally", icon: ScrollText },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <VoterGate>
      <AppShellInner>{children}</AppShellInner>
    </VoterGate>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hydrate = useOfflineStore((s) => s.hydrate);
  const hydrated = useOfflineStore((s) => s.hydrated);
  const setNetworkOnline = useOfflineStore((s) => s.setNetworkOnline);
  const forceOffline = useOfflineStore((s) => s.forceOffline);
  const setForceOffline = useOfflineStore((s) => s.setForceOffline);
  const pending = useOfflineStore((s) => s.pending);
  const networkOnline = useOfflineStore((s) => s.networkOnline);
  const { data, reload } = useElection();
  const session = useVoterStore((s) => s.session);
  const signOut = useVoterStore((s) => s.signOut);

  useEffect(() => {
    hydrate();
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
    if (!hydrated) return;
    if (!networkOnline || forceOffline || pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      const result = await syncPendingBallots();
      if (cancelled) return;
      if (result.synced > 0) {
        toast("Votes synced", {
          description: `${result.synced} offline ballot${result.synced === 1 ? "" : "s"} sealed by BFT consensus.`,
        });
        await reload().catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, networkOnline, forceOffline, pending.length]);

  const online = networkOnline && !forceOffline;

  return (
    <div className="relative min-h-dvh pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <Seal size={36} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-primary">SOE</p>
              <p className="font-display text-lg leading-none">Chainvote</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm",
                  pathname === item.to ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Badge variant={online ? "ok" : "warn"}>{online ? "Online" : "Offline"}</Badge>
            <button
              type="button"
              className="h-11 text-xs text-muted-foreground"
              onClick={() => setForceOffline(!forceOffline)}
            >
              {forceOffline ? "Go online" : "Go offline"}
            </button>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-md hover:bg-secondary"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/login" });
              }}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {!online && (
        <div className="border-b border-border bg-secondary px-4 py-2">
          <p className="mx-auto flex max-w-6xl items-center gap-2 text-xs text-muted-foreground">
            <WifiOff className="size-3.5" />
            Offline mode. Marks stay on this device until the chain is reachable.
            {pending.length > 0 ? ` ${pending.length} waiting to sync.` : ""}
          </p>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-6">
        {session && (
          <p className="mb-5 text-xs text-muted-foreground">
            {session.maskedEmail}
            {data ? ` · ${data.election.referenceCode}` : ""}
            {pending.length > 0 ? ` · ${pending.length} queued` : ""}
          </p>
        )}
        {children}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
        <div className="grid grid-cols-4">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]",
                pathname === item.to ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
