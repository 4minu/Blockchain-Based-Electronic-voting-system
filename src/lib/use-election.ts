import { useCallback, useEffect, useState } from "react";
import { CANDIDATES, ELECTION_META, POSITIONS } from "@/lib/election-data";
import { castBallot, getElectionSnapshot } from "@/lib/election-api";
import { useOfflineStore } from "@/lib/offline-store";
import type { ElectionSnapshot } from "@/lib/election-types";
import { BFT_FAULT_TOLERANCE, BFT_QUORUM, VALIDATORS } from "@/lib/chain";

const SNAP_KEY = "soe-election-snapshot";

function fallbackSnapshot(): ElectionSnapshot {
  return {
    election: {
      id: ELECTION_META.id,
      title: ELECTION_META.title,
      department: ELECTION_META.department,
      sessionLabel: ELECTION_META.sessionLabel,
      referenceCode: ELECTION_META.referenceCode,
      status: "open",
      opensAt: ELECTION_META.opensAt,
      closesAt: ELECTION_META.closesAt,
    },
    positions: POSITIONS,
    candidates: CANDIDATES,
    blockCount: 0,
    ballotCount: 0,
    headHash: "",
    eligibleCommitments: [],
    tallies: [],
    bft: {
      validators: VALIDATORS.map((v) => ({ id: v.id, name: v.name })),
      faultTolerance: BFT_FAULT_TOLERANCE,
      quorum: BFT_QUORUM,
    },
  };
}

function readCache(): ElectionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    return raw ? (JSON.parse(raw) as ElectionSnapshot) : null;
  } catch {
    return null;
  }
}

function writeCache(snapshot: ElectionSnapshot) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SNAP_KEY, JSON.stringify(snapshot));
}

export function cacheElectionSnapshot(snapshot: ElectionSnapshot) {
  writeCache(snapshot);
}

export function useElection() {
  const [data, setData] = useState<ElectionSnapshot | null>(() => readCache());
  const [loading, setLoading] = useState(true);
  const pending = useOfflineStore((s) => s.pending);
  const networkOnline = useOfflineStore((s) => s.networkOnline);
  const forceOffline = useOfflineStore((s) => s.forceOffline);
  const online = networkOnline && !forceOffline;

  useEffect(() => {
    let cancelled = false;
    if (!online) {
      setData((prev) => prev ?? readCache() ?? fallbackSnapshot());
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const snapshot = await getElectionSnapshot();
        if (cancelled) return;
        writeCache(snapshot);
        setData(snapshot);
      } catch {
        if (!cancelled) setData((prev) => prev ?? readCache() ?? fallbackSnapshot());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online]);

  const reload = useCallback(async () => {
    const snapshot = await getElectionSnapshot();
    writeCache(snapshot);
    setData(snapshot);
    return snapshot;
  }, []);

  return {
    data: data ?? fallbackSnapshot(),
    loading,
    pending,
    online,
    reload,
  };
}

export async function syncPendingBallots() {
  const { pending, removeBallot, networkOnline, forceOffline } = useOfflineStore.getState();
  if (!networkOnline || forceOffline) return { synced: 0 };
  let synced = 0;
  for (const ballot of pending) {
    try {
      const result = await castBallot({
        data: { sessionToken: ballot.sessionToken, selections: ballot.selections },
      });
      if (result.ok || result.code === "duplicate") {
        removeBallot(ballot.id);
        synced += 1;
      }
    } catch {
      break;
    }
  }
  return { synced };
}
