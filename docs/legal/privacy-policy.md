# Privacy Policy

*Last updated: 18 June 2026*

> This is a text copy of the live `/privacy` page in the app, for review. If the two ever differ, the in-app page is authoritative.

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

---

*Draft v1 — under review by counsel before our public launch. Questions: hello@nearmisspro.co.nz.*
