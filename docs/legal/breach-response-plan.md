# NearMissPro — data breach response plan

*My internal playbook for what to do if pharmacy data is accessed, lost, or exposed without authorisation. Written in plain English so I can follow it under pressure. Aligned to the Privacy Act 2020's notifiable-breach rules. This should be reviewed by the lawyer along with the other documents.*

---

## Who is responsible

**Privacy Officer: Kim Longlen** (hello@nearmisspro.co.nz).
The Privacy Act 2020 requires every business holding personal information to have at least one privacy officer. That's me. If I'm unavailable, the breach still has to be handled — so this plan is written to be followable by anyone I hand it to.

## What counts as a breach

Any of these:
- Someone accesses a pharmacy's data who shouldn't have (e.g. a leaked password or key, one pharmacy seeing another's data)
- Data is lost, deleted, or made unavailable when it shouldn't be
- Data is sent to the wrong person (e.g. a report emailed to the wrong pharmacy)
- A sub-processor (Supabase, Anthropic, Zoho, Stripe) tells me *they* had a breach affecting my data

---

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
- **The Office of the Privacy Commissioner** — via the NotifyUs tool at [privacy.org.nz](https://www.privacy.org.nz). Do this as soon as practicable, don't sit on it.
- **The affected pharmacy/pharmacies** — to the dispensary email on their account. Tell them plainly: what happened, what was exposed, what I'm doing about it, and what they should do (e.g. change their password). My Privacy Policy commits me to doing this within 72 hours.
- **Affected individuals**, if any identifiable person's information was exposed and it's practical to reach them (usually via the pharmacy).

If serious harm is **not** likely, notification isn't legally required — but I'll still tell the affected pharmacy, because trust matters more than the legal minimum.

*When in doubt about "serious harm," notify. Under-notifying is the bigger risk.*

### 4. Record — *within a few days*
Keep a written record of the breach even if I decided not to notify: what happened, when, what I assessed, what I decided and why, and what I did. The Privacy Commissioner can ask to see this.

### 5. Review — *within two weeks*
Ask: how did this happen, and what stops it happening again? Fix the root cause (a code change, a process change, a new safeguard). Note it in the audit trail / this repo.

---

## Quick contacts

- **Office of the Privacy Commissioner** — privacy.org.nz, NotifyUs online form, 0800 803 909
- **Supabase support** — dashboard support / status page (for database or hosting incidents)
- **My technical maintainer** — *[fill in once engaged]*
- **My lawyer** — *[fill in once engaged]*

---

## The one-line version to keep in my head

**Stop it → work out how bad → if serious harm is likely, tell the Privacy Commissioner and the pharmacy fast → write it down → fix the cause.**
