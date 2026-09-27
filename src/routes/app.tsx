import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { getBoothSession, getElectionState, signOutBooth } from "@/lib/vote/functions";
import {
  readForceOffline,
  readQueuedBallot,
  writeForceOffline,
} from "@/lib/vote/offline";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const session = await getBoothSession();
    if (!session.authenticated) {
      throw redirect({ to: "/" });
    }
  },
  loader: async () => getElectionState(),
  component: AppLayout,
});

function AppLayout() {
  const state = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const signOutFn = useServerFn(signOutBooth);
  const [networkOnline, setNetworkOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [forceOffline, setForceOffline] = useState(false);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    const sync = () => {
      setNetworkOnline(navigator.onLine);
      setForceOffline(readForceOffline());
      setQueued(Boolean(readQueuedBallot()));
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("storage", sync);
    const timer = window.setInterval(sync, 4000);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("storage", sync);
      window.clearInterval(timer);
    };
  }, []);

  async function onSignOut() {
    await signOutFn();
    await router.invalidate();
    await navigate({ to: "/" });
  }

  return (
    <Shell
      maskedEmail={state.maskedEmail}
      online={networkOnline}
      queued={queued}
      forceOffline={forceOffline}
      blockCount={state.blockCount}
      referenceCode={state.election.referenceCode}
      sessionLabel={state.election.sessionLabel}
      onToggleOffline={() => {
        const next = !readForceOffline();
        writeForceOffline(next);
        setForceOffline(next);
      }}
      onSignOut={() => void onSignOut()}
    >
      <Outlet />
    </Shell>
  );
}
