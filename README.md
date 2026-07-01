# Boundary — Live Cricket Scoring

A live cricket scoring web app: ball-by-ball scoring for admins, real-time
read-only scorecards/stats for everyone else. Built for an office cricket
tournament (e.g. the CData Premier League), but works for any short-format
cricket tournament — the app can host multiple tournaments over time.

## Stack

- **Backend**: Node.js + Express + Socket.IO + Prisma (SQLite by default)
- **Frontend**: React + Vite + Tailwind CSS
- Plain JavaScript throughout (no TypeScript build step), to keep local setup friction-free.

## Features

- Tournament setup: create tournaments, teams, squads (with player roles), and schedule matches with a configurable overs limit.
- Toss, opening lineup, and full ball-by-ball scoring: runs, wides, no-balls (with free-hit-style extra ball), byes, leg byes, and all standard wicket types (bowled, caught, lbw, run out, stumped, hit wicket, retired).
- Automatic strike rotation, over completion, forced new-bowler selection (can't bowl consecutive overs), forced new-batsman selection after a wicket.
- Live scoreboard, current-over ticker, batting/bowling scorecards, fall of wickets, required run rate / runs needed when chasing.
- Tournament points table and batting/bowling leaderboards, computed from match results.
- Real-time updates over Socket.IO — every viewer (public or admin) watching a match sees scores update instantly, no refresh needed.
- Single shared admin password — multiple scorers can be logged in and entering the same match at once. The server treats the ball log as the source of truth and rejects a ball submission with a "state changed, please refresh" error if another scorer already recorded the next ball, so two people can't double-enter the same delivery.
- Fully responsive, light corporate UI in a CData.com-inspired theme (navy/blue/teal) — usable on a phone at the boundary and on a laptop for the admin dashboard.
- Net Run Rate in the points table, computed per the ICC convention (a side bowled out inside its overs is deemed to have used its full quota for its own run-rate calculation).
- A live score preview on match cards for in-progress matches, updating in real time without opening the match.
- A Manhattan-style runs-per-over chart on every match page, comparing both innings with wickets marked.
- Installable as a PWA — "Add to Home Screen" on a phone gives it an app icon and a full-screen, native-like window. Live data (scores, uploads) always hits the network; only the app shell is cached.

## Project layout

```
cpl-scorer/
  server/   Express API + Socket.IO + Prisma/SQLite
  client/   React + Vite + Tailwind frontend
```

## Getting started (local)

Requires Node.js 20+.

### 1. Backend

```
cd server
npm install
cp .env.example .env      # edit ADMIN_PASSWORD / JWT_SECRET if you like
npx prisma migrate dev    # creates dev.db and applies the schema
npm run dev                # http://localhost:4000
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
and the client auto-detects the API host from the page URL.

### Admin login

The default password is `cpl2026` (set in `server/.env` as `ADMIN_PASSWORD`).
Change it before a real tournament. Anyone with the password can create
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

## Deploying beyond your laptop

The app is deploy-ready with small changes:

- **Database**: swap `provider = "sqlite"` for `"postgresql"` in
  `server/prisma/schema.prisma`, point `DATABASE_URL` at a real Postgres
  instance, and re-run `npx prisma migrate dev`. Everything else (routes,
  scoring engine) is database-agnostic.
- **Backend**: deploy `server/` anywhere that runs Node (Render, Railway, a
  small VM). Set `CLIENT_ORIGIN`, `JWT_SECRET`, and `ADMIN_PASSWORD` as real
  environment variables.
- **Frontend**: `npm run build` in `client/` produces static files
  (`client/dist`) you can host anywhere (Netlify, Vercel, S3, or served by
  the backend itself). Set `VITE_API_URL` at build time to point at your
  deployed API.

## Known limitations

- SQLite is a single file (`server/prisma/dev.db`) — fine for one laptop
  scoring a live match, but back it up (or move to Postgres) before you rely
  on it for a real tournament, since an unclean process kill can in rare
  cases corrupt an in-progress SQLite write.
- No playing-XI enforcement — any player in a team's squad can be selected
  to bat/bowl/field at any time. Good enough for an informal office
  tournament; add XI selection if you need it.
- No DRS/super-over/retired-and-return edge cases — the scoring engine
  covers everything a normal limited-overs match needs, not every rule in
  the laws of cricket.
