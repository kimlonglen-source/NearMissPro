import { MarketingLayout } from '../components/MarketingChrome';

// Short About page. Tells prospects who's behind the product and
// why it exists — builds trust before they hand over an email.
export function AboutPage() {
  return (
    <MarketingLayout title="About NearMissPro">
      <h2>Built by a pharmacy owner, for pharmacy owners</h2>
      <p>NearMissPro is an independent New Zealand product, built by a community pharmacy owner who got tired of the gap between the near-miss logbook on the dispensary bench and the continuous-quality-improvement (CQI) work the Pharmacy Council expects of every pharmacy.</p>

      <p>The problem with paper isn't paper. It's that the logbook captures incidents and then sits there. The patterns are invisible. The monthly review is rebuilt from scratch every time. And the "did our actions work?" question — the actual heart of CQI — is almost impossible to answer.</p>

      <p>NearMissPro started as a tool used in one pharmacy. It works there. We're now making it available to other NZ community pharmacies who want the same closed-loop process without building it themselves.</p>

      <h2>What we believe</h2>
      <ul>
        <li><strong>Anonymous reporting is non-negotiable.</strong> Staff won't surface what they're worried about being blamed for. The whole product is built around this.</li>
        <li><strong>Plain English beats jargon.</strong> If your tech doesn't understand it, it won't get used.</li>
        <li><strong>Prevention is the point.</strong> Audit-readiness is a side effect of good practice, not the goal.</li>
        <li><strong>Small pharmacies deserve good tools.</strong> Most enterprise software is priced for chains. We're priced for independents.</li>
      </ul>

      <h2>Where we're going</h2>
      <p>For now, NearMissPro is a one-person operation. That means responsive support direct from the founder and a roadmap that follows real pharmacist feedback — not a venture-funded feature factory.</p>

      <p>If you'd like to be part of the early adopter group, <a href="/#trial">start your free trial</a> or email <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a>.</p>
    </MarketingLayout>
  );
}
