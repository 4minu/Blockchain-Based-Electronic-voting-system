import { useLayoutEffect } from "react";
import { LoginScreen } from "@/components/login-screen";
import { useVoterStore } from "@/lib/voter-store";

export function VoterGate({ children }: { children: React.ReactNode }) {
  const session = useVoterStore((s) => s.session);
  const hydrate = useVoterStore((s) => s.hydrate);

  useLayoutEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!session) return <LoginScreen />;
  return <>{children}</>;
}
