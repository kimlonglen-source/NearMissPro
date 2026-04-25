# NearMissPro — Project State & Session Handoff

> **For Claude (and future-you):** read this top-to-bottom at the start of any new session. It captures everything needed to resume without re-explaining.

---

## TL;DR — How to get the site running

```bash
cd ~/NearMissPro
git fetch origin
git checkout claude/start-nearmiss-pro-tKacP   # the "good" feature-rich branch
git pull
npm run dev
```

Then open **http://localhost:5173**. Login: **Demo Pharmacy** / **demo1234**.

If login fails with a "fetch" or auth error, the server crashed — check Terminal for red text and tell Claude.

---

## Stack & layout

- **Client**: React 18 + Vite 4 + Tailwind + react-router (`client/`)
- **Server**: Node 18 + Express + TypeScript via tsx (`server/`)
- **DB**: Supabase (Postgres) — project ID `bnamleydikytglyqtldn`
- **AI**: Anthropic Claude (key in `server/.env` as `ANTHROPIC_API_KEY` — optional; AI features degrade gracefully without it)
- Dev: client on `:5173`, server on `:4000`, Vite proxies `/api` to the server.

---

## Branches in play

| Branch | Status | What's on it |
|---|---|---|
| `main` | baseline | Older state |
| `claude/start-nearmiss-pro-tKacP` | **the working branch** — use this for the site | Multi-step record form, PHI detection, pattern alerts, interventions, period-summary fix, "Last period improvements" comparison |
| `claude/fix-near-miss-issues-W8m0U` | simplification branch | Stripped-down UX. Don't use unless you specifically want the simpler form. |
| `claude/continue-nearmiss-simplification-TZ85G` | based on W8m0U | One extra commit (.gitignore tsbuildinfo) |

**Rule of thumb:** if the user says "the site isn't working right" or "I had more features", switch them to **tKacP**.

---

## Login & secrets — DO NOT paste in chat

`server/.env` (already exists on the user's Mac, never commit it):
```
SUPABASE_URL=https://bnamleydikytglyqtldn.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_…
JWT_SECRET=dev-secret-…
APP_URL=http://localhost:5173
PORT=4000
```

The Supabase secret_key was once pasted in chat — **user should rotate it** in Supabase → Settings → API Keys → Secret keys → Revoke + create new, then update `server/.env` and restart `npm run dev`.

---

## Common gotchas (already-fixed bugs to be aware of)

1. **YYYY-MM-DD coerces to UTC midnight** — when filtering incidents `<= periodEnd`, the last day's incidents were dropped. Fix is to widen the window to `< periodEnd + 1 day` in `server/src/services/ai.ts` (`generatePeriodSummary`). Already on tKacP.
2. **Markdown in AI output** — prompt says "no markdown" but Claude sometimes still emits `**bold**` and `## headers`. If it reappears, add a `stripMarkdown` helper at the AI output points.
3. **Terminal multi-line paste + `read -p`** — pasting a script that contains `read -p "..."` will swallow the next line as the read input. Workaround: don't chain `read` with subsequent commands in a paste; run them in two separate pastes.
4. **`open -e file`** opens TextEdit on Mac — useful for non-coders editing `.env`.

---

## How the user works

- **Not a coder.** Plain English, copy-paste blocks, no jargon.
- On a Mac with Terminal + Supabase tab open.
- Wants things "easy" — pick a sensible default and act, don't ask 5 clarifying questions.
- Confirms decisions with "no preference" — interpret as "you decide, just do it".

---

## When the user says…

- **"Get me on the site"** → confirm `cd ~/NearMissPro`, ensure deps installed (`npm install` in root, client, server), make sure `server/.env` exists, run `npm --prefix server run seed` if pharmacy missing, then `npm run dev`.
- **"Site can't be reached"** → dev server isn't running. They probably hit Ctrl+C or closed Terminal. Run `npm run dev` again.
- **"Login fails"** → Supabase creds wrong in `server/.env`, or schema not applied, or pharmacy not seeded. Check server Terminal for red text.
- **"I had more features / 4 steps / multi-step form"** → switch them to **tKacP** branch. The current W8m0U is the simplified version.
- **"Period summary missing incidents"** → already fixed on tKacP (commit `41cd980`). If they're on a different branch, cherry-pick that commit.
- **"Last period improvements duplicates the period summary"** → fixed on tKacP (commits `c370836`, `417aee1`).

---

## Project conventions

- Client API calls go through `client/src/lib/api.ts` (one place).
- All routes are `/api/*`, behind JWT auth (except `/api/auth/staff/login` and `/api/health`).
- New SQL changes → drop a `supabase/migrate_*.sql` file and tell the user to paste it into Supabase SQL Editor.
- Tailwind utility classes only — no custom CSS-in-JS.
- File icons from `lucide-react`.

---

## Last touched

Date: 2026-04-25.
What I did this session: helped user get the site running locally (deps, .env, seed, dev server). User then asked to switch to tKacP for the richer feature set.
