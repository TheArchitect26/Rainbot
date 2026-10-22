# Self-hosted community rankings

## What is implemented

A shared Express + SQLite service and in-game World Rankings screen. Players opt in with a public nickname and a device-local anonymous access token. No email, payments or external account provider is required. Ranked runs use a server-issued ticket and the server's UTC daily seed. Best distance determines rank; equal distances tie. The board shows the top 50, the participant's own rank even outside that list, and the total number of ranked players. Today and all-time views are separate. Only runs under the current rules version compete together.

Normal Play Run, tutorial and daily practice work offline without the service. Only **Start ranked daily** creates a ranked run. Pause/resume retains its ticket; quitting or restarting returns to practice. A failed submission leaves local rewards intact and offers Retry. Submission retries are idempotent. Offline runs cannot be submitted retroactively.

**Hosting has not been selected or deployed.** Rankings are shared only among clients connected to the same running service/database. Local integration tests do not make a public leaderboard live.

## Run locally

Requires Node **24+** with built-in `node:sqlite`. The web-only toolchain still supports the documented Vite requirements, but the server and full test suite need Node 24. No additional dependency or database installation is needed.

From the repository root:

```sh
npm ci
npm run build
SERVE_WEB=true LEADERBOARD_DB=./data/leaderboard.sqlite npm run leaderboard:serve
```

Internally check `http://127.0.0.1:8787/api/leaderboard/health`, then load the game from that same server to exercise the production web bundle. Health should return `ok: true` and rules `challenge-4`. This is a local development endpoint, not a public deployment.

For Vite development, run the service and `npm run dev` in separate terminals. Vite proxies `/api/leaderboard` to port 8787. Allow the exact development origin if your proxy rewrites Host:

```sh
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 npm run leaderboard:serve
npm run dev
```

Playwright starts its own in-memory service on 8787, Vite on 3100 and a production preview on 3200. Stop an existing service using 8787 before `npm run test:browser`. Tests do not touch the normal database.

## Deploy after choosing a host

1. Use one Node 24 service with a persistent local disk. Install the repository with `npm ci`, build with `npm run build`, and run `SERVE_WEB=true npm run leaderboard:serve` from the repository root. Use a process supervisor to restart it after failure.
2. Set `HOST=0.0.0.0` only when the hosting platform requires an externally bound process. Expose it through a trusted HTTPS reverse proxy. Set `PORT` to the platform's port, and `LEADERBOARD_DB` to a writable persistent path, for example `/var/lib/rainbot/leaderboard.sqlite`.
3. Set `ALLOWED_ORIGINS` to the exact public web origin and, for Capacitor Android, `https://localhost`. For an iOS build also consider its configured Capacitor origin. No wildcard is used. Set `TRUST_PROXY_HOPS` only to the actual number of trusted reverse-proxy hops; leave it unset for direct connections.
4. Keep web/API on the same origin, or build the client with `VITE_LEADERBOARD_URL=https://your-host/api/leaderboard`. The `VITE_` value is public configuration, never a secret. For Android, an absolute HTTPS URL is required before `npm run android:sync`, then build the APK as in [ANDROID.md](ANDROID.md). A native build without it explicitly reports that online rankings are not connected.
5. Check health over HTTPS, join from two distinct browser profiles/devices, finish ranked runs and confirm both see the same ordering. Restart the service and confirm the board persists. Test daily rollover, rejected origins, network loss/retry, offline practice and a real Android client.

Do not use an ephemeral filesystem, several independent SQLite copies, or multiple replicas with separate volumes: those would split the rankings. This is a single-instance service suitable for an initial small community, not a claim of large-scale readiness. For growth, move storage to a shared transactional database and load-test it.

Use the SQLite backup API/CLI backup command, or stop the service before copying its SQLite/WAL/SHM files together. Protect backups and the persistent directory; no access tokens or database files should enter Git. Anonymous tokens are stored hashed server-side, but loss of a client's stored token currently has no recovery flow. Public nicknames are not verified identities. Retention, account deletion and moderation policies must be chosen before a public launch; an operator can delete a player's scores, tickets and player row in that order using the player's public ID.

## Validation and limitations

The server authenticates writes, limits request size/rate, checks the current rules version, ticket ownership/expiry and elapsed-time/distance bounds, and consumes a run once. It computes ranks and difficulty tiers itself. Coins and local XP are never trusted for global ranking.

**These are basic plausibility checks, not replay verification or comprehensive anti-cheat.** A modified client can still fabricate plausible results. This leaderboard is for casual community testing; do not attach prizes or claims of cheat-proof competition. Competitive launch needs authoritative simulation or deterministic input replay validation, abuse monitoring and moderation. TLS, persistent storage and hosting operations remain deployment responsibilities.

Automated HTTP tests cover multiple players, bad names/auth, rejected origins, forged timing/distance, old rules, idempotent replays, ties, daily rollover, ticket expiry and real database restart. Browser tests cover opt-in, the server-seeded game path, collision/game-over submission, and service-unavailable fallback. No public service or physical-device network test has been performed.
