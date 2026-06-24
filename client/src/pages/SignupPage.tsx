import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MarketingLayout } from '../components/MarketingChrome';
import { api } from '../lib/api';
import { CheckCircle2 } from 'lucide-react';

// Public self-serve signup form. Captures everything we need to
// review the application + onboard the pharmacy. Submission creates
// a 'pending_approval' pharmacy row, emails the founder, and
// acknowledges to the pharmacy. The pharmacy can't log in until the
// founder approves and they click the setup link in the approval
// email.
export function SignupPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    pharmacyName: '',
    address: '',
    licenceNumber: '',
    managerName: '',
    pharmacyEmail: '',
    phone: '',
    pharmacySize: '' as '' | 'sole' | 'pharmacist_plus_tech' | 'multi',
    source: '',
    notes: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const valid = !!(form.pharmacyName.trim() && form.address.trim() && form.licenceNumber.trim()
    && form.managerName.trim() && form.pharmacyEmail.trim() && form.phone.trim() && form.pharmacySize);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    setError(''); setLoading(true);
    try {
      await api.pharmacySignup({
        pharmacyName: form.pharmacyName.trim(),
        address: form.address.trim(),
        licenceNumber: form.licenceNumber.trim(),
        managerName: form.managerName.trim(),
        pharmacyEmail: form.pharmacyEmail.trim(),
        phone: form.phone.trim(),
        pharmacySize: form.pharmacySize as 'sole' | 'pharmacist_plus_tech' | 'multi',
        source: form.source.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed — try again or email hello@nearmisspro.co.nz');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <MarketingLayout title="Application received" subtitle="">
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-[#E1F5EE] flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-[#0F6E56]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">We've got your application</h2>
          <p className="text-gray-600 mb-1">Thanks — a confirmation email is on its way to <strong>{form.pharmacyEmail}</strong>.</p>
          <p className="text-gray-600 mb-6">We review every signup by hand. You'll hear back within 1 business day with a link to set your password.</p>
          <p className="text-sm text-gray-500">Not heard from us in 2 business days? Email <a href="mailto:hello@nearmisspro.co.nz" className="text-[#0F6E56] hover:underline">hello@nearmisspro.co.nz</a>.</p>
          <div className="mt-8">
            <button onClick={() => nav('/')} className="btn-teal text-sm">Back to home</button>
          </div>
        </div>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout title="Start your free trial" subtitle="3 months free, no payment method required">
      <p>Tell us about your pharmacy and we'll set you up within 1 business day. We review every signup by hand to keep the platform high-quality.</p>

      {error && (
        <div className="my-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 mt-6 not-prose">
        <Section title="Pharmacy">
          <Field label="Pharmacy name" required>
            <input type="text" required value={form.pharmacyName} onChange={e => setForm({ ...form, pharmacyName: e.target.value })} className="input-field" placeholder="e.g. Riverdale Pharmacy" />
          </Field>
          <Field label="Address" required>
            <input type="text" required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input-field" placeholder="Street, suburb, city" />
          </Field>
          <Field label="NZ Pharmacy Council licence number" required hint="Helps us confirm you're a legitimate NZ community pharmacy.">
            <input type="text" required value={form.licenceNumber} onChange={e => setForm({ ...form, licenceNumber: e.target.value })} className="input-field" />
          </Field>
        </Section>

        <Section title="Pharmacist-in-charge">
          <Field label="Manager name" required>
            <input type="text" required value={form.managerName} onChange={e => setForm({ ...form, managerName: e.target.value })} className="input-field" placeholder="e.g. Sarah Smith" />
          </Field>
          <Field label="Pharmacy email" required hint="Where we'll send password reset links and product updates. Use an inbox the pharmacy controls — not a shared staff one.">
            <input type="email" required value={form.pharmacyEmail} onChange={e => setForm({ ...form, pharmacyEmail: e.target.value })} className="input-field" placeholder="manager@your-pharmacy.co.nz" />
          </Field>
          <Field label="Phone" required hint="So we can call if there's a question on your application.">
            <input type="tel" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="e.g. 021 555 0123" />
          </Field>
        </Section>

        <Section title="Staffing">
          <Field label="How many people are usually on duty?" required>
            <div className="space-y-2">
              {([
                { key: 'sole', label: 'Sole pharmacist', hint: 'One pharmacist on duty, no second checker.' },
                { key: 'pharmacist_plus_tech', label: 'Pharmacist + technician(s)', hint: 'One pharmacist with one or more technicians.' },
                { key: 'multi', label: 'Two or more pharmacists', hint: 'Two or more pharmacists rostered together.' },
              ] as const).map(o => (
                <label key={o.key} className={`block p-3 rounded-lg border cursor-pointer transition ${form.pharmacySize === o.key ? 'border-[#0F6E56] bg-[#F0FAF5]' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="pharmacySize" value={o.key} checked={form.pharmacySize === o.key} onChange={() => setForm({ ...form, pharmacySize: o.key })} className="sr-only" />
                  <div className="font-medium text-gray-900">{o.label}</div>
                  <div className="text-xs text-gray-500">{o.hint}</div>
                </label>
              ))}
            </div>
          </Field>
        </Section>

        <Section title="Optional">
          <Field label="How did you hear about us?">
            <input type="text" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="input-field" placeholder="Colleague, search, PSNZ newsletter…" />
          </Field>
          <Field label="Anything else you'd like us to know?">
            <textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" placeholder="" />
          </Field>
        </Section>

        <div className="pt-4 flex items-center justify-between gap-3 flex-wrap">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">← Back to home</Link>
          <button type="submit" disabled={!valid || loading} className="btn-teal text-sm disabled:opacity-50">
            {loading ? 'Submitting…' : 'Submit application'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 text-center pt-1">
          By submitting you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </form>
    </MarketingLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-800 mb-1">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
