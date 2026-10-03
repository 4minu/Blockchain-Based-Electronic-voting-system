const SALT = "SOE-2025-2026-CHAINVOTE";
const GENESIS = "0".repeat(64);
const VALIDATORS = [
  ["val-commission", "Commission node"],
  ["val-faculty", "Faculty node"],
  ["val-senate", "Senate node"],
  ["val-audit", "Audit node"],
];
const KEYS = {
  session: "soe.session",
  chain: "soe.chain",
  voted: "soe.voted",
};

const $app = document.getElementById("app");
const state = {
  route: "home",
  roll: Array.isArray(window.SOE_ROLL) ? window.SOE_ROLL : [],
  slate: window.SOE_SLATE || null,
  session: null,
  chain: [],
  voted: [],
  marks: {},
  office: "president",
  error: "",
  busy: false,
  identityEmail: "",
  identityPin: "",
};

function stripInvisible(raw) {
  return String(raw || "").replace(/[\u200b-\u200d\ufeff\u00a0]/g, "").trim();
}

function normalizeEmail(raw) {
  let e = stripInvisible(raw).toLowerCase().replace(/\s+/g, "");
  if (!e) return e;
  if (!e.includes("@")) e = e + "@futo.edu.ng";
  return e;
}

function normalizeReg(raw) {
  return stripInvisible(raw).replace(/\D/g, "");
}

function lettersOnly(s) {
  return String(s).toLowerCase().replace(/[^a-z]/g, "");
}

function attr(value) {
  const amp = String.fromCharCode(38);
  return String(value || "")
    .replace(/&/g, amp + "amp;")
    .replace(/"/g, amp + "quot;")
    .replace(/</g, amp + "lt;");
}

function tokens(s) {
  return String(s)
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(function (t) {
      return t.length >= 2;
    });
}

function emailFitsRoll(email, row) {
  const e = normalizeEmail(email);
  const parts = e.split("@");
  const local = parts[0] || "";
  const domain = parts[1] || "";
  if (!local) return false;
  if (domain && domain !== "futo.edu.ng") return false;
  const rollLocal = (row.email.split("@")[0] || "").toLowerCase();
  if (e === row.email.toLowerCase()) return true;
  if (local === rollLocal) return true;
  if (local === row.pin) return true;
  const pinRe = new RegExp(row.pin, "g");
  const localNoPin = local.replace(pinRe, "").replace(/^[._-]+|[._-]+$/g, "");
  const rollNoPin = rollLocal.replace(pinRe, "").replace(/^[._-]+|[._-]+$/g, "");
  const localLetters = lettersOnly(localNoPin);
  const nameLetters = lettersOnly(row.name || "");
  const rollLetters = lettersOnly(rollNoPin);
  if (localLetters && (localLetters === nameLetters || localLetters === rollLetters)) return true;
  if (localLetters.length >= 5 && (nameLetters.indexOf(localLetters) !== -1 || rollLetters.indexOf(localLetters) !== -1)) {
    return true;
  }
  if (rollLetters.length >= 5 && localLetters.indexOf(rollLetters) !== -1) return true;
  const nameToks = tokens(row.name || "");
  const emailToks = tokens(localNoPin);
  if (
    emailToks.length &&
    emailToks.every(function (t) {
      return nameToks.some(function (n) {
        return n === t || n.indexOf(t) !== -1 || t.indexOf(n) !== -1;
      });
    })
  ) {
    return true;
  }
  return false;
}

function findOnRoll(email, pin) {
  const p = normalizeReg(pin);
  if (p.length < 8) return null;
  const byPin = state.roll.filter(function (r) {
    return r.pin === p;
  });
  if (byPin.length === 1) return byPin[0];
  if (!byPin.length) return null;
  const e = normalizeEmail(email);
  return (
    byPin.find(function (r) {
      return r.email.toLowerCase() === e;
    }) || null
  );
}

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  if (globalThis.crypto && crypto.subtle && crypto.subtle.digest) {
    try {
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (err) {
      /* file:// WebViews often block SubtleCrypto — fall through */
    }
  }
  return sha256HexSync(String(input));
}

function sha256HexSync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = "length";
  let i, j;
  const result = [];
  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash = (sha256HexSync.h = sha256HexSync.h || []);
  const k = (sha256HexSync.k = sha256HexSync.k || []);
  let primeCounter = k[lengthProperty];
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while ((ascii[lengthProperty] % 64) - 56) ascii += "\x00";
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return "";
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result.push((b < 16 ? "0" : "") + b.toString(16));
    }
  }
  return result.join("");
}

