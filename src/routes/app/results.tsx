import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { getElectionState } from "@/lib/vote/functions";
import { readQueuedBallot } from "@/lib/vote/offline";
import { cn, initialsOf } from "@/lib/utils";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/results")({
  loader: () => getElectionState(),
  component: ResultsPage,
});

function ResultsPage() {
  const state = Route.useLoaderData();
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    setQueued(Boolean(readQueuedBallot()));
  }, []);

  const sealedBallots = Math.floor(state.ballotCount / Math.max(state.offices.length, 1));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
            Public tally
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight">
            Live results
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="ok">From chain</Badge>
          {queued ? <Badge variant="secondary">1 unsealed local</Badge> : null}
        </div>
      </div>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Counts include only ballots already sealed on the chain. Locally queued
        votes appear after sync. {sealedBallots} ballot
        {sealedBallots === 1 ? "" : "s"} counted.
      </p>

      <div className="mt-10 space-y-10">
        {state.offices.map((office) => {
          const people = state.candidates
            .filter((c) => c.officeId === office.id)
            .map((candidate) => ({
              candidate,
              votes:
                state.tallies.find(
                  (t) =>
                    t.officeId === office.id && t.candidateId === candidate.id,
                )?.votes ?? 0,
            }));
          const total = people.reduce((sum, row) => sum + row.votes, 0);
          const lead = [...people].sort((a, b) => b.votes - a.votes)[0];
          return (
            <section key={office.id}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl">{office.title}</h2>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {total} votes
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {people
                  .slice()
                  .sort((a, b) => b.votes - a.votes)
                  .map((row) => {
                    const pct = total === 0 ? 0 : Math.round((row.votes / total) * 100);
                    const leading =
                      Boolean(lead && row.votes === lead.votes && total > 0);
                    return (
                      <div
                        key={row.candidate.id}
                        className={cn(
                          "rounded-xl border bg-card p-4",
                          leading ? "border-primary/50" : "border-border",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 items-center justify-center rounded-md bg-secondary font-mono text-xs text-primary">
                            {initialsOf(row.candidate.fullName)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="font-medium">
                                {row.candidate.fullName}
                                {leading ? (
                                  <span className="ml-2 text-xs font-normal text-primary">
                                    leading
                                  </span>
                                ) : null}
                              </p>
                              <p className="font-mono text-sm tabular-nums">
                                {row.votes} · {pct}%
                              </p>
                            </div>
                            <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-12 text-xs text-muted-foreground">
        {state.candidates.length} candidates across {state.offices.length}{" "}
        offices. Tally is a public reduction of sealed receipts — no voter
        identity is revealed.
      </p>
    </div>
  );
}
