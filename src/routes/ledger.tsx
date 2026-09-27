import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getChainBlocks } from "@/lib/election-api";
import type { BftCertificate, ChainBlock } from "@/lib/chain";
import { CANDIDATES, POSITIONS } from "@/lib/election-data";
import { shortHash } from "@/lib/utils";
import { useOfflineStore } from "@/lib/offline-store";

type LedgerBlock = ChainBlock & { bft?: BftCertificate };

export const Route = createFileRoute("/ledger")({ component: LedgerPage });

function LedgerPage() {
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pending = useOfflineStore((s) => s.pending);
  const forceOffline = useOfflineStore((s) => s.forceOffline);
  const networkOnline = useOfflineStore((s) => s.networkOnline);

  useEffect(() => {
    const cached = typeof window !== "undefined" ? localStorage.getItem("soe-chain-blocks") : null;
    if (cached) {
      try {
        setBlocks(JSON.parse(cached) as LedgerBlock[]);
      } catch {
        /* ignore */
      }
    }
    if (!networkOnline || forceOffline) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await getChainBlocks();
        if (cancelled) return;
        setBlocks(result.blocks as LedgerBlock[]);
        localStorage.setItem("soe-chain-blocks", JSON.stringify(result.blocks));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the chain.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [networkOnline, forceOffline]);

  return (
    <AppShell>
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Private ledger</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">BFT hash chain.</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Four permissioned validators (commission, faculty, senate, audit). PBFT
        with f = 1: a block commits when 3 of 4 nodes sign prepare and commit.
      </p>

      {pending.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <Badge variant="warn">Local queue</Badge>
            <CardTitle className="mt-2">
              {pending.length} ballot{pending.length === 1 ? "" : "s"} on this device
            </CardTitle>
            <CardDescription>
              They join the chain the moment this phone is online.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {blocks.length === 0 && !error && (
        <p className="mt-8 text-sm text-muted-foreground">
          {networkOnline && !forceOffline ? "Loading blocks…" : "Go online to fetch the live chain. Offline votes still sit in the local queue."}
        </p>
      )}

      <ol className="mt-8 space-y-4">
        {blocks.map((block) => (
          <li key={block.hash}>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="font-mono text-base">
                    Block {block.index}
                    {block.index === 0 ? " · genesis" : ""}
                  </CardTitle>
                  <CardDescription className="mt-1 font-mono text-xs">
                    {new Date(block.timestamp).toISOString()}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary">{block.transactions.length} tx</Badge>
                  {block.bft?.committed ? <Badge variant="ok">BFT commit</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 font-mono text-xs">
                <Meta label="Hash" value={block.hash} />
                <Meta label="Prev" value={block.previousHash} />
                <Meta label="Merkle" value={block.merkleRoot} />
                {block.bft?.commits?.length ? (
                  <p className="text-muted-foreground">
                    Commit signatures {block.bft.commits.length}/{block.bft.quorum} quorum
                  </p>
                ) : null}
                {block.transactions.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-border pt-3">
                    {block.transactions.map((tx, i) => {
                      const office = POSITIONS.find((p) => p.id === tx.positionId)?.title ?? tx.positionId;
                      const name =
                        CANDIDATES.find((c) => c.id === tx.candidateId)?.name ?? tx.candidateId;
                      return (
                        <li key={`${tx.voterCommitment}-${i}`} className="text-muted-foreground">
                          <span className="text-foreground">{office}</span>
                          {" → "}
                          {name}
                          <span className="ml-2">
                            voter {shortHash(tx.voterCommitment, 6)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </AppShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex flex-col gap-1 sm:flex-row sm:justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all">{shortHash(value, 14)}</span>
    </p>
  );
}
