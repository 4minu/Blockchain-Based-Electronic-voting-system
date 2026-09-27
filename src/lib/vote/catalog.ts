export const ELECTION_ID = "soe-2025-2026";

export const ELECTION = {
  id: ELECTION_ID,
  title: "Software Engineering Departmental Elections",
  shortTitle: "SOE Chainvote",
  session: "2025/2026",
  sessionLabel: "2025/2026 Session",
  referenceCode: "SOE/DPT/2025-2026/001",
  institution: "Federal University of Technology, Owerri",
  department: "Department of Software Engineering",
  school: "School of Information and Communication Technology",
  status: "open" as const,
} as const;

export type OfficeId =
  | "president"
  | "vice-president"
  | "secretary"
  | "treasurer"
  | "socials"
  | "sports"
  | "pro";

export type OfficeDef = {
  id: OfficeId;
  title: string;
  brief: string;
  sortOrder: number;
};

export type CandidateDef = {
  id: string;
  officeId: OfficeId;
  fullName: string;
  manifesto: string;
  sortOrder: number;
};

export const OFFICES: OfficeDef[] = [
  {
    id: "president",
    title: "President",
    brief: "Leads the departmental union and speaks for the session.",
    sortOrder: 1,
  },
  {
    id: "vice-president",
    title: "Vice President",
    brief: "Deputises the president and owns welfare response.",
    sortOrder: 2,
  },
  {
    id: "secretary",
    title: "General Secretary",
    brief: "Minutes, motions, and the public record of every meeting.",
    sortOrder: 3,
  },
  {
    id: "treasurer",
    title: "Treasurer",
    brief: "Dues, levies, and a spend book anyone can audit.",
    sortOrder: 4,
  },
  {
    id: "socials",
    title: "Director of Socials",
    brief: "Calendar, culture, and nights that include the whole class.",
    sortOrder: 5,
  },
  {
    id: "sports",
    title: "Director of Sports",
    brief: "Kits, fixtures, and intramurals that actually happen.",
    sortOrder: 6,
  },
  {
    id: "pro",
    title: "Public Relations Officer",
    brief: "Notices, press, and rumour control for the department.",
    sortOrder: 7,
  },
];

export const CANDIDATES: CandidateDef[] = [
  {
    id: "pres-garba",
    officeId: "president",
    fullName: "Garba Aminu",
    manifesto:
      "A department that can audit every decision the same way it audits every commit. Open books, weekly office hours, and a union that treats student data as a public trust.",
    sortOrder: 1,
  },
  {
    id: "pres-ugwumba",
    officeId: "president",
    fullName: "Ugwumba Akachukwu Mac-Anointed",
    manifesto:
      "Students first. Transparent bursary, town halls that actually change policy, and a presidency that ships — not speeches.",
    sortOrder: 2,
  },
  {
    id: "vp-eke",
    officeId: "vice-president",
    fullName: "Eke Queen-Elizabeth Ikwunma",
    manifesto:
      "Bridge the class years. Mentorship pairing, welfare response in hours not weeks, and a VP desk that is reachable.",
    sortOrder: 1,
  },
  {
    id: "vp-onyeukwu",
    officeId: "vice-president",
    fullName: "Onyeukwu Light Onyeyirichi",
    manifesto:
      "Operational excellence: class reps that work, a living academic calendar, and pressure on SICT when the labs fall behind.",
    sortOrder: 2,
  },
  {
    id: "sec-nnoli",
    officeId: "secretary",
    fullName: "Nnoli Temple Chibeze",
    manifesto:
      "Minutes published within 48 hours. A searchable archive of every motion. No closed-door edits after the meeting.",
    sortOrder: 1,
  },
  {
    id: "sec-uche",
    officeId: "secretary",
    fullName: "Uche Chichebem Janefrances",
    manifesto:
      "Clear communication, inclusive records, and a secretariat that treats documentation as student infrastructure.",
    sortOrder: 2,
  },
  {
    id: "tre-opara",
    officeId: "treasurer",
    fullName: "Opara Chinasa Jessica",
    manifesto:
      "Every naira on a public ledger. Dues, levies, and event spend with receipts — not rumours.",
    sortOrder: 1,
  },
  {
    id: "tre-ikeh",
    officeId: "treasurer",
    fullName: "Ikeh-ezeji Pamela Chinaza",
    manifesto:
      "Budget first, spend second. Monthly statements and a hard cap on unbudgeted outflows.",
    sortOrder: 2,
  },
  {
    id: "soc-nwakanma",
    officeId: "socials",
    fullName: "Nwakanma Dominion Chinonso",
    manifesto:
      "A social calendar that includes everyone — not just the loudest set. Safer nights, better sound, lower levies.",
    sortOrder: 1,
  },
  {
    id: "soc-chidi",
    officeId: "socials",
    fullName: "Chidi-Azuwike Shalom Ebere",
    manifesto:
      "Culture with craft. Showcases for builders and designers, not only parties.",
    sortOrder: 2,
  },
  {
    id: "spo-iyogwoya",
    officeId: "sports",
    fullName: "Iyogwoya Noble David",
    manifesto:
      "Kits that arrive, fixtures that hold, and intramurals that do not disappear after week three.",
    sortOrder: 1,
  },
  {
    id: "spo-eze",
    officeId: "sports",
    fullName: "Eze Kelechi Kelvin",
    manifesto:
      "Train, compete, recover. A sports desk that treats fitness as welfare, not afterthought.",
    sortOrder: 2,
  },
  {
    id: "pro-okeke",
    officeId: "pro",
    fullName: "Okeke Prosper-Chinecherem Prince",
    manifesto:
      "One channel, no rumours. Verified notices, a press kit for the department, and a PRO who answers.",
    sortOrder: 1,
  },
  {
    id: "pro-nduka",
    officeId: "pro",
    fullName: "Nduka Mmesoma Kenechi",
    manifesto:
      "Storytelling that actually represents Software Engineering — projects, people, and the work, not just flyers.",
    sortOrder: 2,
  },
];

export function candidatesFor(officeId: OfficeId): CandidateDef[] {
  return CANDIDATES.filter((c) => c.officeId === officeId).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function candidateById(id: string): CandidateDef | undefined {
  return CANDIDATES.find((c) => c.id === id);
}

export function officeById(id: string): OfficeDef | undefined {
  return OFFICES.find((o) => o.id === id);
}
