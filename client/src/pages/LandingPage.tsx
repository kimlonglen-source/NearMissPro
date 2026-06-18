import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ShieldIcon } from '../components/Logo';
import { CheckCircle2, ClipboardPlus, BarChart3, FileText, Lock, Loader2 } from 'lucide-react';

// Public marketing landing page. Mounted at "/" for unauthed visitors,
// and at "/about" for everyone (so logged-in users can still reach it
// from the footer if they want to share with another pharmacy).
//
// Mobile-first — most pharmacists will skim this on a phone.
//
// The "Start free trial" form just posts to /api/marketing/trial-signup
// for now. We email back manually to start onboarding until the
// self-serve sign-up flow is built.
export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header />
      <Hero />
      <ThreeSteps />
      <Compliance />
      <Pricing />
      <SignupForm />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldIcon size={28} />
          <span className="font-bold text-lg">
            <span className="text-[#0F6E56]">NearMiss</span>
            <span className="text-gray-900"> Pro</span>
          </span>
        </div>
        <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-[#0F6E56]">
          Log in
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="px-5 py-16 md:py-24 max-w-4xl mx-auto text-center">
      <p className="text-sm font-semibold text-[#0F6E56] uppercase tracking-wide mb-4">For NZ community pharmacy</p>
      <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
        Turn near misses into your team's quality improvement loop.
      </h1>
      <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto mb-8">
        Anonymous reporting in under 60 seconds. Plain-English reports your team actually reads at the monthly meeting. Aligned with Pharmacy Council NZ CQI standards.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        <a href="#trial" className="bg-[#0F6E56] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#0B5A46] transition-colors">
          Start your 3-month free trial
        </a>
        <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-[#0F6E56]">
          See pricing →
        </a>
      </div>
    </section>
  );
}

