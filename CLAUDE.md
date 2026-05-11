# NearMissPro — context for Claude

This file is read automatically at the start of every session. It exists so the user (the pharmacy owner) doesn't have to re-explain themselves each time.

## Who the user is

- Non-technical NZ community pharmacy owner.
- Building NearMissPro to use in his own pharmacy first, then potentially sell to other NZ pharmacies.
- Runs the app **locally on his MacBook** at `localhost:5173` via `npm run dev`. No hosted deploy — his Mac is the server.
- Works from his **own terminal**. He runs `git pull` / `git push` himself; the assistant's commits land on GitHub and he pulls them down.
- Comfortable with copy-paste commands, but unfamiliar with: branches, merging, deploying, env files, what GitHub is for. Explain in plain English. No jargon. If you must use a term, explain it inline.

## What NearMissPro is

A near-miss reporting tool for NZ community pharmacy. **Near miss only** — events caught BEFORE the medicine reached the patient. If the patient received it, it's a dispensing error and goes to a different process (Pharmacy Council / CARM / HDC / indemnity). This distinction is enforced by a patient-reached gate at the start of recording.

Goal: turn anonymous near-miss logs into a regulator-friendly CQI (continuous quality improvement) cycle — capture → analyse → act → measure → repeat.

## Tech stack

- React + TypeScript + Vite (client/)
- Express + TypeScript (server/)
- Supabase Postgres (database)
- Anthropic Claude API for per-incident recommendations and period summary
- PWA — no email/SMS infrastructure

## Setup quirks specific to this user

- His `server/.env` may or may not exist on his Mac — the assistant cannot see it directly (different filesystem). Always have him `cat server/.env` before suggesting changes that could overwrite it.
- Founder password is hardcoded `founder123` (dev mode). Founder email comes from `FOUNDER_EMAIL` in `server/.env`. MFA accepts any 6 digits in dev.
- Manager access is an in-app upgrade from staff, not a separate login. Optionally PIN-gated via Settings.

## Working branch

`claude/start-nearmiss-pro-tKacP` — all real work lives here. `main` is ~20+ commits behind and unused. **Do NOT push to main directly** (blocked by repo settings); if a merge to main is ever needed, open a PR.

## Hard rules — non-negotiable

1. **Say "near miss"** in user-facing text, never "error" (an error implies it reached the patient).
2. **Plain English** everywhere. NZ shop-floor language: script, dispensary software, checking pharmacist, Pharmac brand, NHI, CAL.
3. **No feature creep.** Don't add features, abstractions, or polish the user didn't ask for. Three big features were built then **reverted entirely** because they added complexity: Safety Score (0–100 number), Action Tracking (per-incident task list), Smart Nudges (home-screen prompt cards). Don't reintroduce that shape of feature.
4. **No emojis** unless he asks.
5. **Don't push to main.** Push to the working feature branch only.
6. **Default to no comments.** Only comment to explain WHY when it isn't obvious — never WHAT.
7. Per-incident decisions are made by the manager **during review**. The team meeting agenda is for **system-level changes only**.

## What's built (high level)

- Patient-reached gate at start of recording
- Smart drug autocomplete (pharmacy history + bundled ~200 NZ Pharmac drugs)
- High-risk drug warnings (insulin, warfarin, methotrexate, opioids, NTI drugs)
- Hotspot panel + mid-month repeat-pattern banner with one-tap action logging
- PHI scanner on the notes field (flags NHI, DOB, phone, full names)
- Dashboard: stats, trend strip, plain-English incident headlines, inline Accept/Modify/No-change/Void
- Dedicated `/voided` page with Restore
- Period report: At-a-glance / Summary / Last period improvements / heatmap / pattern alerts / weekly trend / incident log / action plan agenda / sign-off table
- AI per-incident recommendations + period summary (NZ-grounded, plain language)
- Settings tabs: Security (PIN), Password, Pharmacy size (sole/tech/multi — shapes AI advice), Audit log (expandable for details)
- Auto-save on blur for the three editable report fields

## Compliance anchors

Pharmacy Council NZ, Medsafe, HQSC, Te Whatu Ora, NZ Formulary, NZULM, Pharmac, Misuse of Drugs Act/Regulations.

## Deferred (don't build unless he asks)

- CARM-export helper (decided unnecessary — voluntary)
- Structured tracking of agreed system changes on the report
- Onboarding tour
- PDF export (currently relies on browser Print)
- Search/filter on long lists
- Real dispensary-software integration
- Replace `founder123` with a real founder accounts table (security debt before any real deploy)

## How to update this file

If something significant changes that future-you would benefit from knowing, edit this file and commit it. Keep it tight — facts the next session needs, not a status log.
