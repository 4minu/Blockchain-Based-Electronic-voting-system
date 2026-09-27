import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLedgerState } from "@/lib/vote/functions";
import { candidateById, officeById } from "@/lib/vote/catalog";
import { readQueuedBallot } from "@/lib/vote/offline";
import { shortHash } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/ledger")({
  loader: () => getLedgerState(),
  component: LedgerPage,
});

function LedgerPage() {
  const { chain, ballots } = Route.useLoaderData();
  const [open, setOpen] = useState<number | null>(null);
  const [queued] = useState(() =>
    typeof window === "undefined" ? null : readQueuedBallot(),
  );
  const genesis = chain.blocks[0];

  const grouped = useMemo(() => {
    const byHash = new Map<string, typeof ballots>();
    return { byHash };
  }, []);
  void grouped;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
            Public ledger
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight">
            Chain explorer
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Every sealed ballot is a block. Hashes, Merkle roots, and anonymous
            commitments are public so anyone can audit the count.
          </p>
        </div>
        <Button variant="outline" type="button">
          <ShieldCheck className="size-4" />
          Verify chain
        </Button>
      </div>

      <div
        className={cn(
          "mt-6 flex items-start gap-3 rounded-xl border p-4",
          chain.valid
            ? "border-ok/30 bg-ok/10 text-ok"
            : "border-destructive/30 bg-destructive/10 text-destructive",
        )}
      >
        {chain.valid ? (
          <Check className="mt-0.5 size-5" />
        ) : (
          <ShieldX className="mt-0.5 size-5" />
        )}
        <p className="font-medium">
          {chain.valid
            ? `Intact — ${chain.blocks.length} blocks, hashes and Merkle roots match.`
            : "The chain failed verification."}
        </p>
      </div>

      {queued ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl">Local queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reconnect the booth (or turn off Local mode) to seal these blocks.
          </p>
          <div className="mt-4 rounded-xl border border-warn/30 bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warn">queued</Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {queued.queuedAt}
              </span>
            </div>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {Object.keys(queued.choices).length} marks waiting locally
            </p>
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl">Sealed blocks</h2>
          <span className="text-sm text-muted-foreground">
            {chain.ballotCount} ballots on chain
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {chain.blocks
            .slice()
            .reverse()
            .map((block) => {
              const isGenesis = Number(block.index) === 0;
              const expanded = open === Number(block.index);
              return (
                <button
                  key={block.blockHash}
                  type="button"
                  onClick={() =>
                    setOpen(expanded ? null : Number(block.index))
                  }
                  className="w-full rounded-xl border border-border bg-card p-4 text-left"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs text-primary">
                      {String(block.index).padStart(3, "0")}
                    </span>
                    <span className="font-medium">
                      {isGenesis ? "Genesis" : `Block ${block.index}`}
                    </span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {shortHash(block.blockHash, 8)}
                    </span>
                  </div>
                  {expanded ? (
                    <dl className="mt-4 grid gap-2 font-mono text-[11px] sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Hash</dt>
                        <dd className="mt-1 break-all text-primary">
                          {block.blockHash}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Previous</dt>
                        <dd className="mt-1 break-all">{block.prevHash}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Merkle root</dt>
                        <dd className="mt-1 break-all">{block.merkleRoot}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Marks</dt>
                        <dd className="mt-1">{block.ballotCount}</dd>
                      </div>
                    </dl>
                  ) : null}
                  {isGenesis && !expanded ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Empty root. The first real ballot is block 001.
                    </p>
                  ) : null}
                </button>
              );
            })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Recent ballots</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Office and candidate are public after sealing. The voter is not.
        </p>
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {ballots.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground">
              No ballots have been appended yet. Genesis is waiting.
            </li>
          ) : (
            ballots.map((ballot) => (
              <li
                key={ballot.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
              >
                <span>
                  {officeById(ballot.officeId)?.title ?? ballot.officeId}
                  <span className="text-muted-foreground"> · </span>
                  {candidateById(ballot.candidateId)?.fullName ??
                    ballot.candidateId}
                </span>
                <span className="font-mono text-[11px] text-primary">
                  {shortHash(ballot.ballotHash, 10)}
                </span>
              </li>
            ))
          )}
        </ul>
        {genesis ? (
          <p className="mt-6 font-mono text-[11px] text-muted-foreground">
            Genesis {shortHash(genesis.blockHash, 10)}
          </p>
        ) : null}
      </section>
    </div>
  );
}
