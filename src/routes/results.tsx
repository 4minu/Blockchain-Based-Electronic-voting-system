import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CANDIDATES, POSITIONS } from "@/lib/election-data";
import { useElection } from "@/lib/use-election";

export const Route = createFileRoute("/results")({ component: ResultsPage });

function ResultsPage() {
  const { data, loading } = useElection();

  return (
    <AppShell>
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Live tally</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Results, as sealed.</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Counts are derived from vote receipts on the chain. There is no private
        spreadsheet behind this page.
      </p>

      {loading || !data ? (
        <p className="mt-8 text-sm text-muted-foreground">Counting sealed receipts…</p>
      ) : (
        <div className="mt-8 space-y-6">
          {POSITIONS.map((position) => {
            const options = CANDIDATES.filter((c) => c.positionId === position.id);
            const rows = options.map((candidate) => {
              const votes =
                data.tallies.find(
                  (t) => t.positionId === position.id && t.candidateId === candidate.id,
                )?.votes ?? 0;
              return { candidate, votes };
            });
            const total = rows.reduce((sum, row) => sum + row.votes, 0);
            const leader = [...rows].sort((a, b) => b.votes - a.votes)[0];
            return (
              <Card key={position.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle>{position.title}</CardTitle>
                    <CardDescription>{total} sealed marks</CardDescription>
                  </div>
                  {leader && total > 0 && <Badge variant="ok">{leader.candidate.name}</Badge>}
                </CardHeader>
                <CardContent className="space-y-4">
                  {rows.map((row) => {
                    const pct = total === 0 ? 0 : Math.round((row.votes / total) * 100);
                    return (
                      <div key={row.candidate.id}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span>{row.candidate.name}</span>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {row.votes} · {pct}%
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
