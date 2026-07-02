# NearMissPro — Legal Review Pack

**For:** a NZ commercial / IT / privacy lawyer
**From:** Kim Longlen, NearMissPro (hello@nearmisspro.co.nz)
**Status:** Pre-launch. No paying customers yet. This pack exists so the documents can be reviewed **before the first pharmacy (even a free trial) puts real data in.**

This single document contains everything, in this order:

1. Overview & the specific questions for the lawyer
2. Data-handling summary (one page)
3. Privacy Policy
4. Terms of Service
5. Data breach response plan

---
---

# 1. Overview & questions for the lawyer

## What NearMissPro is, in one paragraph

NearMissPro is a web app for New Zealand community pharmacies to record **dispensing near misses** — mistakes caught *before* the medicine reaches the patient — and turn them into a monthly continuous-quality-improvement (CQI) review, which the Pharmacy Council expects pharmacies to run. It is deliberately **not** for dispensing *errors* that reached a patient (those go to the pharmacy's own Pharmacy Council / HDC / indemnity process). Near-miss records are **anonymous to the team** — the app does not record which staff member logged each entry.

## Why I'm getting review now

I'm about to let the **first pharmacies use it on a free 3-month trial.** I understand a free trial does not reduce my privacy obligations — the moment a trial pharmacy logs real data, I'm holding their information (and potentially, by accident, patient health information). I want the documents right before that happens.

## The specific things I need a lawyer to check

These are the points I'm genuinely unsure about — the highest-value use of your time:

1. **AI / cross-border disclosure (my biggest worry).** When AI is enabled, each near miss's drug name, error type, and contributing factors are sent to Anthropic's Claude API (servers in the US) to generate a recommendation. No patient identifiers are sent by design. **Is this a "disclosure" of information under IPP 11/12 of the Privacy Act 2020 that needs specific consent, and is my Privacy Policy wording enough?** Some NZ pharmacies using AI have run into breach issues — I want to be on the right side of this.

2. **Who is the "agency" vs the "processor".** I treat the pharmacy as the agency responsible for anything their staff enters (including patient info entered by mistake), and NearMissPro as processing on their behalf. **Is that split correct under the Privacy Act 2020 and the Health Information Privacy Code 2020, and is it properly reflected in the Terms and Privacy Policy?**

3. **Offshore storage.** The database is Supabase, hosted in Australia (Sydney). **Does storing NZ pharmacy data in Australia trigger any IPP 12 disclosure/consent requirement, and is my disclosure of that adequate?**

4. **Data Processing Agreements.** I have **not** yet signed formal DPAs with my sub-processors (Supabase, Anthropic, Stripe). **Do I need them in place before a trial pharmacy loads real data, or before the first paying customer?**

5. **Clinical liability.** The app labels every AI suggestion "advisory only — the pharmacist-in-charge makes all decisions," and the Terms repeat this. **Is that disclaimer + the liability cap (clause 9 of the Terms) enough to protect me if a pharmacy claims a recommendation contributed to harm?**

6. **Free-trial terms.** During the trial there's no payment. **Are the Terms enforceable against a non-paying trial user, and is there anything specific to add for the trial period?**

7. **Consumer law.** Customers are businesses (pharmacies). **Do the Consumer Guarantees Act 1993 / Fair Trading Act 1986 apply, and does my liability limitation hold given they're B2B?**

## What I am NOT asking you to review yet

Billing/subscription mechanics, refunds, and Stripe payment terms — I'm not charging anyone during the trial, so those can wait until I convert the first pharmacy to paid.

---
---

# 2. Data-handling summary (one page)

*Plain-English snapshot of what data the app holds and how it's treated.*

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

---
---

# 3. Privacy Policy

*Last updated: 18 June 2026*

**Plain English first:** we collect as little as we need to run the service. Near misses are anonymous to the team. We do not sell your data, ever. This is a draft (v1) being reviewed by counsel before our public launch.

## Who we are

NearMissPro ("we", "us", "our") is a near-miss reporting tool for NZ community pharmacy, operated from New Zealand. For privacy questions, email hello@nearmisspro.co.nz.

## The data we collect

**Account information**
- Pharmacy name and password
- Manager's email address
- Optional: pharmacy address and licence number

**Usage data (entered by your team)**
- Near-miss records: drug names, error types, time of day, contributing factors, free-text notes
- Reports your manager generates
- Pattern interventions ("we moved the methadone register" etc.)

**Near-miss records are anonymous to the team.** The system does not record which staff member submitted each entry. This is by design — anonymous reporting raises the quality of the data and protects the staff member who reported.

**Technical data**
- IP address, browser type, basic access logs (used for security and abuse prevention)
- A session token in your browser's localStorage so you stay logged in

## Health Information Privacy Code 2020

The Health Information Privacy Code 2020 (HIPC) applies to identifiable health information. NearMissPro deliberately avoids collecting patient-identifying information: the recording form has no patient fields, and the notes field has an automatic patient-info check that flags accidental NHI numbers, dates of birth, phone numbers, or names as you type. We treat the pharmacy as the agency responsible for any information your staff enters in error, and we will help you redact or delete it on request.

## How we use your data

- To provide the service (capture, analyse, report)
- To generate AI recommendations (if you have AI enabled — see below)
- To send you the occasional email about your account or material product changes (never marketing emails to your staff)
- To investigate misuse or security incidents

## Who processes your data on our behalf

- **Supabase** — our database and authentication provider. Data is stored in the region you select at sign-up (we default to Australia/Sydney for NZ customers).
- **Anthropic** — if you have AI enabled, the drug names, error types, and contributing factors for each near miss are sent to Anthropic's Claude API to generate the recommendation. Anthropic does not use your data to train its models when accessed via API. You can turn AI off entirely; the product works without it.
- **Payment processor (Stripe)** — only collects card details from the billing manager, not the staff. We never see card numbers.

We have not signed Data Processing Agreements with these providers under NZ law yet (we will before the first paying customer). All three are reputable providers with their own published privacy commitments.

## Your rights

Under the Privacy Act 2020 you can:
- Access the data we hold about you or your pharmacy
- Ask us to correct anything that's wrong
- Ask us to delete your account and all associated near-miss data
- Complain to the Office of the Privacy Commissioner (privacy.org.nz) if you believe we've mishandled your data

Email hello@nearmisspro.co.nz for any of these. We aim to respond within five working days.

## Data retention

We keep your data while your account is active. After cancellation, we keep it for 12 months in case you reactivate, then permanently delete it. You can request immediate deletion on cancellation.

## Security

- Data in transit is encrypted (HTTPS).
- Data at rest in Supabase is encrypted.
- Access is restricted to the pharmacy that owns the data.
- Passwords are hashed (we never see them in plain text).
- We back up the database daily via Supabase.

**If we discover that data has been accessed without authorisation**, we'll notify the dispensary email on your account within 72 hours, describe what was accessed, and tell you what we're doing about it. Serious breaches will also be reported to the Office of the Privacy Commissioner as required by the Privacy Act 2020.

## Cookies

We don't use tracking cookies or third-party analytics. The only storage we use in your browser is a session token (in localStorage) so you stay logged in.

## Children

NearMissPro is for use by adult pharmacy staff. We do not knowingly collect data from anyone under 16.

## Changes to this policy

We may update this policy as the product evolves. Material changes will be notified by email and the date at the top of this page will update.

*Draft v1 — under review by counsel before our public launch. Questions: hello@nearmisspro.co.nz.*

---
---

# 4. Terms of Service

*Last updated: 18 June 2026*

**Plain English first:** these are the rules for using NearMissPro. By signing up or using the service, you agree to them. This is a draft (v1) being reviewed by counsel before our public launch — when the reviewed version replaces this one we'll note the change date at the top.

## 1. Who we are

NearMissPro ("we", "us", "our") is a near-miss reporting and continuous-quality-improvement tool for New Zealand community pharmacy. The service is operated from New Zealand. You can reach us at hello@nearmisspro.co.nz.

## 2. The service

NearMissPro lets your pharmacy capture near misses, generate monthly review reports, and track whether changes you've made are reducing recurrence. It is a record-keeping and analysis tool. **It does not give clinical advice and is not a substitute for the professional judgement of the pharmacist-in-charge.** Every recommendation is advisory; the manager makes all decisions.

## 3. Your account

- One pharmacy account covers all staff at that pharmacy.
- You are responsible for keeping your pharmacy password secure and for any actions taken under your account.
- If you suspect unauthorised access, email hello@nearmisspro.co.nz and we'll reset access.

## 4. Free trial, subscription, and billing

- Your first three months are free. No payment method is required during the trial.
- After the trial, the subscription is $30 NZD per month per pharmacy, or $300 NZD per year (saving $60). All prices exclude GST where applicable; we'll display the GST-inclusive price clearly when we collect payment.
- Subscriptions auto-renew until cancelled.
- You can cancel at any time. If you cancel mid-month, you keep access for the remainder of that month; we do not refund partial months.
- Annual subscriptions are not refunded for unused months unless we materially change the service to your disadvantage.

## 5. Acceptable use

- Use NearMissPro only for its intended purpose: tracking near misses in your pharmacy.
- Do not enter patient-identifying information (names, NHI numbers, dates of birth, phone numbers) into the notes field. The product includes an automatic check that flags this as you type, but the responsibility is yours.
- Do not attempt to access another pharmacy's data, scrape the site, or interfere with the service.
- Do not resell or sub-license the service.

## 6. Your data

Your near-miss records, reports, and audit log entries are **yours**. We hold them as a processor on your behalf. You can request an export or full deletion at any time by emailing us — see our Privacy Policy for details.

## 7. Service availability

We aim for high availability but do not guarantee uninterrupted service. Scheduled maintenance, third-party outages (Supabase, hosting providers), and unforeseen issues can cause downtime. We will work to restore service as quickly as practical.

## 8. Disclaimer

NearMissPro is provided "as is". We do not warrant that the service will be error-free or that the AI-generated recommendations will be appropriate for every situation. The pharmacist-in-charge remains responsible for every dispensing decision.

## 9. Limitation of liability

To the extent permitted by law, our total liability to you for any claim arising out of or relating to the service is limited to the fees you paid us in the twelve months before the event giving rise to the claim. We are not liable for indirect, consequential, or special losses. Nothing in these terms limits your statutory rights under the New Zealand Consumer Guarantees Act 1993 where they apply.

## 10. Termination

You can cancel anytime from Settings. We can suspend or terminate accounts that breach these terms, with reasonable notice where practical.

## 11. Changes to these terms

We may update these terms from time to time. Material changes will be notified by email and shown at the top of this page. Continued use after the change means you accept the new terms.

## 12. Governing law

These terms are governed by the laws of New Zealand. Disputes are subject to the jurisdiction of New Zealand courts.

*Draft v1 — under review by counsel before our public launch. Questions: hello@nearmisspro.co.nz.*

---
---

# 5. Data breach response plan

*My internal playbook for what to do if pharmacy data is accessed, lost, or exposed without authorisation. Aligned to the Privacy Act 2020's notifiable-breach rules.*

## Who is responsible

**Privacy Officer: Kim Longlen** (hello@nearmisspro.co.nz).
The Privacy Act 2020 requires every business holding personal information to have at least one privacy officer. That's me. If I'm unavailable, the breach still has to be handled — so this plan is written to be followable by anyone I hand it to.

## What counts as a breach

Any of these:
- Someone accesses a pharmacy's data who shouldn't have (e.g. a leaked password or key, one pharmacy seeing another's data)
- Data is lost, deleted, or made unavailable when it shouldn't be
- Data is sent to the wrong person (e.g. a report emailed to the wrong pharmacy)
- A sub-processor (Supabase, Anthropic, Zoho, Stripe) tells me *they* had a breach affecting my data

## The five steps

### 1. Contain — *straight away*
- Stop the leak. Depending on what happened: rotate the leaked key/password, revoke the affected login token, take the affected part of the service offline, or pull the wrong email back if possible.
- If I can't do it alone, this is the moment I call my technical maintainer (once I have one) — not later.

### 2. Assess — *same day*
Work out **what** was exposed, **whose** it was, and **how bad**. Write it down as I go. The key legal test is:

> **Is this breach likely to cause "serious harm" to anyone?**

Consider: was patient-identifiable information involved (it shouldn't be, by design, but staff can enter it by mistake in notes)? How sensitive is it? Could it lead to identity theft, embarrassment, or safety risk? How many people/pharmacies are affected?

### 3. Notify — *as soon as practicable if serious harm is likely*
If the breach **is likely to cause serious harm**, the Privacy Act 2020 says I **must** notify:
- **The Office of the Privacy Commissioner** — via the NotifyUs tool at privacy.org.nz. Do this as soon as practicable, don't sit on it.
- **The affected pharmacy/pharmacies** — to the dispensary email on their account. Tell them plainly: what happened, what was exposed, what I'm doing about it, and what they should do (e.g. change their password). My Privacy Policy commits me to doing this within 72 hours.
- **Affected individuals**, if any identifiable person's information was exposed and it's practical to reach them (usually via the pharmacy).

If serious harm is **not** likely, notification isn't legally required — but I'll still tell the affected pharmacy, because trust matters more than the legal minimum.

*When in doubt about "serious harm," notify. Under-notifying is the bigger risk.*

### 4. Record — *within a few days*
Keep a written record of the breach even if I decided not to notify: what happened, when, what I assessed, what I decided and why, and what I did. The Privacy Commissioner can ask to see this.

### 5. Review — *within two weeks*
Ask: how did this happen, and what stops it happening again? Fix the root cause (a code change, a process change, a new safeguard).

## Quick contacts

- **Office of the Privacy Commissioner** — privacy.org.nz, NotifyUs online form, 0800 803 909
- **Supabase support** — dashboard support / status page (for database or hosting incidents)
- **My technical maintainer** — *[fill in once engaged]*
- **My lawyer** — *[fill in once engaged]*

## The one-line version to keep in my head

**Stop it → work out how bad → if serious harm is likely, tell the Privacy Commissioner and the pharmacy fast → write it down → fix the cause.**

---

*End of pack.*
