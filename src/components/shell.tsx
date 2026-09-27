import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Landmark, Link2, LogOut, Radio, ScrollText } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/app", label: "Commission", icon: Landmark },
  { to: "/app/ballot", label: "Booth", icon: Radio },
  { to: "/app/ledger", label: "Ledger", icon: Link2 },
  { to: "/app/results", label: "Results", icon: ScrollText },
] as const;

export function Shell({
  children,
  maskedEmail,
  online,
  queued,
  forceOffline,
  blockCount,
  referenceCode,
  sessionLabel,
  onToggleOffline,
  onSignOut,
}: {
  children: ReactNode;
  maskedEmail: string;
  online: boolean;
  queued: boolean;
  forceOffline: boolean;
  blockCount: number;
  referenceCode: string;
  sessionLabel: string;
  onToggleOffline: () => void;
  onSignOut: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onChain = online && !forceOffline;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/app" className="flex min-w-0 items-center gap-3">
            <Wordmark />
          </Link>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                item.to === "/app"
                  ? pathname === "/app"
                  : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                    active && "bg-secondary text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={onToggleOffline}
            title="Toggle booth connectivity for the offline demo"
            className="ml-auto inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium md:ml-3"
          >
            <span
              className={cn("size-2 rounded-full", onChain ? "bg-ok" : "bg-warn")}
            />
            <span className="text-foreground">{onChain ? "On chain" : "Local"}</span>
            {queued ? <Badge variant="warn">1</Badge> : null}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            className="hidden h-11 max-w-[10rem] items-center gap-2 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            <span className="truncate font-mono">{maskedEmail}</span>
            <LogOut className="size-3.5 shrink-0" />
          </button>
        </div>
      </header>
      <div className="border-b border-border bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[11px] tracking-[0.16em] text-muted-foreground uppercase sm:px-6">
          <span>{referenceCode}</span>
          <span className="hidden sm:inline">{sessionLabel}</span>
          <span className="ml-auto normal-case tracking-normal">
            {onChain ? "Live peer" : "Cached roll"} · {blockCount} blocks
          </span>
        </div>
      </div>
      {queued ? (
        <div className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-center text-sm text-warn">
          A sealed ballot is waiting locally. It will append to the chain when
          the booth reconnects.
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-28 sm:px-6 sm:pt-10 md:pb-16">
        {children}
      </main>
      <footer className="hidden border-t border-border py-6 text-center text-xs text-muted-foreground md:block">
        Permissioned hash-chain · Software Engineering · 2025/2026
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((item) => {
            const active =
              item.to === "/app"
                ? pathname === "/app"
                : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={onSignOut}
            className="flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </nav>
    </div>
  );
}