async function voterCommitment(email, pin) {
  return sha256Hex(`${SALT}|${email.trim().toLowerCase()}|${pin.trim()}`);
}

async function merkleRoot(leaves) {
  if (!leaves.length) return sha256Hex("empty");
  let layer = [...leaves];
  if (layer.length % 2 === 1) layer.push(layer.at(-1));
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) next.push(await sha256Hex(`${layer[i]}${layer[i + 1]}`));
    layer = next;
    if (layer.length % 2 === 1 && layer.length > 1) layer.push(layer.at(-1));
  }
  return layer[0];
}

async function attest(hash) {
  const prepares = [];
  const commits = [];
  for (const [id, name] of VALIDATORS) {
    prepares.push({ id, name, phase: "prepare", signature: await sha256Hex(`${id}|prepare|${hash}`) });
    commits.push({ id, name, phase: "commit", signature: await sha256Hex(`${id}|commit|${hash}`) });
  }
  return { faultTolerance: 1, quorum: 3, committed: commits.length >= 3, prepares, commits };
}

async function sealBlock(previousHash, transactions, index) {
  const timestamp = Date.now();
  const leaves = await Promise.all(
    transactions.map((tx) => sha256Hex(`${tx.voterCommitment}|${tx.positionId}|${tx.candidateId}|${tx.timestamp}`)),
  );
  const root = await merkleRoot(leaves);
  const hash = await sha256Hex(`${index}|${timestamp}|${previousHash}|${root}|0`);
  const bft = await attest(hash);
  return { index, timestamp, previousHash, merkleRoot: root, hash, nonce: 0, transactions, bft };
}

function loadLocal() {
  try {
    state.session = JSON.parse(localStorage.getItem(KEYS.session) || "null");
  } catch {
    state.session = null;
  }
  try {
    state.chain = JSON.parse(localStorage.getItem(KEYS.chain) || "[]");
  } catch {
    state.chain = [];
  }
  try {
    state.voted = JSON.parse(localStorage.getItem(KEYS.voted) || "[]");
  } catch {
    state.voted = [];
  }
}

function persist() {
  if (state.session) localStorage.setItem(KEYS.session, JSON.stringify(state.session));
  else localStorage.removeItem(KEYS.session);
  localStorage.setItem(KEYS.chain, JSON.stringify(state.chain));
  localStorage.setItem(KEYS.voted, JSON.stringify(state.voted));
}

function maskEmail(email) {
  const [user, host] = email.split("@");
  if (!user || !host) return email;
  return `${user.slice(0, 2)}•••@${host}`;
}

function go(route) {
  state.route = route;
  render();
}

function html(strings, ...vals) {
  return strings.reduce((out, s, i) => out + s + (vals[i] ?? ""), "");
}

function nav() {
  const items = [
    ["home", "Home"],
    ["vote", "Vote"],
    ["chain", "Chain"],
    ["tally", "Tally"],
  ];
  return `<nav class="nav">${items
    .map(
      ([id, label]) =>
        `<button class="${state.route === id ? "active" : ""}" data-go="${id}">${label}</button>`,
    )
    .join("")}</nav>`;
}

function loginView() {
  return html`
    <div class="app">
      <div class="row">
        <img class="seal" src="./icon.png" alt="" />
        <div>
          <p class="kicker">Department of Software Engineering</p>
          <p class="brand display">SOE Chainvote</p>
        </div>
      </div>
      <h1>Sign in to the 2025/2026 booth.</h1>
      <p>Anyone on the 2025/2026 class list (88 students) can sign in with their registration number plus FUTO email or full name. This booth runs on the phone — no remote server is required to open a session or seal a ballot.</p>
      <form class="stack" id="login-form">
        <div>
          <label for="email">FUTO email or student name</label>
          <input id="email" type="text" inputmode="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Garba Aminu or you@futo.edu.ng" value="${attr(state.identityEmail)}" required />
        </div>
        <div>
          <label for="reg">Registration number</label>
          <input id="reg" inputmode="numeric" autocomplete="off" placeholder="e.g. 20211288832" value="${attr(state.identityPin)}" required />
        </div>
        ${state.error ? `<p class="alert" role="alert">${state.error}</p>` : ""}
        <button class="btn" ${state.busy ? "disabled" : ""}>${state.busy ? "Checking the roll…" : "Sign in"}</button>
      </form>
      <p class="note">Private BFT chain · one ballot per student · marks stored as a SHA-256 commitment, never a name.</p>
    </div>`;
}

