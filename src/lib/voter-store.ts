import { create } from "zustand";
import { getVoterSession, signOutVoter } from "@/lib/voter-api";

const SESSION_KEY = "soe-voter-session";

export type VoterSession = {
  token: string;
  commitment: string;
  maskedEmail: string;
  expiresAt: number;
  votedPositionIds: string[];
};

type VoterState = {
  hydrated: boolean;
  session: VoterSession | null;
  hydrate: () => Promise<void>;
  setSession: (session: VoterSession) => void;
  markVoted: (positionIds: string[]) => void;
  signOut: () => Promise<void>;
};

function expiryMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const t = Date.parse(String(value ?? ""));
  return Number.isFinite(t) ? t : 0;
}

function readSession(): VoterSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VoterSession;
    if (!parsed?.token || parsed.token.length < 20) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (expiryMs(parsed.expiresAt) <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { ...parsed, expiresAt: expiryMs(parsed.expiresAt) };
  } catch {
    return null;
  }
}

function writeSession(session: VoterSession | null) {
  if (typeof window === "undefined") return;
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export const useVoterStore = create<VoterState>((set, get) => ({
  hydrated: false,
  session: null,
  hydrate: async () => {
    const stored = readSession();
    if (!stored) {
      set({ hydrated: true, session: null });
      return;
    }
    set({ session: stored, hydrated: true });
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const live = await Promise.race([
        getVoterSession({ data: { token: stored.token } }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("session-timeout")), 4000);
        }),
      ]);
      if (!live.ok) return;
      const next: VoterSession = {
        token: stored.token,
        commitment: live.commitment,
        maskedEmail: live.maskedEmail,
        expiresAt: expiryMs(live.expiresAt) || stored.expiresAt,
        votedPositionIds: Array.from(
          new Set([...stored.votedPositionIds, ...live.votedPositionIds]),
        ),
      };
      writeSession(next);
      set({ session: next, hydrated: true });
    } catch {
      /* cached session stays valid for offline voting */
    }
  },
  setSession: (session) => {
    writeSession(session);
    set({ session, hydrated: true });
  },
  markVoted: (positionIds) => {
    const current = get().session;
    if (!current) return;
    const next = {
      ...current,
      votedPositionIds: Array.from(new Set(positionIds)),
    };
    writeSession(next);
    set({ session: next });
  },
  signOut: async () => {
    const current = get().session;
    writeSession(null);
    set({ session: null, hydrated: true });
    if (!current) return;
    try {
      await signOutVoter({ data: { token: current.token } });
    } catch {
      /* local sign-out still stands */
    }
  },
}));
