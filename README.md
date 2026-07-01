# ScoreXI — Live Cricket Scoring

A live cricket scoring web app: ball-by-ball scoring for admins, real-time
read-only scorecards/stats for everyone else. Built for an office cricket
tournament (e.g. the CData Premier League), but works for any short-format
cricket tournament — the app can host multiple tournaments over time.

## Live

- **App**: https://cric18.vercel.app
- **API**: https://scorexi-api.onrender.com
- **Database**: Neon (PostgreSQL, free tier)

Hosted entirely on free tiers (Vercel + Render + Neon). The one tradeoff:
Render's free web service sleeps after ~15 minutes of no traffic, so the
first request after a quiet spell can take 30-60 seconds to wake it back up
before scoring or viewing responds. Worth remembering right before a match —
open the site a minute or two early to warm it up.

## Stack

- **Backend**: Node.js + Express + Socket.IO + Prisma (PostgreSQL)
- **Frontend**: React + Vite + Tailwind CSS
- Plain JavaScript throughout (no TypeScript build step), to keep local setup friction-free.

## Features

- Tournament setup: create tournaments, teams, squads (with player roles), and schedule matches with a configurable overs limit.
- Toss, opening lineup, and full ball-by-ball scoring: runs, wides, no-balls (with free-hit-style extra ball), byes, leg byes, and all standard wicket types (bowled, caught, lbw, run out, stumped, hit wicket, retired).
- Automatic strike rotation, over completion, forced new-bowler selection (can't bowl consecutive overs), forced new-batsman selection after a wicket.
- Live scoreboard, current-over ticker, batting/bowling scorecards, fall of wickets, required run rate / runs needed when chasing.
- Tournament points table (with Net Run Rate) and batting/bowling leaderboards, computed from match results.
- Real-time updates over Socket.IO — every viewer (public or admin) watching a match sees scores update instantly, no refresh needed.
- Single shared admin password — multiple scorers can be logged in and entering the same match at once. The server treats the ball log as the source of truth and rejects a ball submission with a "state changed, please refresh" error if another scorer already recorded the next ball, so two people can't double-enter the same delivery.
- Fully responsive, light corporate UI in a CData.com-inspired theme (navy/blue/teal) — usable on a phone at the boundary and on a laptop for the admin dashboard.
- Net Run Rate in the points table, computed per the ICC convention (a side bowled out inside its overs is deemed to have used its full quota for its own run-rate calculation).
- A live score preview on match cards for in-progress matches, updating in real time without opening the match.
- A Manhattan-style runs-per-over chart on every match page, comparing both innings with wickets marked.
- Installable as a PWA — "Add to Home Screen" on a phone gives it an app icon and a full-screen, native-like window. Live data always hits the network; only the app shell is cached.
- Every route on the backend is wrapped so an unexpected error returns a proper error response instead of crashing the whole server — important for a shared production deployment.

## Project layout

```
cpl-scorer/
  server/       Express API + Socket.IO + Prisma/PostgreSQL
  client/       React + Vite + Tailwind frontend
  render.yaml   Render Blueprint (backend deploy config)
```

## Getting started (local)

Requires Node.js 20+ and a PostgreSQL database (a free Neon project works well, or a local Postgres instance).

### 1. Backend

```
cd server
npm install
cp .env.example .env      # fill in DATABASE_URL / JWT_SECRET / ADMIN_PASSWORD
npx prisma migrate dev    # applies the schema to your database
npm run dev                # http://localhost:4001
```

### 2. Frontend

```
cd client
npm install
npm run dev                # http://localhost:5173
```

Open `http://localhost:5173` in a browser. To score from a phone on the same
office WiFi, open `http://<your-laptop-ip>:5173` on the phone instead — Vite
already binds to all network interfaces (`host: true` in `vite.config.js`),
and the client auto-detects the API host from the page URL when no
`VITE_API_URL` is set.

### Admin login

The shared password is set in `server/.env` as `ADMIN_PASSWORD` (and in the
Render dashboard for production). Anyone with the password can create
tournaments and score matches — there's no per-user login, by design, so
multiple people can co-score a match with the same credentials.

## How scoring works

1. Create a tournament, add teams, add players to each team's squad.
2. Schedule a match (pick two teams + overs limit).
3. From the match row, click **Set up & Score** → run the toss → set the
   opening striker/non-striker/bowler → start scoring.
4. Tap runs, extras, or **Wicket** for each ball. When an over ends you'll be
   prompted for the next bowler (can't repeat the last one); when a wicket
   falls you'll be prompted for the next batsman.
5. When the first innings ends, click **Start 2nd Innings**, set the new
   openers, and chase the target — the app shows runs needed and required
   run rate automatically.
6. The match auto-completes (with a "won by N runs/wickets" or "tied" result)
   as soon as the target is chased down, the side is bowled out, or overs run
   out.

Use **Undo Last Ball** to fix a mis-tap — it removes the most recent ball and
recomputes everything (including reopening the match if it had already been
marked complete).

Deleting a player or team that already has recorded match balls is blocked
with a clear error, to prevent accidentally erasing match history. Deleting
a whole tournament cascades and removes everything under it.

## Deployment

Already live on free tiers — here's how it's wired, and how to redeploy:

- **Database (Neon)**: PostgreSQL connection string lives in `DATABASE_URL`.
  Schema changes: edit `server/prisma/schema.prisma`, run
  `npx prisma migrate dev --name <description>` locally against the same
  `DATABASE_URL` to create a migration, commit it, then push — Render's
  build step runs `prisma migrate deploy` automatically on every deploy.
- **Backend (Render)**: auto-deploys from the `main` branch of the GitHub
  repo per `render.yaml`. Environment variables (`DATABASE_URL`,
  `JWT_SECRET`, `ADMIN_PASSWORD`, `CLIENT_ORIGIN`) are set in the Render
  dashboard, not committed to the repo.
- **Frontend (Vercel)**: auto-deploys from the same branch, root directory
  set to `client`. `VITE_API_URL` is set in the Vercel project's environment
  variables and must point at the Render backend URL.

To ship a change: commit and push to `main` — both Render and Vercel rebuild
automatically.

## Known limitations

- Render's free tier sleeps the backend after ~15 minutes idle (see "Live"
  above) — a small VM or a paid tier removes this if it becomes annoying.
- No playing-XI enforcement — any player in a team's squad can be selected
  to bat/bowl/field at any time. Good enough for an informal office
  tournament; add XI selection if you need it.
- No DRS/super-over/retired-and-return edge cases — the scoring engine
  covers everything a normal limited-overs match needs, not every rule in
  the laws of cricket.
