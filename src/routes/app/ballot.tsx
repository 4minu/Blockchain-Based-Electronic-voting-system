import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { castBallot, getElectionState } from "@/lib/vote/functions";
import {
  clearQueuedBallot,
  isEffectivelyOnline,
  readQueuedBallot,
  writeQueuedBallot,
} from "@/lib/vote/offline";
import { cn, initialsOf, shortHash } from "@/lib/utils";

export const Route = createFileRoute("/app/ballot")({
  loader: () => getElectionState(),
  component: BallotPage,
});

type Stage = "ballot" | "review" | "receipt";

function BallotPage() {
  const state = Route.useLoaderData();
  const router = useRouter();
  const castFn = useServerFn(castBallot);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<Stage>("ballot");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [receipt, setReceipt] = useState(state.receipt);
  const [queuedLocal, setQueuedLocal] = useState(false);

  const marked = state.offices.filter((o) => choices[o.id]).length;
  const complete = marked === state.offices.length;
  const alreadyVoted = Boolean(state.voted || receipt);

  useEffect(() => {
    const sync = () => setOnline(isEffectivelyOnline());
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("storage", sync);
    const queued = readQueuedBallot();
    if (queued?.choices) {
      setChoices(queued.choices);
      setQueuedLocal(true);
    }
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  async function flushQueue() {
    const queued = readQueuedBallot();
    if (!queued || state.voted || !isEffectivelyOnline()) return;
    try {
      const result = await castFn({ data: { choices: queued.choices } });
      clearQueuedBallot();
      setQueuedLocal(false);
      setReceipt({
        receiptHash: result.receiptHash,
        blockHash: result.blockHash,
        castAt: new Date().toISOString(),
      });
      setStage("receipt");
      await router.invalidate();
    } catch {
      /* keep queued */
    }
  }

  useEffect(() => {
    const onOnline = () => {
      setOnline(isEffectivelyOnline());
      void flushQueue();
    };
    window.addEventListener("online", onOnline);
    if (isEffectivelyOnline()) void flushQueue();
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedNames = useMemo(() => {
    return state.offices.map((office) => {
      const candidate = state.candidates.find((c) => c.id === choices[office.id]);
      return { office: office.title, name: candidate?.fullName ?? "—" };
    });
  }, [choices, state.candidates, state.offices]);

  async function seal() {
    if (!complete) {
      setError("Select a candidate for every office.");
      return;
    }
    setBusy(true);
    setError(null);
    if (!isEffectivelyOnline()) {
      writeQueuedBallot(choices);
      setQueuedLocal(true);
      setReceipt({
        receiptHash: "queued",
        blockHash: "local",
        castAt: new Date().toISOString(),
      });
      setStage("receipt");
      setBusy(false);
      return;
    }
    try {
      const result = await castFn({ data: { choices } });
      clearQueuedBallot();
      setQueuedLocal(false);
      setReceipt({
        receiptHash: result.receiptHash,
        blockHash: result.blockHash,
        castAt: new Date().toISOString(),
      });
      setStage("receipt");
      await router.invalidate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not seal.";
      if (/fetch|network|failed/i.test(message)) {
        writeQueuedBallot(choices);
        setQueuedLocal(true);
        setStage("receipt");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (alreadyVoted && stage !== "receipt") {
    return (
      <section>
        <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
          Polling booth
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">
          Ballot already recorded
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as {state.maskedEmail}.{" "}
          {online
            ? "This booth is connected to the chain peer."
            : "This booth is offline. Your ballot will queue locally."}
        </p>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <p className="font-display text-2xl">One ballot per student.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This session already has a sealed or queued ballot. The chain
            rejects a second mark from the same commitment.
          </p>
          {receipt ? (
            <p className="mt-4 break-all font-mono text-xs text-muted-foreground">
              {shortHash(receipt.receiptHash, 12)}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link to="/app/ledger">Open ledger</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/results">View tally</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (stage === "receipt" && receipt) {
    const local = queuedLocal || receipt.receiptHash === "queued";
    return (
      <section className="mx-auto max-w-xl">
        <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
          Electoral receipt
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">Receipt</h1>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <p className="font-display text-2xl">
            {local ? "Held in the local queue." : "Your ballot is on the chain."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {state.maskedEmail}. Keep this receipt. It proves a
            ballot was recorded without revealing who you chose.
          </p>
          <dl className="mt-6 space-y-3 font-mono text-xs">
            <div>
              <dt className="text-muted-foreground">Voter</dt>
              <dd className="mt-1">{state.maskedEmail}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Voter commitment</dt>
              <dd className="mt-1 break-all">{shortHash(state.emailHash, 12)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {local ? "Queued" : "Receipt"}
              </dt>
              <dd className="mt-1 break-all text-primary">
                {receipt.receiptHash}
              </dd>
            </div>
            {!local ? (
              <div>
                <dt className="text-muted-foreground">Block</dt>
                <dd className="mt-1 break-all">{receipt.blockHash}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {!local ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(receipt.receiptHash)}
              >
                Copy receipt
              </Button>
            ) : null}
            <Button asChild>
              <Link to="/app">Commission</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/ledger">Open ledger</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
        Polling booth
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {stage === "review" ? "Review marks" : "Official ballot"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {state.maskedEmail}.{" "}
        {online
          ? "This booth is connected to the chain peer."
          : "This booth is offline. Your ballot will queue locally."}
      </p>

      <ol className="mt-6 flex gap-2 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        {(["ballot", "review", "receipt"] as const).map((item, index) => (
          <li
            key={item}
            className={cn(
              "rounded-full px-2.5 py-1",
              stage === item && "bg-secondary text-foreground",
            )}
          >
            {String(index + 1).padStart(2, "0")} {item}
          </li>
        ))}
      </ol>

      {stage === "ballot" ? (
        <div className="mt-8 space-y-8">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {marked} of {state.offices.length} offices marked
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {state.maskedEmail}
            </span>
          </div>
          {state.offices.map((office) => {
            const people = state.candidates.filter((c) => c.officeId === office.id);
            return (
              <fieldset key={office.id} className="space-y-3">
                <legend className="flex w-full items-baseline justify-between gap-3">
                  <span className="font-display text-2xl">{office.title}</span>
                  <span className="font-mono text-xs text-primary">
                    {String(office.sortOrder).padStart(2, "0")}
                  </span>
                </legend>
                <p className="text-sm text-muted-foreground">{office.brief}</p>
                <div className="space-y-2">
                  {people.map((candidate) => {
                    const selected = choices[office.id] === candidate.id;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() =>
                          setChoices((prev) => ({
                            ...prev,
                            [office.id]: candidate.id,
                          }))
                        }
                        className={cn(
                          "w-full rounded-xl border p-4 text-left transition-colors duration-150",
                          selected
                            ? "border-primary/50 bg-primary/10"
                            : "border-border bg-card hover:border-primary/30",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary font-mono text-xs text-primary">
                            {initialsOf(candidate.fullName)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{candidate.fullName}</p>
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                              {candidate.manifesto}
                            </p>
                          </div>
                          {selected ? (
                            <Check className="mt-1 size-4 shrink-0 text-primary" />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              disabled={!complete}
              onClick={() => setStage("review")}
            >
              Review marks
            </Button>
            <p className="text-sm text-muted-foreground">
              One candidate per office. The booth does not store your name
              beside the choices.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 max-w-xl space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-2xl">Seal this ballot?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {online
                ? "The ballot will be written to the next block on the chain."
                : "The booth is offline — the ballot will be stored on this device and synced later."}
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {selectedNames.map((row) => (
                <li key={row.office} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{row.office}</span>
                  <span className="text-right font-medium">{row.name}</span>
                </li>
              ))}
            </ul>
            {error ? (
              <p className="mt-4 text-sm text-destructive">{error}</p>
            ) : null}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button size="lg" disabled={busy} onClick={() => void seal()}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Seal ballot
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setStage("ballot")}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
