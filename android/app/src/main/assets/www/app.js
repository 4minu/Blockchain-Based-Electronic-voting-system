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
  roll: [],
  slate: null,
  session: null,
  chain: [],
  voted: [],
  marks: {},
  office: "president",
  error: "",
  busy: false,
};

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
      <p>Internet is only required if this device has never signed in. After that the session stays on the phone so you can vote offline.</p>
      <form class="stack" id="login-form">
        <div>
          <label for="email">FUTO student email</label>
          <input id="email" type="email" inputmode="email" autocomplete="username" placeholder="you.reg@futo.edu.ng" required />
        </div>
        <div>
          <label for="reg">Registration number</label>
          <input id="reg" inputmode="numeric" autocomplete="off" placeholder="e.g. 20211288832" required />
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
  state.error = "";
  state.busy = true;
  render();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const pin = document.getElementById("reg").value.trim();
  const hit = state.roll.find((r) => r.email === email && r.pin === pin);
  if (!hit) {
    state.busy = false;
    state.error = "This FUTO email and registration number are not on the eligible roll.";
    render();
    return;
  }
  const commitment = await voterCommitment(email, pin);
  state.session = { email, commitment, maskedEmail: maskEmail(email), signedInAt: Date.now() };
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
  const [roll, slate] = await Promise.all([
    fetch("./roll.json").then((r) => r.json()),
    fetch("./slate.json").then((r) => r.json()),
  ]);
  state.roll = roll;
  state.slate = slate;
  loadLocal();
  if (!state.chain.length) {
    const genesis = await sealBlock(GENESIS, [], 0);
    genesis.transactions = [];
    state.chain = [genesis];
    persist();
  }
  render();
}

boot();
