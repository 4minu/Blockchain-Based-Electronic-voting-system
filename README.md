# SOE Chainvote

Private **PBFT blockchain** voting for the **Department of Software Engineering**, Federal University of Technology, Owerri — **2025/2026 session**.

Mobile-first departmental booth: sign in once online, stay signed in, vote offline, and sync when the network returns.

## Download the Android APK

**[Download SOE-Chainvote.apk](https://github.com/4minu/Blockchain-Based-Electronic-voting-system/releases/latest/download/SOE-Chainvote.apk)** (~2.6 MB)

Direct file on this repo: [releases/SOE-Chainvote.apk](https://github.com/4minu/Blockchain-Based-Electronic-voting-system/raw/main/releases/SOE-Chainvote.apk)

1. On your phone, open the APK.
2. If Android blocks it, allow **Install unknown apps** for the app you used (Chrome / Files / Drive), then **Install**.
3. Open **Chainvote** and sign in with FUTO email + registration number.

## How to vote

1. **First sign-in needs the internet.** Enter your FUTO student email and registration number (class roll).
2. The booth **stays signed in on the device** for 30 days.
3. **Open booth**, pick one candidate per office, **Cast ballot**.
4. If you have no signal, marks are stored on the phone. When you are back online, four permissioned nodes seal the ballot with **PBFT**.

Try (eligible roll):

```
garbaaminu.20211288832@futo.edu.ng
20211288832
```

To demo offline: tap **Go offline**, vote, then **Go online**. You should see **Sealed by BFT**.

## 2025/2026 offices

| Office | Candidates |
| --- | --- |
| Departmental President | Garba Aminu, Ugwumba Akachukwu Mac-Anointed |
| Vice President | Zainab Abdullahi, Ibrahim Musa |
| General Secretary | Kelvin Okeke, Ngozi Eze |
| Financial Secretary | Fatima Bello, David Nwosu |
| Public Relations Officer | Aisha Mohammed, Emeka Okafor |
| Welfare Director | Blessing Chukwu, Yusuf Lawal |
| Academic Director | Sophia Nnamdi, Patrick Obi |

One ballot per student. The chain and tally stay public. Names and registration numbers never appear on the ledger — only `SHA-256(salt | email | reg number)` commitments.

## Decentralization (private BFT chain)

This is a **permissioned private blockchain**, not Bitcoin or Ethereum. Four independent validators share one hash-linked ledger:

| Node | Role |
| --- | --- |
| Commission | election authority |
| Faculty | departmental oversight |
| Senate | institutional check |
| Audit | independent witness |

**PBFT, f = 1, quorum 3 of 4.** A block is not canonical until three nodes sign **prepare** and **commit**. One faulty node cannot rewrite history.

Each block carries:

- `previousHash` — tamper-evident chain
- Merkle root over the vote transactions
- SHA-256 block hash
- BFT certificate (prepare + commit signatures)

Inspect any block on **Chain**.

## Offline design

```
Internet required  →  class-roll login  →  session on device (30 days)
                                              ↓
                                    vote with or without signal
                                              ↓
                         offline: marks queued on the phone
                                              ↓
                         online again: PBFT seals the block
```

Login is the only step that needs the network, because the class roll lives on the validators. After that, the session, the slate, and pending ballots live on the phone.

## Stack

- React 19, TanStack Start / Router
- Tailwind v4
- Postgres (or embedded PGLite in local preview)
- Permissioned hash-chain + PBFT validators (application-level blockchain)

## Run locally

```bash
npm install
npm run dev
```

Requires Node 22. Set `DATABASE_URL` to a Postgres connection string for a durable store. Without it, the app uses in-memory Postgres (PGLite).

```bash
npm run typecheck
npm run build
```

## License

MIT — see [LICENSE](LICENSE).
