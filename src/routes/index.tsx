import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Fingerprint, Link2, Radio, WifiOff } from "lucide-react";
import { useLayoutEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useElection } from "@/lib/use-election";
import { useVoterStore } from "@/lib/voter-store";
import { shortHash } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Entry });

function Entry() {
  const session = useVoterStore((s) => s.session);
  const hydrate = useVoterStore((s) => s.hydrate);

  useLayoutEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!session) return <LoginScreen />;
  return <Home />;
}

function Home() {
  const { data, pending, online } = useElection();

  return (
    <AppShell>
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
        {data.election.department}
      </p>
      <h1 className="mt-2 font-display text-4xl leading-[1.1] tracking-tight">
        {data.election.sessionLabel}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Private BFT chain. Four validators, f = 1, quorum 3. Sign in once while
        online — this device keeps the session so you can vote without a signal.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button asChild className="h-12">
          <Link to="/vote">
            Open booth
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12">
          <Link to="/ledger">Inspect chain</Link>
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Chain head</CardTitle>
              <CardDescription>{data.election.referenceCode}</CardDescription>
            </div>
            <Badge variant={online ? "ok" : "warn"}>{online ? "Live" : "Cached"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-xs">
          <p>
            <span className="text-muted-foreground">Blocks </span>
            {data.blockCount}
          </p>
          <p>
            <span className="text-muted-foreground">Ballots </span>
            {data.ballotCount}
          </p>
          <p className="break-all">
            <span className="text-muted-foreground">Head </span>
            {shortHash(data.headHash || "pending", 14)}
          </p>
          <p>
            <span className="text-muted-foreground">BFT </span>
            {data.bft.validators.length} nodes · 2f+1 = {data.bft.quorum}
          </p>
          {pending.length > 0 && (
            <p className="text-accent">
              {pending.length} vote{pending.length === 1 ? "" : "s"} waiting to sync
            </p>
          )}
        </CardContent>
      </Card>

      <section className="mt-8 grid gap-3">
        <Fact
          icon={Fingerprint}
          title="Login once, stay in"
          body="Internet is only required to match the class roll. The session lives on this device for 30 days."
        />
        <Fact
          icon={WifiOff}
          title="Vote offline"
          body="Marks are stored locally. When the phone is online again, they are sealed by BFT consensus."
        />
        <Fact
          icon={Link2}
          title="Private BFT chain"
          body="Commission, faculty, senate, and audit nodes prepare and commit every block."
        />
        <Fact
          icon={Radio}
          title="One ballot"
          body="A SHA-256 commitment identifies you on chain — never a name or plaintext email."
        />
      </section>
    </AppShell>
  );
}

function Fact({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Fingerprint;
  title: string;
  body: string;
}) {
  return (
    <Card>
      <CardHeader>
        <Icon className="size-4 text-primary" />
        <CardTitle className="mt-2 text-lg">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
    </Card>
  );
}
