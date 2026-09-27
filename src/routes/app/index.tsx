import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Fingerprint, Link2, ShieldCheck, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Seal } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getElectionState } from "@/lib/vote/functions";
import { isEffectivelyOnline, readQueuedBallot } from "@/lib/vote/offline";
import { shortHash } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  loader: () => getElectionState(),
  component: ElectionHome,
});

function ElectionHome() {
  const state = Route.useLoaderData();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    const sync = () => {
      setOnline(isEffectivelyOnline());
      setQueued(readQueuedBallot() ? 1 : 0);
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <div>
      <section className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
            Department of Software Engineering
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            SOE Chainvote
            <br />
            <span className="italic">2025/2026 session,</span>
            <br />
            sealed on a public chain.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Authenticated students only. One ballot per person on the
            departmental roll. Marks are hashed, linked, and auditable. If the
            booth loses connectivity, the vote stays on this device and is
            sealed the moment the chain is reachable again.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/app/ballot">
                Open polling booth
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/app/ledger">Inspect the ledger</Link>
            </Button>
          </div>
        </div>

        <div className="surface-card rounded-2xl border border-border bg-card p-1">
          <div className="flex items-start justify-between gap-3 p-5">
            <Seal size={56} />
            <Badge variant={state.election.status === "open" ? "ok" : "warn"}>
              Polls {state.election.status}
            </Badge>
          </div>
          <div className="px-5">
            <h3 className="font-display text-2xl font-medium leading-tight">
              2025/2026 Session
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {state.election.referenceCode}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 p-5 pt-0">
            <Stat label="Blocks" value={String(state.blockCount)} />
            <Stat label="Ballots" value={String(state.ballotCount)} />
            <Stat label="Queued" value={String(queued)} />
          </div>
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-3">
        <Feature
          icon={Fingerprint}
          title="Two-factor roll check"
          body="Email and registration number prove eligibility. A one-time code in your Outlook inbox proves you hold the student mailbox before the booth opens."
        />
        <Feature
          icon={Link2}
          title="Hash-linked blocks"
          body="Each sealed ballot is a block with a Merkle root of its marks. Tampering breaks the chain."
        />
        <Feature
          icon={WifiOff}
          title="Offline booth"
          body="Cast locally without a connection. Queued ballots sync automatically when the peer is back."
        />
      </section>

      <section className="mt-16">
        <h2 className="font-display text-3xl tracking-tight">Use cases</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          After authentication, every signed-in student can exercise the same
          departmental workflows.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <UseCase
            title="Cast an online ballot"
            body="Mark every office, review, and seal. The coordinating peer appends a hash-linked block and returns a receipt."
          />
          <UseCase
            title="Vote while offline"
            body="If the peer drops, the booth stores the ballot on this device and writes it to the chain the moment connectivity returns."
          />
          <UseCase
            title="Inspect the ledger"
            body="Walk every block, recompute Merkle roots, and confirm no ballot was silently edited after sealing."
          />
          <UseCase
            title="Read the live tally"
            body="Results are derived from sealed receipts only. Queued local votes appear after they sync."
          />
        </div>
      </section>

      <section className="mt-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl tracking-tight">
              Offices of the session
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Seven offices. One mark each. A complete ballot is required.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {state.offices.map((office) => (
            <div
              key={office.id}
              className="flex items-start gap-4 rounded-xl border border-border bg-card p-4"
            >
              <span className="font-mono text-xs text-primary tabular-nums">
                {String(office.sortOrder).padStart(2, "0")}
              </span>
              <div>
                <p className="font-medium text-foreground">{office.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {office.brief}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">How to vote</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              The eligible roll is the Software Engineering class list for this
              session — {state.voterCount} hashed commitments, no names on the
              chain. You authenticated with your departmental email,
              registration number, and a one-time code from Outlook before this
              page opened.
            </p>
          </div>
          <Badge variant={online ? "ok" : "warn"}>
            {online ? "Peer reachable" : "Working locally"}
          </Badge>
        </div>
        <ol className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-xl bg-secondary p-4">
            <p className="font-mono text-xs text-primary">01</p>
            <p className="mt-2 font-medium">Authenticate</p>
            <p className="mt-1 text-muted-foreground">
              FUTO email + registration number, then a one-time code from your
              Outlook inbox.
            </p>
          </li>
          <li className="rounded-xl bg-secondary p-4">
            <p className="font-mono text-xs text-primary">02</p>
            <p className="mt-2 font-medium">Mark</p>
            <p className="mt-1 text-muted-foreground">
              One candidate per office, including President: Garba Aminu or
              Ugwumba Mac-Anointed.
            </p>
          </li>
          <li className="rounded-xl bg-secondary p-4">
            <p className="font-mono text-xs text-primary">03</p>
            <p className="mt-2 font-medium">Seal</p>
            <p className="mt-1 text-muted-foreground">
              Online writes a block. Offline queues the ballot on this device.
            </p>
          </li>
        </ol>
        {state.chainTip ? (
          <p className="mt-6 font-mono text-xs text-muted-foreground">
            Tip {state.chainTip.index} · {shortHash(state.chainTip.hash, 10)}
          </p>
        ) : null}
      </section>

      <section className="mt-16">
        <h2 className="font-display text-3xl tracking-tight">
          Why this is a chain, not a spreadsheet
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          SOE Chainvote is a permissioned hash-chain — the academic cousin of a
          public blockchain. There is no mining lottery and no token. Integrity
          comes from cryptography that any observer can recompute.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Why
            title="Local-first booth"
            body="After Outlook authentication, the booth already holds your anonymous commitment. Offline, the same payload is stored locally and synced when the peer returns — a store-and-forward model, not a second ballot box."
          />
          <Why
            title="Append-only ledger"
            body="Each ballot is a block: previous hash, Merkle root of marks, and its own SHA-256 digest. Rewrite one vote and every later hash fails verification. Duplicate commitments are rejected."
          />
          <Why
            title="Public audit, private identity"
            body="Anyone signed in can walk the chain, recompute Merkle roots, and match the tally. They cannot recover an email or registration number from a commitment."
          />
          <Why
            title="Honest bound"
            body="This is not Ethereum. Eligibility is a departmental roll, and the coordinating peer orders blocks. Decentralisation here means verifiable records no single operator can silently edit — not permissionless minting."
          />
        </div>
      </section>

      <section className="mt-10 flex items-center gap-3 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 text-primary" />
        Genesis is empty. Subsequent blocks each seal one complete ballot.
        <Link
          to="/app/results"
          className="ml-auto text-foreground underline-offset-4 hover:underline"
        >
          View live tally
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary p-3">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-display text-xl">{value}</p>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Fingerprint;
  title: string;
  body: string;
}) {
  return (
    <article className="surface-card rounded-xl border border-border bg-card p-5">
      <Icon className="size-5 text-primary" />
      <h3 className="mt-4 font-display text-xl font-medium leading-tight">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}

function UseCase({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}

function Why({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
