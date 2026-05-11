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
- **Drug name now required for almost every error type** unless the error is genuinely not about a medicine (wrong patient, NHI mismatch, register not signed, bag mix-up, PSO paperwork). Logic in `client/src/lib/taxonomy.ts:isNonDrugError`.
- High-risk drug warnings (insulin, warfarin, methotrexate, opioids, NTI drugs)
- Hotspot panel + mid-month repeat-pattern banner with one-tap action logging
- PHI scanner on the notes field (flags NHI, DOB, phone, full names)
- Dashboard: stats, trend strip, plain-English incident headlines, inline Accept/Modify/No-change/Void
- Dedicated `/voided` page with Restore
- Period report (`ReportPage.tsx`) restructured into a top-to-bottom meeting script:
  - PERIOD SUMMARY (opening paragraph the manager reads aloud + one inline stats line)
  - WHAT WORKED (PeriodComparison panel split into "Good news" / "Needs attention", capped at 5 rows; notes from last meeting only show if manually typed — auto-fill removed)
  - WHAT TO LOOK AT (pattern alerts + captioned heatmap + captioned trend)
  - NEAR MISSES THIS PERIOD (unified card style; high-risk via red chip + bold red text, NOT a coloured left border)
  - WHAT WE'LL DO (4-item agenda max; item 1 includes "read the Period Summary above aloud")
  - SIGN-OFF (acknowledgement table)
- Every editable field has a `no-print` textarea + `print:block hidden` paragraph sibling, so printing captures full text not the textarea's visible rows.
- AI per-incident recommendations + period summary (NZ-grounded, plain language)
- Settings tabs: Security (PIN), Password, Pharmacy size (sole/tech/multi — shapes AI prompt in `services/ai.ts`), Audit log (expandable rows with plain-English action labels)
- Founder page (`AdminPage.tsx`): Overview / Suggestions / Pharmacies. Audit tab was removed deliberately — regulators inspect the pharmacy, not the vendor; per-pharmacy audit covers them.
- Auto-save on blur for the three editable report fields

## Seed scripts (test data)

Two scripts, both tag rows with `[SEED]` in the notes column for cleanup.

- `npm -w server run seed` — drops 32 near misses spanning 3 months + current month, plus 2 locked historical reports. Atorvastatin pattern decreases 5→3→1→0 to showcase "Did our actions work?".
- `npm -w server run seed-fresh-month` — drops 14 reviewed near misses into the current month and immediately generates a fresh report using the live generator (picks up latest layout + agenda).

Cleanup later in Supabase SQL Editor:
```
delete from incidents where notes like '[SEED]%';
delete from reports where generated_by = 'seed';
```

## DB migrations to apply on a fresh install

In order, in Supabase SQL Editor:
1. `supabase/schema.sql`
2. `supabase/migrate_workflow_stage.sql` (Layer 1/2/3 taxonomy)
3. `supabase/migrate_pharmacy_size.sql` (adds `pharmacy_size` column)
4. `supabase/migrate_rename_pack_to_compliance_pack.sql` (relabels old "pack" rows to "compliance pack")
5. Any other `migrate_*.sql` files in `supabase/`

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
- Founder-level audit-log UI (backend still records everything; tab was removed)
- "Regenerate" button on a report (was built then removed — managers don't actually need it day-to-day)

## Things that bit us — don't repeat

- **JSX text doesn't process JS escape codes.** Writing `⚠` as JSX text renders the literal six characters. Use the actual character (⚠) or wrap in `{'⚠'}`.
- **`cp server/.env.example server/.env` silently overwrites.** Real env values for Supabase live only in the user's `server/.env` — always have him `cat server/.env` first.
- **`npm run dev` runs both client and server.** A crash in the server (e.g. missing Supabase URL after an .env wipe) leaves the client running but the browser shows JSON-parse errors when API calls hit the proxy.
- **The seed script's historical reports have static agendas.** They will NOT reflect changes to the agenda generator. To see current-generator output, run `seed-fresh-month` or generate a new report through the UI.

## How to update this file

If something significant changes that future-you would benefit from knowing, edit this file and commit it. Keep it tight — facts the next session needs, not a status log.
