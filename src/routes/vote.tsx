import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { castBallot } from "@/lib/election-api";
import { CANDIDATES, POSITIONS } from "@/lib/election-data";
import { useElection } from "@/lib/use-election";
import { useOfflineStore } from "@/lib/offline-store";
import { useVoterStore } from "@/lib/voter-store";
import { cn, shortHash } from "@/lib/utils";

export const Route = createFileRoute("/vote")({ component: VotePage });

function VotePage() {
  const { data, online, reload } = useElection();
  const session = useVoterStore((s) => s.session);
  const markVoted = useVoterStore((s) => s.markVoted);
  const queueBallot = useOfflineStore((s) => s.queueBallot);
  const pending = useOfflineStore((s) => s.pending);
  const voted = new Set(session?.votedPositionIds ?? []);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    blockHash: string;
    merkleRoot: string;
    blockIndex: number;
    queued: boolean;
  } | null>(null);

  const positions = data?.positions ?? POSITIONS;
  const candidates = data?.candidates ?? CANDIDATES;
  const remaining = positions.filter((p) => !voted.has(p.id));

  useEffect(() => {
    if (!receipt?.queued) return;
    if (pending.length > 0 || !online) return;
    void (async () => {
      try {
        const snap = await reload();
        setReceipt({
          blockHash: snap.headHash,
          merkleRoot: snap.headHash,
          blockIndex: Math.max(0, snap.blockCount - 1),
          queued: false,
        });
      } catch {
        /* keep queued card */
      }
    })();
  }, [pending.length, online, receipt?.queued, reload]);

  function select(positionId: string, candidateId: string) {
    setPicks((prev) => ({ ...prev, [positionId]: candidateId }));
  }

  const ready = remaining.length > 0 && remaining.every((p) => picks[p.id]);

  async function submit() {
    if (!session || !ready) return;
    setBusy(true);
    setError(null);
    const selections = remaining
      .map((p) => ({ positionId: p.id, candidateId: picks[p.id]! }))
      .filter((s) => s.candidateId);
    try {
      if (!online) {
        queueBallot({
          id: crypto.randomUUID(),
          sessionToken: session.token,
          selections,
          createdAt: Date.now(),
        });
        markVoted([...voted, ...selections.map((s) => s.positionId)]);
        setReceipt({
          blockHash: "queued-offline",
          merkleRoot: "pending-sync",
          blockIndex: -1,
          queued: true,
        });
        return;
      }
      const result = await castBallot({
        data: { sessionToken: session.token, selections },
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      markVoted(result.votedPositionIds);
      setReceipt({
        blockHash: result.blockHash,
        merkleRoot: result.merkleRoot,
        blockIndex: result.blockIndex,
        queued: false,
      });
      await reload();
    } catch {
      queueBallot({
        id: crypto.randomUUID(),
        sessionToken: session.token,
        selections,
        createdAt: Date.now(),
      });
      markVoted([...voted, ...selections.map((s) => s.positionId)]);
      setReceipt({
        blockHash: "queued-offline",
        merkleRoot: "pending-sync",
        blockIndex: -1,
        queued: true,
      });
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <Badge variant={receipt.queued ? "warn" : "ok"}>
              {receipt.queued ? "Saved on this device" : "Sealed by BFT"}
            </Badge>
            <CardTitle className="mt-3 font-display text-3xl">
              {receipt.queued ? "Queued for sync." : "Ballot on chain."}
            </CardTitle>
            <CardDescription>
              {receipt.queued
                ? "Your marks stay on this phone. When you are back online, four private validators (commission, faculty, senate, audit) run PBFT — f = 1, quorum 3 — and seal the block."
                : "Commission, faculty, senate, and audit nodes prepared and committed this block (PBFT, f = 1, quorum 3 of 4)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 font-mono text-xs">
            <Row label="Block" value={receipt.queued ? "pending" : String(receipt.blockIndex)} />
            <Row label="Hash" value={receipt.queued ? "pending" : receipt.blockHash} />
            <Row label="Merkle" value={receipt.queued ? "pending" : receipt.merkleRoot} />
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button asChild className="h-12">
                <Link to="/ledger">Inspect chain</Link>
              </Button>
              <Button asChild variant="outline" className="h-12">
                <Link to="/results">View tally</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (remaining.length === 0) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle className="font-display text-3xl">You have voted.</CardTitle>
            <CardDescription>
              One ballot per student. The ledger and live tally stay open.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="h-12">
              <Link to="/ledger">Chain</Link>
            </Button>
            <Button asChild variant="outline" className="h-12">
              <Link to="/results">Tally</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Polling booth</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
        Mark the 2025/2026 slate.
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        One candidate per office. {online ? "Online — this ballot seals on the private BFT chain." : "Offline — this ballot is stored on the phone and syncs later."}
      </p>

      <div className="mt-8 space-y-8">
        {remaining.map((position) => {
          const options = candidates.filter((c) => c.positionId === position.id);
          return (
            <section key={position.id} data-office={position.id}>
              <h2 className="font-display text-2xl">{position.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{position.brief}</p>
              <div className="mt-4 grid gap-3">
                {options.map((candidate) => {
                  const selected = picks[position.id] === candidate.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => select(position.id, candidate.id)}
                      className={cn(
                        "min-h-20 rounded-xl border p-4 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{candidate.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            {candidate.yearLabel}
                          </p>
                        </div>
                        {selected && <Check className="size-4 text-primary" />}
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {candidate.manifesto}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {error && (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="sticky bottom-20 mt-10 md:bottom-4">
        <Button size="lg" className="h-12 w-full md:w-auto" disabled={!ready || busy} onClick={() => void submit()}>
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          {online ? "Cast ballot" : "Save vote offline"}
        </Button>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const pretty = useMemo(() => (value.length > 20 ? shortHash(value, 12) : value), [value]);
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all text-right">{pretty}</span>
    </div>
  );
}
