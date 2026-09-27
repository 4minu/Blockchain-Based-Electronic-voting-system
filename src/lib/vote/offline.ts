const BALLOT_KEY = "soe-chainvote-offline-ballot";
const FORCE_KEY = "soe-force-offline";

export type QueuedBallot = {
  choices: Record<string, string>;
  queuedAt: string;
};

export function readQueuedBallot(): QueuedBallot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BALLOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QueuedBallot;
    if (!parsed?.choices) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeQueuedBallot(choices: Record<string, string>) {
  if (typeof window === "undefined") return;
  const payload: QueuedBallot = {
    choices,
    queuedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(BALLOT_KEY, JSON.stringify(payload));
}

export function clearQueuedBallot() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BALLOT_KEY);
}

export function readForceOffline(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FORCE_KEY) === "1";
}

export function writeForceOffline(value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FORCE_KEY, value ? "1" : "0");
}

export function isEffectivelyOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine && !readForceOffline();
}
