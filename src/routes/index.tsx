import { createFileRoute } from "@tanstack/react-router";
import { VoterLogin } from "@/components/voter-login";

export const Route = createFileRoute("/")({
  component: VoterLogin,
});
