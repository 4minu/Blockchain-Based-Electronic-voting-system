# SOE Chainvote

Mobile-first private blockchain voting for the **Software Engineering Departmental Elections**, FUTO — **2025/2026 session**.

## How it works

1. **Sign in online** with your FUTO student email and registration number (the class roll).
2. The session **stays on the device** (30 days). You do not sign in again to vote.
3. **Vote offline.** Marks are stored on the phone.
4. When the network returns, queued ballots are **sealed by PBFT** (4 permissioned nodes, f = 1, quorum 3).

Presidential slate: **Garba Aminu** and **Ugwumba Akachukwu Mac-Anointed**.

## Sign in

Use the FUTO email on the class list **or** the Outlook form `firstname.lastname@futo.edu.ng`, plus your registration number. Digits, slashes, or dashes in the reg number all work.

Examples that all open the same booth for Garba Aminu:

- `garbaaminu.20211288832@futo.edu.ng` / `20211288832`
- `garba.aminu@futo.edu.ng` / `2021/1288832`
- `garbaaminu` / `20211288832`

## Android APK

The `android/` folder is a WebView wrapper. A debug APK is produced by GitHub Actions on every push (`SOE-Chainvote` artifact) and can be sideloaded:

1. Download `SOE-Chainvote.apk` from the latest Actions run (or Releases).
2. On the phone: Settings → Security → allow install from this source.
3. Open the APK. The launcher uses the Software Engineering seal.
4. Sign in once while online. After that the booth stays signed in for offline voting.

```bash
cd android
./gradlew assembleDebug
# output: app/build/outputs/apk/debug/app-debug.apk
```

## Run the web booth

```bash
npm install
npm run dev
```

## Licence

See [LICENSE](LICENSE).
