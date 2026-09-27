import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

const APP_SECRET = "soe-chainvote/futo-se/2025-2026";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function emailHash(email: string): string {
  return sha256Hex(`email|${email.trim().toLowerCase()}|${APP_SECRET}`);
}

export function pinHash(reg: string): string {
  return sha256Hex(`pin|${reg.replace(/\s+/g, "")}|${APP_SECRET}`);
}

export function otpHash(code: string, challengeId: string): string {
  return sha256Hex(`otp|${code}|${challengeId}|${APP_SECRET}`);
}

export function sessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function newId(): string {
  return randomBytes(16).toString("hex");
}

export function sixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function safeEqualText(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return sha256Hex("empty-merkle");
  let layer = [...hashes];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const a = layer[i];
      const b = layer[i + 1] ?? a;
      next.push(sha256Hex(`${a}|${b}`));
    }
    layer = next;
  }
  return layer[0]!;
}

export function computeBlockHash(input: {
  index: number;
  prevHash: string;
  merkleRoot: string;
  ballotCount: number;
}): string {
  return sha256Hex(
    [
      "soe-block",
      String(input.index),
      input.prevHash,
      input.merkleRoot,
      String(input.ballotCount),
    ].join("|"),
  );
}
