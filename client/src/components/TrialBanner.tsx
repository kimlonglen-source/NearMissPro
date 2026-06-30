import { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// Trial-end nudge that sits above every authenticated page. Only
// renders when the pharmacy is in trial and within 14 days of the
// end. Colour ramps from blue (14–8d) to amber (7–4d) to red (≤3d)
// so the manager can't miss the last week. Subscribe goes to a
// mailto rather than a hosted checkout — first paying customers are
// hand-walked, no Stripe yet.
export function TrialBanner() {
  const { role } = useAuth();
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!role || role === 'founder') return;
    api.getMe().then(me => {
      setTrialEndsAt(me.trialEndsAt || null);
      setSubscriptionStatus(me.subscriptionStatus || null);
    }).catch(() => {});
  }, [role]);

  if (!trialEndsAt || subscriptionStatus !== 'trial') return null;

  const endMs = new Date(trialEndsAt).getTime();
  if (!Number.isFinite(endMs)) return null;
  const daysRemaining = Math.ceil((endMs - Date.now()) / 86400000);
  if (daysRemaining > 14) return null;

  const endLabel = new Date(trialEndsAt).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  let tone: 'blue' | 'amber' | 'red';
  let message: string;
  if (daysRemaining <= 0) {
    tone = 'red';
    message = `Your free trial ended on ${endLabel}. Reply to our email to keep using NearMissPro.`;
  } else if (daysRemaining <= 3) {
    tone = 'red';
    message = `Your free trial ends ${daysRemaining === 1 ? 'tomorrow' : `in ${daysRemaining} days`} (${endLabel}). Your account will become read-only after that.`;
  } else if (daysRemaining <= 7) {
    tone = 'amber';
    message = `Your free trial ends in ${daysRemaining} days (${endLabel}). Let us know if you'd like to subscribe.`;
  } else {
    tone = 'blue';
    message = `Your free trial ends in ${daysRemaining} days (${endLabel}).`;
  }

  const palette = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', icon: 'text-blue-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', icon: 'text-amber-600' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: 'text-red-600' },
  }[tone];
  const Icon = tone === 'red' ? AlertTriangle : Clock;

  return (
    <div className={`${palette.bg} ${palette.text} border-b ${palette.border} px-4 py-2.5 no-print`}>
      <div className="max-w-5xl mx-auto flex items-center gap-3 text-sm">
        <Icon size={16} className={palette.icon} />
        <span className="flex-1">{message}</span>
        <a
          href="mailto:hello@nearmisspro.co.nz?subject=Subscribe%20to%20NearMissPro"
          className="font-medium underline whitespace-nowrap"
        >
          {daysRemaining <= 0 ? 'Reactivate →' : 'Subscribe →'}
        </a>
      </div>
    </div>
  );
}
