export const ELECTION_ID = "soe-2025-2026";

export type Position = {
  id: string;
  title: string;
  sortOrder: number;
  brief: string;
};

export type Candidate = {
  id: string;
  positionId: string;
  name: string;
  yearLabel: string;
  manifesto: string;
  sortOrder: number;
};

export const ELECTION_META = {
  id: ELECTION_ID,
  title: "Software Engineering Departmental Elections",
  department: "Department of Software Engineering",
  sessionLabel: "2025/2026 Session",
  referenceCode: "SOE/DPT/2025-2026/001",
  opensAt: "2025-10-06T08:00:00.000Z",
  closesAt: "2026-12-18T18:00:00.000Z",
};

export const POSITIONS: Position[] = [
  { id: "president", title: "Departmental President", sortOrder: 1, brief: "Leads the executive and represents the department to faculty." },
  { id: "vice-president", title: "Vice President", sortOrder: 2, brief: "Deputises the president and runs mentorship programmes." },
  { id: "secretary", title: "General Secretary", sortOrder: 3, brief: "Records motions, publishes minutes, keeps the notice board honest." },
  { id: "finance", title: "Financial Secretary", sortOrder: 4, brief: "Accounts for dues, grants, and event spend." },
  { id: "pro", title: "Public Relations Officer", sortOrder: 5, brief: "Owns the department’s public voice and project showcase." },
  { id: "welfare", title: "Welfare Director", sortOrder: 6, brief: "Student care, hardware access, and emergency support." },
  { id: "academic", title: "Academic Director", sortOrder: 7, brief: "Clinics, reading lists, and industry-aligned workshops." },
];

export const CANDIDATES: Candidate[] = [
  { id: "pres-garba", positionId: "president", name: "Garba Aminu", yearLabel: "500 Level", manifesto: "Open ledgers for dues, weekly office hours, and a public project gallery that employers can actually read.", sortOrder: 1 },
  { id: "pres-ugwumba", positionId: "president", name: "Ugwumba Akachukwu Mac-Anointed", yearLabel: "500 Level", manifesto: "Industry clinics, hardware commons, and a student charter that the executive cannot quietly rewrite.", sortOrder: 2 },
  { id: "vp-zainab", positionId: "vice-president", name: "Zainab Abdullahi", yearLabel: "400 Level", manifesto: "Peer mentorship pairs for every 100-level student by week four.", sortOrder: 1 },
  { id: "vp-ibrahim", positionId: "vice-president", name: "Ibrahim Musa", yearLabel: "400 Level", manifesto: "A deputy desk that actually answers; no more vanished complaints.", sortOrder: 2 },
  { id: "sec-kelvin", positionId: "secretary", name: "Kelvin Okeke", yearLabel: "300 Level", manifesto: "Minutes published within 48 hours, hashed onto the same chain as the votes.", sortOrder: 1 },
  { id: "sec-ngozi", positionId: "secretary", name: "Ngozi Eze", yearLabel: "300 Level", manifesto: "A searchable archive of motions so no one can claim a vote that never happened.", sortOrder: 2 },
  { id: "fin-fatima", positionId: "finance", name: "Fatima Bello", yearLabel: "400 Level", manifesto: "Monthly spend sheets, receipt photos, and a hard cap on unbudgeted events.", sortOrder: 1 },
  { id: "fin-david", positionId: "finance", name: "David Nwosu", yearLabel: "400 Level", manifesto: "Crowdfunded hardware with named donors and named machines — no black box.", sortOrder: 2 },
  { id: "pro-aisha", positionId: "pro", name: "Aisha Mohammed", yearLabel: "300 Level", manifesto: "A department magazine that ships, not a graveyard of unpublished drafts.", sortOrder: 1 },
  { id: "pro-emeka", positionId: "pro", name: "Emeka Okafor", yearLabel: "300 Level", manifesto: "Demo days with actual recruiters, not another WhatsApp flyer.", sortOrder: 2 },
  { id: "wel-blessing", positionId: "welfare", name: "Blessing Chukwu", yearLabel: "200 Level", manifesto: "Emergency support that arrives the same day, and a quiet room that stays quiet.", sortOrder: 1 },
  { id: "wel-yusuf", positionId: "welfare", name: "Yusuf Lawal", yearLabel: "200 Level", manifesto: "Laptop loans with a public queue so the same names stop jumping the line.", sortOrder: 2 },
  { id: "acd-sophia", positionId: "academic", name: "Sophia Nnamdi", yearLabel: "400 Level", manifesto: "Night clinics before tests, and a reading list that matches the exam, not the rumour.", sortOrder: 1 },
  { id: "acd-patrick", positionId: "academic", name: "Patrick Obi", yearLabel: "400 Level", manifesto: "Industry-aligned workshops every month, recorded and posted for those on SIWES.", sortOrder: 2 },
];
