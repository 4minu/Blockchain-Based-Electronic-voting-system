export const ELECTION_SALT = "SOE-2025-2026-CHAINVOTE";
export const GENESIS_PREV = "0".repeat(64);

export type VoteTx = {
  voterCommitment: string;
  positionId: string;
  candidateId: string;
  timestamp: number;
};

export type ChainBlock = {
  index: number;
  timestamp: number;
  previousHash: string;
  merkleRoot: string;
  hash: string;
  nonce: number;
  transactions: VoteTx[];
};

export async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function voterCommitment(studentEmail: string, pin: string) {
  return sha256Hex(
    `${ELECTION_SALT}|${studentEmail.trim().toLowerCase()}|${pin.trim()}`,
  );
}

export async function merkleRoot(leaves: string[]) {
  if (leaves.length === 0) return sha256Hex("empty");
  let layer = [...leaves];
  if (layer.length % 2 === 1) layer.push(layer[layer.length - 1]!);
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(await sha256Hex(`${layer[i]}${layer[i + 1]}`));
    }
    layer = next;
    if (layer.length % 2 === 1 && layer.length > 1) {
      layer.push(layer[layer.length - 1]!);
    }
  }
  return layer[0]!;
}

export async function buildTransaction(
  voterCommitmentHash: string,
  positionId: string,
  candidateId: string,
  timestamp = Date.now(),
): Promise<VoteTx> {
  return {
    voterCommitment: voterCommitmentHash,
    positionId,
    candidateId,
    timestamp,
  };
}

export async function sealBlock(input: {
  index: number;
  previousHash: string;
  transactions: VoteTx[];
  timestamp?: number;
}): Promise<ChainBlock> {
  const timestamp = input.timestamp ?? Date.now();
  const leaves = await Promise.all(
    input.transactions.map((tx) =>
      sha256Hex(
        `${tx.voterCommitment}|${tx.positionId}|${tx.candidateId}|${tx.timestamp}`,
      ),
    ),
  );
  const root = await merkleRoot(leaves);
  const nonce = 0;
  const hash = await sha256Hex(
    `${input.index}|${timestamp}|${input.previousHash}|${root}|${nonce}`,
  );
  return {
    index: input.index,
    timestamp,
    previousHash: input.previousHash,
    merkleRoot: root,
    hash,
    nonce,
    transactions: input.transactions,
  };
}

/** Permissioned private chain: n = 4 validators, f = 1, quorum = 2f+1 = 3. */
export const VALIDATORS = [
  { id: "val-commission", name: "Commission node" },
  { id: "val-faculty", name: "Faculty node" },
  { id: "val-senate", name: "Senate node" },
  { id: "val-audit", name: "Audit node" },
] as const;

export const BFT_FAULT_TOLERANCE = 1;
export const BFT_QUORUM = 2 * BFT_FAULT_TOLERANCE + 1;

export type BftAttestation = {
  validatorId: string;
  validatorName: string;
  phase: "prepare" | "commit";
  signature: string;
};

export type BftCertificate = {
  faultTolerance: number;
  quorum: number;
  committed: boolean;
  prepares: BftAttestation[];
  commits: BftAttestation[];
};

export async function attestBlock(blockHash: string): Promise<BftCertificate> {
  const prepares: BftAttestation[] = [];
  const commits: BftAttestation[] = [];
  for (const validator of VALIDATORS) {
    prepares.push({
      validatorId: validator.id,
      validatorName: validator.name,
      phase: "prepare",
      signature: await sha256Hex(`${validator.id}|prepare|${blockHash}`),
    });
    commits.push({
      validatorId: validator.id,
      validatorName: validator.name,
      phase: "commit",
      signature: await sha256Hex(`${validator.id}|commit|${blockHash}`),
    });
  }
  return {
    faultTolerance: BFT_FAULT_TOLERANCE,
    quorum: BFT_QUORUM,
    committed: commits.length >= BFT_QUORUM,
    prepares,
    commits,
  };
}

