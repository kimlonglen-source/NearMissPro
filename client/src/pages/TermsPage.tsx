import { MarketingLayout } from '../components/MarketingChrome';

// Plain-English terms of service. Draft v1 — written to be enough
// for trial sign-ups and Stripe account approval; should be reviewed
// by a NZ commercial / IT lawyer before the first paying customer.
export function TermsPage() {
  return (
    <MarketingLayout title="Terms of Service" subtitle="Last updated: 18 June 2026">
      <p><strong>Plain English first:</strong> these are the rules for using NearMissPro. By signing up or using the service, you agree to them. This is a draft (v1) being reviewed by counsel before our public launch — when the reviewed version replaces this one we'll note the change date at the top.</p>

      <h2>1. Who we are</h2>
      <p>NearMissPro ("we", "us", "our") is a near-miss reporting and continuous-quality-improvement tool for New Zealand community pharmacy. The service is operated from New Zealand. You can reach us at <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a>.</p>

      <h2>2. The service</h2>
      <p>NearMissPro lets your pharmacy capture near misses, generate monthly review reports, and track whether changes you've made are reducing recurrence. It is a record-keeping and analysis tool. <strong>It does not give clinical advice and is not a substitute for the professional judgement of the pharmacist-in-charge.</strong> Every recommendation is advisory; the manager makes all decisions.</p>

      <h2>3. Your account</h2>
      <ul>
        <li>One pharmacy account covers all staff at that pharmacy.</li>
        <li>You are responsible for keeping your pharmacy password secure and for any actions taken under your account.</li>
        <li>If you suspect unauthorised access, email <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a> and we'll reset access.</li>
      </ul>

      <h2>4. Free trial, subscription, and billing</h2>
      <ul>
        <li>Your first three months are free. No payment method is required during the trial.</li>
        <li>After the trial, the subscription is $30 NZD per month per pharmacy, or $300 NZD per year (saving $60). All prices exclude GST where applicable; we'll display the GST-inclusive price clearly when we collect payment.</li>
        <li>Subscriptions auto-renew until cancelled.</li>
        <li>You can cancel at any time. If you cancel mid-month, you keep access for the remainder of that month; we do not refund partial months.</li>
        <li>Annual subscriptions are not refunded for unused months unless we materially change the service to your disadvantage.</li>
      </ul>

      <h2>5. Acceptable use</h2>
      <ul>
        <li>Use NearMissPro only for its intended purpose: tracking near misses in your pharmacy.</li>
        <li>Do not enter patient-identifying information (names, NHI numbers, dates of birth, phone numbers) into the notes field. The product includes an automatic check that flags this as you type, but the responsibility is yours.</li>
        <li>Do not attempt to access another pharmacy's data, scrape the site, or interfere with the service.</li>
        <li>Do not resell or sub-license the service.</li>
      </ul>

      <h2>6. Your data</h2>
      <p>Your near-miss records, reports, and audit log entries are <strong>yours</strong>. We hold them as a processor on your behalf. You can request an export or full deletion at any time by emailing us — see our <a href="/privacy">Privacy Policy</a> for details.</p>

      <h2>7. Service availability</h2>
      <p>We aim for high availability but do not guarantee uninterrupted service. Scheduled maintenance, third-party outages (Supabase, hosting providers), and unforeseen issues can cause downtime. We will work to restore service as quickly as practical.</p>

      <h2>8. Disclaimer</h2>
      <p>NearMissPro is provided "as is". We do not warrant that the service will be error-free or that the AI-generated recommendations will be appropriate for every situation. The pharmacist-in-charge remains responsible for every dispensing decision.</p>

      <h2>9. Limitation of liability</h2>
      <p>To the extent permitted by law, our total liability to you for any claim arising out of or relating to the service is limited to the fees you paid us in the twelve months before the event giving rise to the claim. We are not liable for indirect, consequential, or special losses. Nothing in these terms limits your statutory rights under the New Zealand Consumer Guarantees Act 1993 where they apply.</p>

      <h2>10. Termination</h2>
      <p>You can cancel anytime from Settings. We can suspend or terminate accounts that breach these terms, with reasonable notice where practical.</p>

      <h2>11. Changes to these terms</h2>
      <p>We may update these terms from time to time. Material changes will be notified by email and shown at the top of this page. Continued use after the change means you accept the new terms.</p>

      <h2>12. Governing law</h2>
      <p>These terms are governed by the laws of New Zealand. Disputes are subject to the jurisdiction of New Zealand courts.</p>

      <hr />
      <p><em>Draft v1 — under review by counsel before our public launch. Questions: <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a>.</em></p>
    </MarketingLayout>
  );
}
