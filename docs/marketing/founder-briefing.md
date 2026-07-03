# NearMissPro — founder briefing (know your own product)

Everything you need to answer questions confidently and honestly. Golden rule:
never overclaim. "It's pre-launch and I'm getting X reviewed" beats a claim
someone can poke a hole in.

---

## 1. What it is (in one breath)
A tool for NZ community pharmacies to record dispensing NEAR MISSES (caught before
the patient got the medicine), spot the ones that keep repeating, and turn them
into a quick monthly review that helps prevent the next one. Near miss only — if
the medicine reached the patient, that's a dispensing error and goes to the
pharmacy's own Pharmacy Council / HDC / indemnity process, not here.

## 2. Who it's for
NZ community pharmacies — owners, pharmacists, technicians, dispensary managers.
One account per pharmacy, used by the whole team.

## 3. How it works (the full cycle)
1. LOG — any staff, a few taps as it happens. No essay, no name attached.
2. REVIEW — the manager goes through the month's near misses and decides what to
   do about each. For each it suggests a fix (NZ best practice); you accept,
   reword, or "no change needed". The AI only suggests; you decide.
3. MAKE THE CHANGE — you physically do it (move the shelf, add a label). The app
   can't do this bit; it's on you. Done before the meeting so it's already in place.
4. GENERATE — one button turns the month into a plain-English report.
5. MEETING — read the report, look at what keeps coming back, agree bigger
   changes, sign off.
6. NEXT MONTH — the report tells you whether last month's change actually worked.

## 4. What the report contains
- The month at a glance (how many, up or down on last month, where clustering)
- "Did last month's changes work?" (each old problem: gone / less / still happening)
- This month's near misses, each with the action taken
- Sign-off line (record the review happened)

## 5. Key features
- Patient-reached gate at the start (keeps it near-miss only)
- Fast logging with drug autocomplete (pharmacy history + ~200 NZ Pharmac drugs)
- Pharmacy-wide custom chips (add your own options)
- High-risk drug warnings (insulin, warfarin, methotrexate, opioids, NTI drugs)
- Pattern/hotspot detection (surfaces repeats)
- AI recommendations (NZ-grounded, advisory only)
- Monthly report generator (report-to-report comparison)
- Per-pharmacy audit log
- "Download my data" export
- "Delete this pharmacy" request

## 6. The AI — the honest facts
- Optional. You can switch it off completely and STILL get recommendations
  (generated from built-in NZ best-practice logic, nothing leaves the system).
- When on, only the drug name, the type of near miss, and the contributing
  factors are sent to the AI provider (Anthropic). NO patient details, NO staff
  identity.
- Sent via the API, which does NOT use your data to train models, and it isn't
  retained for training.
- Every recommendation is advisory — the pharmacist decides. It doesn't make
  clinical decisions.

## 7. Security & data — the honest facts
- Hosting: Supabase (managed PostgreSQL), in Australia (Sydney). Yes, that's
  overseas from NZ — it's the nearest region the provider offers; Australia has
  comparable privacy law; chosen over US/EU. Open to NZ hosting if it becomes
  available.
- Tenant separation: every request is scoped to the logged-in pharmacy, so one
  pharmacy can't see another's. (Database-level rules being verified in the review.)
- Encryption: in transit (HTTPS) and at rest. Passwords hashed (bcrypt) — never
  stored in plain text.
- Logins from outside the pharmacy: a new device must be approved by email first,
  so a stolen password alone won't get in. Admin login uses app-based 2FA (TOTP).
- Staff 2FA: NOT per-person 2FA — deliberate use of device approval instead
  (better fit for a shared dispensing computer). Don't promise per-staff 2FA.
- Patient details: NOT collected. No patient name / NHI fields anywhere. Near
  misses are anonymous (no record of who logged one). A scanner flags patient
  info accidentally typed into the notes.
- Backups: daily via Supabase — BUT only on the paid (Pro) plan. Confirm you're on
  Pro before claiming daily backups. Retained ~7 days (longer = an add-on).
  A pharmacy's live records don't expire after 7 days — the 7 days is only the
  disaster-recovery snapshots. Records stay as long as they're a customer.
- Audit log: yes, per pharmacy.
- Export / deletion: export all data any time; deleted on request if they leave.

## 8. Privacy & NZ law
- Built around the Privacy Act 2020 and the Health Information Privacy Code 2020
  (which is why it avoids collecting patient info at all).
- Supports the Pharmacy Council's continuous quality improvement (CQI) expectation
  and Health & Safety at Work Act near-miss record-keeping.
- It's a tool to SUPPORT your obligations, not a substitute — and it's NOT
  certified by any regulator. Never claim certification.

## 9. Pricing
- Everyone gets the first 3 months free.
- Then $30 + GST/month per pharmacy, or $300/year (saving $60).
- Auto-renews, cancel anytime, no lock-in.
- Waitlist perk = early access / first to know (NOT a separate free deal, NOT
  co-design — you'll just notify them when it's ready).

## 10. What it does NOT do (say these plainly if asked)
- It can't make the physical change for you (move the shelf etc.) — that's human.
- It needs an internet connection (it's a web app). Speed on a busy day is a real
  priority; "as fast as paper" is the bar (don't claim it's faster than it is).
- It's not certified by a regulator.
- It's pre-launch — being independently reviewed (security + privacy/legal) before
  any real pharmacy data goes in.

## 11. Differentiation (vs the DIY options people suggest)
- vs a paper logbook: the book records; it doesn't spot repeats, write the review,
  or tell you if a change worked.
- vs a Google Form / ChatGPT-made form: those capture data. They don't analyse it,
  write the review, or close the loop — someone still does that by hand each month.
- vs "paste the CSV into ChatGPT": you can, but (a) that puts your pharmacy data
  into consumer AI that can train on it — the exact privacy risk pharmacies are
  warned about; and (b) it's a manual chore every month that won't get done
  consistently. This does it in one click, safely, with the history kept.
- The moat isn't "AI can analyse data". It's: safe, consistent, one-click, and it
  actually happens every month.

## 12. Things NOT to claim (overclaiming = lost trust)
- "Not overseas" (Sydney IS overseas). 
- "Daily backups" unless you're on Supabase Pro.
- "Per-staff 2FA" (it's device approval).
- "Certified" by any regulator.
- "The review does itself" (the write-up is fast; the meeting and the physical fix
  are human).
- "Faster than paper" until logging speed is proven.

## 13. Current status / your pre-launch to-do
- Get an independent security + privacy/legal review before real data goes in.
- Upgrade Supabase to Pro so daily backups are real.
- Line up a developer/maintainer for when pharmacies rely on it.
- Confirm logging speed is genuinely fast (the frontline's key concern).
