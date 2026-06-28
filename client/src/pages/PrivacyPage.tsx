import { MarketingLayout } from '../components/MarketingChrome';

// Plain-English privacy policy. Draft v1 — covers Privacy Act 2020
// and Health Information Privacy Code 2020 basics; should be
// reviewed by a NZ commercial / IT lawyer before the first paying
// customer, particularly the data-flow specifics around AI.
export function PrivacyPage() {
  return (
    <MarketingLayout title="Privacy Policy" subtitle="Last updated: 18 June 2026">
      <p><strong>Plain English first:</strong> we collect as little as we need to run the service. Near misses are anonymous to the team. We do not sell your data, ever. This is a draft (v1) being reviewed by counsel before our public launch.</p>

      <h2>Who we are</h2>
      <p>NearMissPro ("we", "us", "our") is a near-miss reporting tool for NZ community pharmacy, operated from New Zealand. For privacy questions, email <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a>.</p>

      <h2>The data we collect</h2>
      <h3>Account information</h3>
      <ul>
        <li>Pharmacy name and password</li>
        <li>Manager's email address</li>
        <li>Optional: pharmacy address and licence number</li>
      </ul>

      <h3>Usage data (entered by your team)</h3>
      <ul>
        <li>Near-miss records: drug names, error types, time of day, contributing factors, free-text notes</li>
        <li>Reports your manager generates</li>
        <li>Pattern interventions ("we moved the methadone register" etc.)</li>
      </ul>
      <p><strong>Near-miss records are anonymous to the team.</strong> The system does not record which staff member submitted each entry. This is by design — anonymous reporting raises the quality of the data and protects the staff member who reported.</p>

      <h3>Technical data</h3>
      <ul>
        <li>IP address, browser type, basic access logs (used for security and abuse prevention)</li>
        <li>A session token in your browser's localStorage so you stay logged in</li>
      </ul>

      <h2>Health Information Privacy Code 2020</h2>
      <p>The Health Information Privacy Code 2020 (HIPC) applies to identifiable health information. NearMissPro deliberately avoids collecting patient-identifying information: the recording form has no patient fields, and the notes field has an automatic patient-info check that flags accidental NHI numbers, dates of birth, phone numbers, or names as you type. We treat the pharmacy as the agency responsible for any information your staff enters in error, and we will help you redact or delete it on request.</p>

      <h2>How we use your data</h2>
      <ul>
        <li>To provide the service (capture, analyse, report)</li>
        <li>To generate AI recommendations (if you have AI enabled — see below)</li>
        <li>To send you the occasional email about your account or material product changes (never marketing emails to your staff)</li>
        <li>To investigate misuse or security incidents</li>
      </ul>

      <h2>Who processes your data on our behalf</h2>
      <ul>
        <li><strong>Supabase</strong> — our database and authentication provider. Data is stored in the region you select at sign-up (we default to Australia/Sydney for NZ customers).</li>
        <li><strong>Anthropic</strong> — if you have AI enabled, the drug names, error types, and contributing factors for each near miss are sent to Anthropic's Claude API to generate the recommendation. Anthropic does not use your data to train its models when accessed via API. You can turn AI off entirely; the product works without it.</li>
        <li><strong>Payment processor (Stripe)</strong> — only collects card details from the billing manager, not the staff. We never see card numbers.</li>
      </ul>
      <p>We have not signed Data Processing Agreements with these providers under NZ law yet (we will before the first paying customer). All three are reputable providers with their own published privacy commitments.</p>

      <h2>Your rights</h2>
      <p>Under the Privacy Act 2020 you can:</p>
      <ul>
        <li>Access the data we hold about you or your pharmacy</li>
        <li>Ask us to correct anything that's wrong</li>
        <li>Ask us to delete your account and all associated near-miss data</li>
        <li>Complain to the Office of the Privacy Commissioner (<a href="https://www.privacy.org.nz" target="_blank" rel="noopener noreferrer">privacy.org.nz</a>) if you believe we've mishandled your data</li>
      </ul>
      <p>Email <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a> for any of these. We aim to respond within five working days.</p>

      <h2>Data retention</h2>
      <p>We keep your data while your account is active. After cancellation, we keep it for 12 months in case you reactivate, then permanently delete it. You can request immediate deletion on cancellation.</p>

      <h2>Security</h2>
      <ul>
        <li>Data in transit is encrypted (HTTPS).</li>
        <li>Data at rest in Supabase is encrypted.</li>
        <li>Access is restricted to the pharmacy that owns the data.</li>
        <li>Passwords are hashed (we never see them in plain text).</li>
        <li>We back up the database daily via Supabase.</li>
      </ul>
      <p><strong>If we discover that data has been accessed without authorisation</strong>, we'll notify the dispensary email on your account within 72 hours, describe what was accessed, and tell you what we're doing about it. Serious breaches will also be reported to the Office of the Privacy Commissioner as required by the Privacy Act 2020.</p>

      <h2>Cookies</h2>
      <p>We don't use tracking cookies or third-party analytics. The only storage we use in your browser is a session token (in localStorage) so you stay logged in.</p>

      <h2>Children</h2>
      <p>NearMissPro is for use by adult pharmacy staff. We do not knowingly collect data from anyone under 16.</p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy as the product evolves. Material changes will be notified by email and the date at the top of this page will update.</p>

      <hr />
      <p><em>Draft v1 — under review by counsel before our public launch. Questions: <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a>.</em></p>
    </MarketingLayout>
  );
}