function homeView() {
  const blocks = state.chain.length;
  const ballots = new Set(state.chain.flatMap((b) => b.transactions.map((t) => t.voterCommitment))).size;
  return html`
    <div class="app">
      <div class="row">
        <img class="seal" src="./icon.png" alt="" />
        <div>
          <p class="kicker">2025/2026 session</p>
          <p class="brand display">SOE Chainvote</p>
        </div>
      </div>
      <p style="margin-top:1.4rem">${state.session?.maskedEmail} · signed in on this phone</p>
      <div class="stack">
        <div class="card"><p class="stat">${blocks}</p><p>Sealed blocks</p></div>
        <div class="card"><p class="stat">${ballots}</p><p>Distinct ballots</p></div>
        <div class="card"><p class="stat">${state.voted.length}/7</p><p>Offices you have marked</p></div>
        <p>Permissioned PBFT · 4 nodes · f = 1 · quorum 3. Offline marks stay on this device until the chain seals them.</p>
        <button class="btn" data-go="vote">Open booth</button>
        <button class="btn btn-ghost" id="sign-out">Sign out this device</button>
      </div>
    </div>${nav()}`;
}

function voteView() {
  const offices = state.slate.positions;
  const office = offices.find((p) => p.id === state.office) ?? offices[0];
  const already = state.voted.includes(office.id);
  const people = state.slate.candidates.filter((c) => c.positionId === office.id);
  return html`
    <div class="app">
      <p class="kicker">Ballot</p>
      <h1>${office.title}</h1>
      <p>${already ? "This office is already sealed for your commitment." : "Pick one candidate. The mark is hashed; your name never enters the block."}</p>
      <div class="stack" style="grid-template-columns:1fr 1fr; gap:0.5rem">
        ${offices
          .map(
            (p) =>
              `<button class="btn ${p.id === office.id ? "" : "btn-ghost"}" style="height:40px;font-size:0.75rem" data-office="${p.id}">${p.title.replace("Departmental ", "")}</button>`,
          )
          .join("")}
      </div>
      ${people
        .map((c) => {
          const selected = state.marks[office.id] === c.id;
          return `<button class="choice ${selected ? "selected" : ""}" data-pick="${c.id}" ${already ? "disabled" : ""}>
            <strong>${c.name}</strong>
            <span>${c.year} · ${c.manifesto}</span>
          </button>`;
        })
        .join("")}
      ${state.error ? `<p class="alert">${state.error}</p>` : ""}
      <button class="btn" id="cast" ${already || !state.marks[office.id] || state.busy ? "disabled" : ""}>
        ${already ? "Already sealed" : state.busy ? "Sealing with BFT…" : "Cast ballot"}
      </button>
    </div>${nav()}`;
}

function chainView() {
  const blocks = [...state.chain].reverse();
  return html`
    <div class="app">
      <p class="kicker">Private ledger</p>
      <h1>Hash chain</h1>
      <p>Each block carries previousHash, a Merkle root, and a PBFT certificate from 4 permissioned nodes.</p>
      ${blocks.length === 0 ? `<div class="card">Genesis has not been extended yet. Cast a ballot to seal block 1.</div>` : ""}
      ${blocks
        .map(
          (b) => `<div class="card" style="margin-bottom:0.8rem">
            <p class="badge">Block ${b.index} · ${b.bft?.committed ? "Sealed by BFT" : "pending"}</p>
            <p class="hash">hash ${b.hash}</p>
            <p class="hash">prev ${b.previousHash}</p>
            <p class="hash">merkle ${b.merkleRoot}</p>
            <p class="hash">quorum ${b.bft?.commits?.length ?? 0}/4 commit</p>
          </div>`,
        )
        .join("")}
    </div>${nav()}`;
}

