import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ShieldIcon } from '../components/Logo';
import { CheckCircle2, ClipboardPlus, BarChart3, FileText, Lock, Loader2, ArrowRight, Sparkles, Shield, TrendingDown, AlertTriangle } from 'lucide-react';

// Public marketing landing page. Mounted at "/" for unauthed visitors;
// logged-in users skip past to /app via the RootRoute in App.tsx.
//
// Visual direction: modern SaaS — gradient hero, product preview card,
// hover micro-interactions — without straying from the teal/white the
// app itself uses. Mobile-first.
export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header />
      <Hero />
      <ComplianceBadges />
      <ThreeSteps />
      <ClosedLoop />
      <Pricing />
      <SignupForm />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldIcon size={28} />
          <span className="font-bold text-lg">
            <span className="text-[#0F6E56]">NearMiss</span>
            <span className="text-gray-900"> Pro</span>
          </span>
        </div>
        <div className="flex items-center gap-5">
          <a href="#pricing" className="hidden sm:inline text-sm font-medium text-gray-600 hover:text-[#0F6E56]">Pricing</a>
          <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-[#0F6E56]">Log in</Link>
          <a href="#trial" className="bg-[#0F6E56] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#0B5A46] transition-colors">
            Start free trial
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#F0FAF5] via-white to-white pointer-events-none" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#1D9E75]/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />

      <div className="relative max-w-6xl mx-auto px-5 pt-16 md:pt-24 pb-12 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#E1F5EE] text-[#085041] text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
            <Sparkles size={12} /> Built for NZ community pharmacy
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] mb-6 tracking-tight">
            Turn near misses into a <span className="bg-gradient-to-r from-[#0F6E56] to-[#1D9E75] bg-clip-text text-transparent">quality improvement loop</span> your team actually uses.
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-lg">
            Anonymous reporting in 60 seconds. Auto-generated meeting reports. Closed-loop tracking so you can prove your CQI actions worked.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <a href="#trial" className="bg-[#0F6E56] text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-[#0B5A46] transition-colors flex items-center gap-2 group">
              Start your 3-month free trial
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </a>
            <span className="text-sm text-gray-500">No card required</span>
          </div>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

// Fake mini-dashboard so visitors see what they'd actually be using.
// All static — no real data wired up — and the chrome (date row, banner,
// stat cards) mirrors the actual review screen.
function ProductPreview() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F6E56]/20 to-[#1D9E75]/10 rounded-3xl blur-2xl" />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 overflow-hidden">
        <div className="flex items-center gap-1.5 mb-4">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="ml-2 text-[11px] text-gray-400 font-mono">nearmisspro.co.nz/dashboard</span>
        </div>

        {/* Repeat-pattern banner */}
        <div className="rounded-xl border-2 border-[#BA7517] bg-[#FDF8EB] p-3 mb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-[#BA7517] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-[#633806]">1 repeat pattern — consider acting now</p>
              <p className="text-[11px] text-[#633806]/70 mt-0.5">Pantoprazole · Wrong drug picked · 5 in this period</p>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { v: '14', l: 'Active' },
            { v: '14', l: 'Reviewed' },
            { v: '2–6pm', l: 'Peak time' },
          ].map(s => (
            <div key={s.l} className="bg-gray-50 rounded-lg p-2.5 text-center">
              <div className="text-base font-bold text-gray-900">{s.v}</div>
              <div className="text-[10px] text-gray-500">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Trend strip */}
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <p className="text-[10px] font-semibold text-gray-500 mb-2">TREND — LAST 8W</p>
          <div className="flex items-end gap-1 h-12">
            {[3, 4, 2, 5, 7, 6, 5, 4].map((h, i) => (
              <div key={i} className="flex-1 bg-[#1D9E75] rounded-sm" style={{ height: `${h * 12}%` }} />
            ))}
          </div>
        </div>

        {/* Incident row sample */}
        <div className="border border-gray-200 rounded-lg p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-900 truncate">Wrong strength picked — Atorvastatin</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E1F5EE] text-[#085041] flex-shrink-0">✓ Accepted</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">Final pharmacist check · Lunch 12–2pm</p>
        </div>
      </div>
    </div>
  );
}

