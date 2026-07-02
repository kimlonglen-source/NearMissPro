# NearMissPro — legal review pack

**For:** a NZ commercial / IT / privacy lawyer
**From:** Kim Longlen, NearMissPro (hello@nearmisspro.co.nz)
**Status:** pre-launch. No paying customers yet. This pack exists so the documents can be reviewed **before the first pharmacy (even a free trial) puts real data in.**

---

## What NearMissPro is, in one paragraph

NearMissPro is a web app for New Zealand community pharmacies to record **dispensing near misses** — mistakes caught *before* the medicine reaches the patient — and turn them into a monthly continuous-quality-improvement (CQI) review, which the Pharmacy Council expects pharmacies to run. It is deliberately **not** for dispensing *errors* that reached a patient (those go to the pharmacy's own Pharmacy Council / HDC / indemnity process). Near-miss records are **anonymous to the team** — the app does not record which staff member logged each entry.

## Why I'm getting review now

I'm about to let the **first pharmacies use it on a free 3-month trial.** I understand a free trial does not reduce my privacy obligations — the moment a trial pharmacy logs real data, I'm holding their information (and potentially, by accident, patient health information). I want the documents right before that happens.

---

## What's in this folder

| File | What it is |
|---|---|
| `README-lawyer-handoff.md` | This file — the map, plus the specific questions I need answered. |
| `data-handling-summary.md` | One page: exactly what data is collected, where it's stored, who can see it, how AI is used. Read this first. |
| `privacy-policy.md` | The Privacy Policy customers see (mirror of the in-app `/privacy` page). |
| `terms-of-service.md` | The Terms customers agree to (mirror of the in-app `/terms` page). |
| `breach-response-plan.md` | My internal step-by-step for a data breach, aligned to the Privacy Act 2020 notification rules. |

> The Privacy Policy and Terms here are text copies of the two live pages in the app (`/privacy` and `/terms`). If they ever differ, the in-app page is the authoritative version.

---

## The specific things I need a lawyer to check

These are the points I'm genuinely unsure about — the highest-value use of your time:

1. **AI / cross-border disclosure (my biggest worry).** When AI is enabled, each near miss's drug name, error type, and contributing factors are sent to Anthropic's Claude API (servers in the US) to generate a recommendation. No patient identifiers are sent by design. **Is this a "disclosure" of information under IPP 11/12 of the Privacy Act 2020 that needs specific consent, and is my Privacy Policy wording enough?** Some NZ pharmacies using AI have run into breach issues — I want to be on the right side of this.

2. **Who is the "agency" vs the "processor".** I treat the pharmacy as the agency responsible for anything their staff enters (including patient info entered by mistake), and NearMissPro as processing on their behalf. **Is that split correct under the Privacy Act 2020 and the Health Information Privacy Code 2020, and is it properly reflected in the Terms and Privacy Policy?**

3. **Offshore storage.** The database is Supabase, hosted in Australia (Sydney). **Does storing NZ pharmacy data in Australia trigger any IPP 12 disclosure/consent requirement, and is my disclosure of that adequate?**

4. **Data Processing Agreements.** I have **not** yet signed formal DPAs with my sub-processors (Supabase, Anthropic, Stripe). **Do I need them in place before a trial pharmacy loads real data, or before the first paying customer?**

5. **Clinical liability.** The app labels every AI suggestion "advisory only — the pharmacist-in-charge makes all decisions," and the Terms repeat this. **Is that disclaimer + the liability cap (clause 9 of the Terms) enough to protect me if a pharmacy claims a recommendation contributed to harm?**

6. **Free-trial terms.** During the trial there's no payment. **Are the Terms enforceable against a non-paying trial user, and is there anything specific to add for the trial period?**

7. **Consumer law.** Customers are businesses (pharmacies). **Do the Consumer Guarantees Act 1993 / Fair Trading Act 1986 apply, and does my liability limitation hold given they're B2B?**

---

## What I am NOT asking you to review yet

Billing/subscription mechanics, refunds, and Stripe payment terms — I'm not charging anyone during the trial, so those can wait until I convert the first pharmacy to paid.
