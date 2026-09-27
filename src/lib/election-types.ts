import type { BftCertificate, ChainBlock } from "@/lib/chain";
import type { Candidate, Position } from "@/lib/election-data";

export type ElectionStatus = "open" | "closed";

export type ElectionRecord = {
  id: string;
  title: string;
  department: string;
  sessionLabel: string;
  referenceCode: string;
  status: ElectionStatus;
  opensAt: string;
  closesAt: string;
};

export type TallyRow = {
  positionId: string;
  candidateId: string;
  votes: number;
};

export type ElectionSnapshot = {
  election: ElectionRecord;
  positions: Position[];
  candidates: Candidate[];
  blockCount: number;
  ballotCount: number;
  headHash: string;
  eligibleCommitments: string[];
  tallies: TallyRow[];
  bft: {
    validators: { id: string; name: string }[];
    faultTolerance: number;
    quorum: number;
  };
};

export type BoothUnlock = {
  eligible: boolean;
  votedPositionIds: string[];
  status: ElectionStatus;
};

export type CastResult =
  | {
      ok: true;
      receiptHash: string;
      blockHash: string;
      blockIndex: number;
      merkleRoot: string;
      votedPositionIds: string[];
      bft: BftCertificate;
    }
  | { ok: false; code: string; message: string };

export type ChainView = {
  blocks: Array<ChainBlock & { bft?: BftCertificate }>;
};