function ComplianceBadges() {
  const items = ['Pharmacy Council NZ', 'Medsafe', 'HQSC', 'Te Whatu Ora', 'NZ Formulary', 'Misuse of Drugs Act'];
  return (
    <section className="px-5 py-8 border-y border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-xs uppercase tracking-widest text-gray-400 font-semibold mb-4">Aligned with</p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {items.map(i => (
            <span key={i} className="text-sm font-medium text-gray-500">{i}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ThreeSteps() {
  const steps = [
    {
      icon: <ClipboardPlus size={20} />,
      title: 'Capture',
      body: 'Staff log a near miss in under a minute. Anonymous, structured, with a patient-reached gate that catches dispensing errors and routes them correctly.',
      bullets: ['60-second form', 'High-risk drug alerts', 'PHI scanner on notes'],
    },
    {
      icon: <BarChart3 size={20} />,
      title: 'Analyse',
      body: 'Spot recurring drugs, error types, and contributing factors. See whether last month\'s actions actually reduced the patterns.',
      bullets: ['Pattern detection', '"Did our actions work?" closed loop', 'Heatmap + weekly trend'],
    },
    {
      icon: <FileText size={20} />,
      title: 'Report',
      body: 'A one-page printable report your manager reads to the team. Auto-fills the summary, agenda, and what to discuss this month.',
      bullets: ['One-page meeting script', 'Auto-generated agenda', 'Sign-off table for the audit log'],
    },
  ];
  return (
    <section className="px-5 py-20 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-[#0F6E56] uppercase tracking-wide mb-3">How it works</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Three steps. One regulator-friendly loop.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map(s => (
            <div key={s.title} className="bg-white rounded-2xl p-7 border border-gray-200 hover:border-[#0F6E56]/30 hover:shadow-lg transition-all">
              <div className="w-11 h-11 rounded-xl bg-[#E1F5EE] flex items-center justify-center mb-4 text-[#0F6E56]">
                {s.icon}
              </div>
              <h3 className="font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">{s.body}</p>
              <ul className="space-y-1.5">
                {s.bullets.map(b => (
                  <li key={b} className="flex items-start gap-2 text-xs text-gray-700">
                    <CheckCircle2 size={13} className="text-[#1D9E75] flex-shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// "What makes this different" — speaks to the CQI compliance pain.
function ClosedLoop() {
  return (
    <section className="px-5 py-20">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-sm font-semibold text-[#0F6E56] uppercase tracking-wide mb-3">The closed loop</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">Prove your actions worked.</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Most near-miss tools are logbooks. NearMissPro closes the loop: every system change you log against a pattern is tracked against future incidents, so you (and your inspector) can see whether what you tried actually reduced the issue.
          </p>
          <ul className="space-y-3">
            {[
              { icon: <Shield size={16} />, text: 'Every void, restore, and decision is in the audit log with timestamp and reason.' },
              { icon: <TrendingDown size={16} />, text: 'Pattern reduced from 5 → 1? The report shows it as "action worked".' },
              { icon: <AlertTriangle size={16} />, text: 'Pattern got worse despite action? Flagged as "needs attention".' },
            ].map((p, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#E1F5EE] text-[#0F6E56] flex items-center justify-center flex-shrink-0">
                  {p.icon}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed pt-1">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-gradient-to-br from-[#F8FAF8] to-[#F0FAF5] rounded-2xl p-6 border border-gray-200">
          <p className="text-xs font-semibold text-[#0F6E56] uppercase tracking-wide mb-3">Did our actions work?</p>
          <div className="space-y-2.5">
            {[
              { drug: 'Amoxicillin', err: 'Allergy missed', prev: 4, cur: 0, status: 'Resolved · action worked', good: true },
              { drug: 'Atorvastatin', err: 'Wrong strength', prev: 5, cur: 2, status: 'Down 3 · action helping', good: true },
              { drug: 'Pantoprazole', err: 'Wrong drug', prev: 1, cur: 3, status: 'Up 2 · action not enough', good: false },
            ].map((r, i) => (
              <div key={i} className="bg-white rounded-lg p-3 flex items-center gap-3 text-sm border border-gray-100">
                <div className={`w-2 h-2 rounded-full ${r.good ? 'bg-[#1D9E75]' : 'bg-[#C84B4B]'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{r.drug} <span className="text-gray-400 font-normal">· {r.err}</span></p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{r.prev} → {r.cur}</span>
                <span className={`text-xs font-semibold whitespace-nowrap ${r.good ? 'text-[#085041]' : 'text-[#791F1F]'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="px-5 py-20 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-sm font-semibold text-[#0F6E56] uppercase tracking-wide mb-3">Pricing</p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">One price. All staff. No surprises.</h2>
        <p className="text-gray-600 mb-12">Per pharmacy, billed monthly. Cancel anytime.</p>

        <div className="relative inline-block max-w-md w-full">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0F6E56] text-white text-xs font-bold px-3 py-1 rounded-full">
            3 MONTHS FREE
          </div>
          <div className="bg-white rounded-2xl border-2 border-[#0F6E56] p-8 text-left shadow-lg">
            <p className="text-sm font-semibold text-[#0F6E56] uppercase tracking-wide mb-2">NearMissPro</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-5xl font-bold tracking-tight">$30</span>
              <span className="text-lg text-gray-500">/month</span>
            </div>
            <p className="text-sm text-gray-500 mb-6">or <span className="font-semibold text-gray-700">$300/year</span> — save 17%</p>
            <ul className="space-y-2.5 text-sm text-gray-700 mb-7">
              {[
                'All staff included — no per-user fees',
                'Unlimited near misses + reports',
                'Full audit log for Pharmacy Council inspections',
                'AI-assisted recommendations',
                'Email support direct from the founder',
              ].map(i => (
                <li key={i} className="flex items-start gap-2"><CheckCircle2 size={16} className="text-[#1D9E75] mt-0.5 flex-shrink-0" /> {i}</li>
              ))}
            </ul>
            <a href="#trial" className="block w-full bg-[#0F6E56] text-white text-center font-semibold py-3 rounded-xl hover:bg-[#0B5A46] transition-colors">
              Start 3-month free trial
            </a>
            <p className="text-xs text-gray-400 text-center mt-3">No card required during trial</p>
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
      setErrMsg(err instanceof Error ? err.message : 'Something went wrong. Email hello@nearmisspro.co.nz instead.');
    }
  };

  if (state === 'done') {
    return (
      <section id="trial" className="px-5 py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-[#E1F5EE] flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={32} className="text-[#1D9E75]" />
          </div>
          <h2 className="text-3xl font-bold mb-3 tracking-tight">You're on the list.</h2>
          <p className="text-gray-600">We'll email you within a day to set up your pharmacy and start your free trial.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="trial" className="px-5 py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">Start your free trial</h2>
          <p className="text-gray-600">Three months free, no card, no pressure.</p>
        </div>
        <form onSubmit={submit} className="space-y-4 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Your email <span className="text-red-600">*</span></label>
            <input
              type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="manager@yourpharmacy.co.nz"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Pharmacy name</label>
            <input
              type="text"
              value={pharmacyName} onChange={e => setPharmacyName(e.target.value)}
              placeholder="e.g. Main Street Pharmacy"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Anything else? <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value.slice(0, 500))}
              rows={3} placeholder="Questions, when you'd like to start, anything we should know."
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20 outline-none resize-none transition-colors"
            />
          </div>
          {errMsg && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-lg">{errMsg}</div>
          )}
          <button
            type="submit"
            disabled={state === 'submitting' || !email.trim()}
            className="w-full bg-[#0F6E56] text-white font-semibold py-3.5 rounded-xl hover:bg-[#0B5A46] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
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
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row items-center justify-between gap-5 text-sm">
        <div className="flex items-center gap-2">
          <ShieldIcon size={22} />
          <span className="font-semibold text-white">NearMiss <span className="text-[#1D9E75]">Pro</span></span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <a href="mailto:hello@nearmisspro.co.nz" className="hover:text-white">hello@nearmisspro.co.nz</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <Link to="/login" className="hover:text-white">Log in</Link>
        </div>
        <div>© {new Date().getFullYear()} NearMissPro</div>
      </div>
    </footer>
  );
}