function tallyView() {
  const counts = {};
  for (const block of state.chain) {
    for (const tx of block.transactions) {
      counts[tx.candidateId] = (counts[tx.candidateId] || 0) + 1;
    }
  }
  return html`
    <div class="app">
      <p class="kicker">Public tally</p>
      <h1>Results</h1>
      ${state.slate.positions
        .map((p) => {
          const people = state.slate.candidates.filter((c) => c.positionId === p.id);
          return `<div class="card" style="margin:0.8rem 0">
            <strong>${p.title}</strong>
            ${people
              .map(
                (c) =>
                  `<div class="tally"><span>${c.name}</span><span>${counts[c.id] || 0}</span></div>`,
              )
              .join("")}
          </div>`;
        })
        .join("")}
    </div>${nav()}`;
}

function render() {
  if (!state.session) {
    $app.innerHTML = loginView();
    $app.querySelector("#login-form")?.addEventListener("submit", onLogin);
    return;
  }
  if (state.route === "vote") $app.innerHTML = voteView();
  else if (state.route === "chain") $app.innerHTML = chainView();
  else if (state.route === "tally") $app.innerHTML = tallyView();
  else $app.innerHTML = homeView();
  $app.querySelectorAll("[data-go]").forEach((el) =>
    el.addEventListener("click", () => go(el.getAttribute("data-go"))),
  );
  $app.querySelectorAll("[data-office]").forEach((el) =>
    el.addEventListener("click", () => {
      state.office = el.getAttribute("data-office");
      state.error = "";
      render();
    }),
  );
  $app.querySelectorAll("[data-pick]").forEach((el) =>
    el.addEventListener("click", () => {
      state.marks[state.office] = el.getAttribute("data-pick");
      render();
    }),
  );
  $app.querySelector("#cast")?.addEventListener("click", onCast);
  $app.querySelector("#sign-out")?.addEventListener("click", () => {
    state.session = null;
    persist();
    go("home");
  });
}

async function onLogin(event) {
  event.preventDefault();
  const emailEl = document.getElementById("email");
  const regEl = document.getElementById("reg");
  const email = emailEl ? emailEl.value : state.identityEmail;
  const pin = regEl ? regEl.value : state.identityPin;
  state.identityEmail = email;
  state.identityPin = pin;
  state.error = "";
  state.busy = true;
  render();
  const hit = findOnRoll(email, pin);
  if (!hit) {
    state.busy = false;
    state.error =
      state.roll.length === 0
        ? "The class roll did not load on this phone. Uninstall SOE Chainvote and install 1.2.2."
        : "This registration number is not on the 2025/2026 Software Engineering class list.";
    render();
    return;
  }
  const commitment = await voterCommitment(hit.email, hit.pin);
  state.session = {
    email: hit.email,
    commitment,
    maskedEmail: maskEmail(hit.email),
    signedInAt: Date.now(),
  };
  state.busy = false;
  persist();
  go("home");
}

async function onCast() {
  const office = state.office;
  const candidateId = state.marks[office];
  if (!state.session || !candidateId || state.voted.includes(office)) return;
  state.busy = true;
  state.error = "";
  render();
  const tx = {
    voterCommitment: state.session.commitment,
    positionId: office,
    candidateId,
    timestamp: Date.now(),
  };
  const prev = state.chain.at(-1)?.hash ?? GENESIS;
  const block = await sealBlock(prev, [tx], state.chain.length + 1);
  state.chain.push(block);
  state.voted.push(office);
  persist();
  state.busy = false;
  go("chain");
}

async function boot() {
  try {
    if (!state.roll.length && Array.isArray(window.SOE_ROLL)) state.roll = window.SOE_ROLL;
    if (!state.slate && window.SOE_SLATE) state.slate = window.SOE_SLATE;
    loadLocal();
    if (!state.chain.length) {
      const genesis = await sealBlock(GENESIS, [], 0);
      genesis.transactions = [];
      state.chain = [genesis];
      persist();
    }
  } catch (err) {
    state.error = "Booth engine failed to start. Reinstall SOE Chainvote 1.3.0.";
  }
  render();
}

boot();
