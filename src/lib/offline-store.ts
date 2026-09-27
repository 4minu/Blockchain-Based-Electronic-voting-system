import { create } from "zustand";

export type PendingBallot = {
  id: string;
  sessionToken: string;
  selections: { positionId: string; candidateId: string }[];
  createdAt: number;
};

const KEY = "soe-offline-ballots";

function readPending(): PendingBallot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingBallot[]) : [];
  } catch {
    return [];
  }
}

function writePending(pending: PendingBallot[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(pending));
}

type OfflineState = {
  hydrated: boolean;
  pending: PendingBallot[];
  networkOnline: boolean;
  forceOffline: boolean;
  hydrate: () => void;
  setNetworkOnline: (online: boolean) => void;
  setForceOffline: (offline: boolean) => void;
  queueBallot: (ballot: PendingBallot) => void;
  removeBallot: (id: string) => void;
};

export const useOfflineStore = create<OfflineState>((set, get) => ({
  hydrated: false,
  pending: [],
  networkOnline: true,
  forceOffline: false,
  hydrate: () => {
    if (get().hydrated) return;
    set({ hydrated: true, pending: readPending() });
  },
  setNetworkOnline: (online) => set({ networkOnline: online }),
  setForceOffline: (offline) => set({ forceOffline: offline }),
  queueBallot: (ballot) => {
    const pending = [...get().pending, ballot];
    writePending(pending);
    set({ pending });
  },
  removeBallot: (id) => {
    const pending = get().pending.filter((b) => b.id !== id);
    writePending(pending);
    set({ pending });
  },
}));
