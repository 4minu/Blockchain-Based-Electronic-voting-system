/** Pure roll matching — used by the booth and the Android wrapper. */

export type RollRow = { name: string; studentId: string; pin: string };

function stripInvisible(raw: string) {
  return raw.replace(/[\u200b-\u200d\ufeff\u00a0]/g, "").trim();
}

export function normalizeEmail(raw: string) {
  let e = stripInvisible(raw).toLowerCase().replace(/\s+/g, "");
  if (!e) return e;
  if (!e.includes("@")) e = `${e}@futo.edu.ng`;
  return e;
}

export function normalizeReg(raw: string) {
  return stripInvisible(raw).replace(/\D/g, "");
}

function lettersOnly(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function tokens(s: string) {
  return s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 2);
}

export function emailFitsRoll(email: string, row: RollRow): boolean {
  const e = normalizeEmail(email);
  const [local = "", domain = ""] = e.split("@");
  if (!local) return false;
  if (domain && domain !== "futo.edu.ng") return false;

  const rollLocal = (row.studentId.split("@")[0] ?? "").toLowerCase();
  if (e === row.studentId.toLowerCase()) return true;
  if (local === rollLocal) return true;
  if (local === row.pin) return true;

  const localNoPin = local.replaceAll(row.pin, "").replace(/^[._-]+|[._-]+$/g, "");
  const rollNoPin = rollLocal.replaceAll(row.pin, "").replace(/^[._-]+|[._-]+$/g, "");
  const localLetters = lettersOnly(localNoPin);
  const nameLetters = lettersOnly(row.name);
  const rollLetters = lettersOnly(rollNoPin);

  if (localLetters && (localLetters === nameLetters || localLetters === rollLetters)) {
    return true;
  }
  if (localLetters.length >= 5 && (nameLetters.includes(localLetters) || rollLetters.includes(localLetters))) {
    return true;
  }
  if (rollLetters.length >= 5 && localLetters.includes(rollLetters)) return true;

  const nameToks = tokens(row.name);
  const emailToks = tokens(localNoPin);
  if (
    emailToks.length > 0 &&
    emailToks.every((t) => nameToks.some((n) => n === t || n.includes(t) || t.includes(n)))
  ) {
    return true;
  }
  return false;
}

export function findOnRoll(rows: RollRow[], email: string, pin: string): RollRow | null {
  const p = normalizeReg(pin);
  if (p.length < 8) return null;
  const byPin = rows.filter((r) => r.pin === p);
  if (byPin.length === 1 && emailFitsRoll(email, byPin[0]!)) return byPin[0]!;
  const e = normalizeEmail(email);
  return rows.find((r) => r.studentId.toLowerCase() === e && r.pin === p) ?? null;
}
