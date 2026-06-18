import { MarketingLayout } from '../components/MarketingChrome';
import { Mail, MessageSquare, Lock } from 'lucide-react';

// Short Contact page. Single email address, three "use this for X"
// hints. No contact form — direct email is faster, no spam exposure,
// and easier for the recipient (us) to triage on a phone.
export function ContactPage() {
  return (
    <MarketingLayout title="Contact" subtitle="One inbox, one human reading it.">
      <div className="not-prose grid sm:grid-cols-3 gap-4 my-6">
        <Card
          icon={<MessageSquare size={18} />}
          title="Questions or trial"
          body="Setting up a trial, picking a plan, or wanting a demo."
        />
        <Card
          icon={<Mail size={18} />}
          title="Support"
          body="Something broken, confusing, or missing. Tell us so we can fix it."
        />
        <Card
          icon={<Lock size={18} />}
          title="Privacy & data"
          body="Access, correction, or deletion of data we hold for your pharmacy."
        />
      </div>

      <h2>Email</h2>
      <p>One address for all of the above: <a href="mailto:hello@nearmisspro.co.nz">hello@nearmisspro.co.nz</a></p>
      <p>We aim to reply within one New Zealand business day. Real human, not a ticketing bot.</p>

      <h2>Mailing address</h2>
      <p>We're a small independent operation and don't list a physical address publicly yet. We'll publish one here when the company is formally registered.</p>

      <h2>Privacy requests</h2>
      <p>Per our <a href="/privacy">Privacy Policy</a>, you can ask for access, correction, or deletion of your data. Email the address above and we'll respond within five working days.</p>
    </MarketingLayout>
  );
}

function Card({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="w-9 h-9 rounded-lg bg-[#E1F5EE] text-[#0F6E56] flex items-center justify-center mb-3">{icon}</div>
      <p className="font-semibold text-gray-900 mb-1">{title}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
    </div>
  );
}
