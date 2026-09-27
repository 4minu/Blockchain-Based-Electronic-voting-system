# SOE Chainvote

Blockchain-based electronic voting for the **Department of Software Engineering**, Federal University of Technology, Owerri — **2025/2026 session**.

Live app: [soe-onchain-vote.grok.me](https://soe-onchain-vote.grok.me)

## What it is

Students on the departmental class roll authenticate with FUTO email and registration number. A one-time code is sent to the student mailbox (Outlook / Microsoft 365). After sign-in they can:

- Read the election and candidate manifestos
- Cast one ballot (online)
- Cast offline if the network drops — the vote is stored on the device and sealed when connectivity returns
- Inspect the public hash-chain ledger
- Read the live tally

Votes are **hashed and linked**. Each sealed ballot is a block with a Merkle root of its marks. Tampering breaks the chain. Emails and registration numbers are hashed at rest; they never appear on the public pages.

## Offices (2025/2026)

| Office | Candidates |
| --- | --- |
| President | Garba Aminu, Ugwumba Akachukwu Mac-Anointed |
| Vice President | Eke Queen-Elizabeth Ikwunma, Onyeukwu Light Onyeyirichi |
| General Secretary | Nnoli Temple Chibeze, Uche Chichebem Janefrances |
| Treasurer | Opara Chinasa Jessica, Ikeh-ezeji Pamela Chinaza |
| Director of Socials | Nwakanma Dominion Chinonso, Chidi-Azuwike Shalom Ebere |
| Director of Sports | Iyogwoya Noble David, Eze Kelechi Kelvin |
| Public Relations Officer | Okeke Prosper-Chinecherem Prince, Nduka Mmesoma Kenechi |

Eligible voters are the Software Engineering class list. Sign-in uses student email + registration number. If Outlook delivery is blocked from the booth, the last six digits of the registration number confirm identity. The generated code is never shown on screen.

## Stack

- React 19, TanStack Start / Router
- Tailwind v4
- Postgres (Neon in production, embedded PGLite in local preview)
- Permissioned hash-chain ledger (application-level blockchain)

## Run locally

```bash
npm install
npm run dev
```

Requires Node 22. Set `DATABASE_URL` to a Postgres connection string for a durable store. Without it, the app uses an in-memory Postgres (PGLite) so the booth still runs.

```bash
npm run typecheck
npm run build
```

## Architecture (short)

1. **Roll check** — email + registration number must match the class list.
2. **OTP** — a six-digit code is hashed and stored; delivery targets `@futo.edu.ng`.
3. **Session** — httpOnly cookie, hashed token, 12-hour expiry.
4. **Ballot** — one mark per office. Choices are hashed with a salt, merklized, and appended as the next block (`prev_hash` + `merkle_root` + `block_hash`).
5. **Receipt** — the voter gets a receipt hash; the public ledger never shows who voted for whom.
6. **Offline** — if the peer is unreachable, the ballot is queued in `localStorage` and synced when the chain is reachable again.

This is a **permissioned** chain: the electoral server is the coordinating peer. It is not a public proof-of-work network. Integrity comes from hash linking, Merkle roots, and a public audit log — not from mining.

## License

MIT — see [LICENSE](LICENSE).
