# NearMissPro — data-handling summary (one page)

*Plain-English snapshot of what data the app holds and how it's treated. Written for a lawyer, but also safe to show a cautious pharmacy owner. Last updated: keep this date current when the app changes.*

---

## What data is collected

**About the pharmacy (account):**
- Pharmacy name and a hashed password
- The dispensary email address (for logins, password resets, and account emails)
- Optional at sign-up: pharmacy address, licence number, manager name/phone, staffing size

**Entered by pharmacy staff (usage):**
- Near-miss records: drug name(s), error type, stage caught, time of day, contributing factors, and a free-text notes field
- Monthly reports the manager generates
- "Interventions" — plain notes on changes made (e.g. "moved the methadone register")

**Technical:**
- IP address and basic access logs (security / abuse prevention)
- A hashed device identifier per browser (to approve trusted devices)
- A login token stored in the browser (so users stay signed in)

## What is deliberately NOT collected

- **No patient-identifying fields.** The recording form has no patient name, NHI, or date-of-birth field.
- **No staff identity on records.** Near misses are anonymous to the team by design — the app does not store who logged each one.
- A patient-info scanner watches the free-text notes and warns the user in real time if they type something that looks like an NHI number, date of birth, phone number, or full name.

## Where it's stored and who can reach it

- **Database:** Supabase (PostgreSQL), hosted in **Australia (Sydney)**.
- **Encryption:** in transit (HTTPS) and at rest (Supabase).
- **Access control:** every request is scoped to the pharmacy that owns the data; one pharmacy can never see another's.
- **Passwords:** hashed with bcrypt; never stored or visible in plain text.
- **Backups:** daily, via Supabase.

## Sub-processors (third parties that touch the data)

| Provider | Role | Data they receive |
|---|---|---|
| **Supabase** (Australia) | Database + authentication | All account and near-miss data |
| **Anthropic** (USA) | AI recommendations — *only if AI is enabled* | Per near miss: drug name, error type, contributing factors. **No patient identifiers.** Not used to train their models when accessed via the API. |
| **Zoho** (mail) | Sends account emails (password resets, device approvals) | Recipient email address + message |
| **Stripe** | Payments — *only once charging begins* | Billing manager's card details; NearMissPro never sees card numbers |

*AI can be turned off entirely; the product works without it. No formal Data Processing Agreements are signed with these providers yet — flagged for the lawyer.*

## Retention and deletion

- Data is kept while the account is active.
- After cancellation: kept 12 months (in case of reactivation), then permanently deleted.
- A pharmacy can request an **export** or **immediate deletion** at any time by email.

## Regulatory frame

- **Privacy Act 2020** — governs personal information; NearMissPro acts on the pharmacy's behalf for data its staff enters.
- **Health Information Privacy Code 2020** — applies to identifiable health information; the app is designed to avoid collecting it.
- **Pharmacy Council of NZ CQI expectations** — the app's purpose is to support the pharmacy's continuous-quality-improvement obligations.