function ThreeSteps() {
  const steps = [
    {
      icon: <ClipboardPlus size={20} className="text-[#0F6E56]" />,
      title: 'Capture',
      body: 'Staff log near misses in under a minute. Anonymous to the team, structured so the data is useful later. High-risk drugs and repeat patterns are flagged automatically.',
    },
    {
      icon: <BarChart3 size={20} className="text-[#0F6E56]" />,
      title: 'Analyse',
      body: 'Spot recurring drugs, error types, and contributing factors. See whether last month\'s actions actually reduced the patterns they were meant to.',
    },
    {
      icon: <FileText size={20} className="text-[#0F6E56]" />,
      title: 'Report',
      body: 'A one-page printable report the manager reads to the team at the monthly meeting. Auto-fills the period summary, agenda, and what to discuss.',
    },
  ];
  return (
    <section className="px-5 py-16 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map(s => (
            <div key={s.title} className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="w-10 h-10 rounded-lg bg-[#E1F5EE] flex items-center justify-center mb-3">
                {s.icon}
              </div>
              <h3 className="font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Compliance() {
  const items = [
    'Pharmacy Council NZ continuous quality improvement',
    'Medsafe high-risk medicine alerts',
    'HQSC distraction-reduction guidance',
    'Te Whatu Ora Pharmacy Procedures Manual',
    'NZ Formulary / NZULM references',
    'Misuse of Drugs Regulations',
  ];
  return (
    <section className="px-5 py-16 max-w-5xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">Built for NZ regulations</h2>
      <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto">Every recommendation, every audit entry, every report section is grounded in the standards your inspector knows.</p>
      <ul className="grid md:grid-cols-2 gap-3 max-w-2xl mx-auto">
        {items.map(i => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle2 size={18} className="text-[#1D9E75] flex-shrink-0 mt-0.5" />
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="px-5 py-16 bg-gray-50">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-3">Simple pricing</h2>
        <p className="text-gray-600 mb-10">One price per pharmacy. No per-user fees. Cancel anytime.</p>
        <div className="bg-white rounded-2xl border-2 border-[#0F6E56] p-8 inline-block text-left max-w-md w-full">
          <p className="text-sm font-semibold text-[#0F6E56] uppercase tracking-wide mb-2">Per pharmacy</p>
          <p className="text-5xl font-bold mb-1">$30<span className="text-lg font-normal text-gray-500">/month</span></p>
          <p className="text-sm text-gray-500 mb-5">or $300/year (save 17%)</p>
          <ul className="space-y-2 text-sm text-gray-700 mb-6">
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-[#1D9E75] mt-0.5 flex-shrink-0" /> All staff included</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-[#1D9E75] mt-0.5 flex-shrink-0" /> Unlimited near misses + reports</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-[#1D9E75] mt-0.5 flex-shrink-0" /> Full audit log for inspections</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-[#1D9E75] mt-0.5 flex-shrink-0" /> AI-assisted recommendations</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-[#1D9E75] mt-0.5 flex-shrink-0" /> Email support direct from the founder</li>
          </ul>
          <div className="bg-[#E1F5EE] text-[#085041] text-sm font-semibold px-4 py-2 rounded-lg text-center">
            First 3 months free — no card required
          </div>
        </div>
      </div>
    </section>
  );
}

function SignupForm() {
  const [email, setEmail] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || state === 'submitting') return;
    setState('submitting'); setErrMsg('');
    try {
      await api.trialSignup(email.trim(), pharmacyName.trim() || undefined, notes.trim() || undefined);
      setState('done');
    } catch (err) {
      setState('error');
      setErrMsg(err instanceof Error ? err.message : 'Something went wrong. Email us at hello@nearmisspro.co.nz instead.');
    }
  };

  if (state === 'done') {
    return (
      <section id="trial" className="px-5 py-20">
        <div className="max-w-md mx-auto text-center">
          <CheckCircle2 size={48} className="text-[#1D9E75] mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Thanks — we'll be in touch.</h2>
          <p className="text-gray-600">We'll email you within a day to set up your pharmacy and get your trial going.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="trial" className="px-5 py-20">
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">Start your free trial</h2>
        <p className="text-center text-gray-600 mb-8">Tell us where to email the setup link. No card, no commitment.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Your email <span className="text-red-600">*</span></label>
            <input
              type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="manager@yourpharmacy.co.nz"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#0F6E56] focus:ring-1 focus:ring-[#0F6E56] outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Pharmacy name</label>
            <input
              type="text"
              value={pharmacyName} onChange={e => setPharmacyName(e.target.value)}
              placeholder="e.g. Main Street Pharmacy"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#0F6E56] focus:ring-1 focus:ring-[#0F6E56] outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Anything else? <span className="text-gray-400">(optional)</span></label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value.slice(0, 500))}
              rows={3} placeholder="Questions, when you'd like to start, anything we should know."
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#0F6E56] focus:ring-1 focus:ring-[#0F6E56] outline-none resize-none"
            />
          </div>
          {errMsg && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-lg">{errMsg}</div>
          )}
          <button
            type="submit"
            disabled={state === 'submitting' || !email.trim()}
            className="w-full bg-[#0F6E56] text-white font-semibold py-3 rounded-xl hover:bg-[#0B5A46] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {state === 'submitting' && <Loader2 size={16} className="animate-spin" />}
            {state === 'submitting' ? 'Sending…' : 'Start free trial'}
          </button>
          <p className="text-xs text-gray-500 text-center pt-2 flex items-center justify-center gap-1">
            <Lock size={11} /> We only use this to contact you about NearMissPro. No spam.
          </p>
        </form>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <ShieldIcon size={20} />
          <span><span className="text-[#0F6E56] font-semibold">NearMiss</span> Pro</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <a href="mailto:hello@nearmisspro.co.nz" className="hover:text-[#0F6E56]">hello@nearmisspro.co.nz</a>
          <Link to="/login" className="hover:text-[#0F6E56]">Log in</Link>
        </div>
        <div>© {new Date().getFullYear()} NearMissPro</div>
      </div>
    </footer>
  );
}
