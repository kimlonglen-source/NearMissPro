import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ShieldIcon } from '../components/Logo';
import { CheckCircle2, ClipboardPlus, BarChart3, FileText, Lock, Loader2, ArrowRight, Sparkles, Shield, TrendingDown, AlertTriangle, XCircle } from 'lucide-react';

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
      <VsPaper />
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
            Anonymous reporting in 60 seconds. Auto-generated meeting reports. Closed-loop tracking so you can see what's actually reducing errors — and what isn't.
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

// Animated 3-stage demo that loops: Record → Review → Print. Each
// stage holds for a few seconds with a subtle fade between. The
// step indicator at the top tells the visitor it's a story, not a
// glitch. Pauses on hover so they can read whichever stage is
// onscreen.
function ProductPreview() {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const HOLDS = [3500, 3500, 4000]; // ms per stage
    const t = setTimeout(() => setStage(s => ((s + 1) % 3) as 0 | 1 | 2), HOLDS[stage]);
    return () => clearTimeout(t);
  }, [stage, paused]);

  const stages = ['Record', 'Review', 'Print'];

  return (
    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F6E56]/20 to-[#1D9E75]/10 rounded-3xl blur-2xl" />

      <div className="relative mx-auto max-w-md">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {stages.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => setStage(i as 0 | 1 | 2)}
                className={`text-xs font-semibold transition-colors ${stage === i ? 'text-[#0F6E56]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {i + 1}. {s}
              </button>
              {i < stages.length - 1 && <div className="w-6 h-px bg-gray-300" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* App header */}
          <div className="px-5 py-3 flex items-center gap-2 border-b border-gray-100">
            <ShieldIcon size={20} />
            <span className="text-sm font-bold">
              <span className="text-[#0F6E56]">NearMiss</span> Pro
            </span>
            <span className="ml-auto text-[11px] text-gray-400">{stages[stage]}</span>
          </div>

          {/* Stage body — height kept consistent so the card doesn't jump */}
          <div className="p-5 min-h-[300px]">
            {stage === 0 && <RecordStage />}
            {stage === 1 && <ReviewStage />}
            {stage === 2 && <PrintStage />}
          </div>
        </div>

        {/* Floating stamps — different per stage */}
        {stage === 0 && (
          <div className="absolute top-12 -right-3 bg-white rounded-2xl shadow-lg border border-gray-200 px-3 py-2 rotate-3 animate-[fadeIn_0.4s_ease]">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Recorded in</p>
            <p className="text-xl font-bold text-[#0F6E56]">47<span className="text-sm">s</span></p>
          </div>
        )}
        {stage === 1 && (
          <div className="absolute top-12 -right-3 bg-white rounded-2xl shadow-lg border border-gray-200 px-3 py-2 rotate-3 animate-[fadeIn_0.4s_ease] flex items-center gap-1.5">
            <Sparkles size={12} className="text-[#0F6E56]" />
            <p className="text-xs font-semibold text-gray-700">AI suggested</p>
          </div>
        )}
        {stage === 2 && (
          <div className="absolute top-12 -right-3 bg-white rounded-2xl shadow-lg border border-gray-200 px-3 py-2 rotate-3 animate-[fadeIn_0.4s_ease]">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Ready to print</p>
            <p className="text-base font-bold text-[#0F6E56]">May report</p>
          </div>
        )}

        {/* Bottom-left stamp stays constant — anonymity is true at every stage */}
        <div className="absolute -bottom-3 -left-3 bg-white rounded-2xl shadow-lg border border-gray-200 px-3 py-2 -rotate-3 flex items-center gap-1.5">
          <Lock size={12} className="text-[#0F6E56]" />
          <p className="text-xs font-semibold text-gray-700">Anonymous</p>
        </div>
      </div>
    </div>
  );
}

// Stage 1 — staff member fills the form, chip pulses into selection.
function RecordStage() {
  return (
    <div className="space-y-3 animate-[fadeIn_0.4s_ease]">
      <div className="rounded-lg bg-[#F0FAF5] border border-[#C8E6D8] px-3 py-2.5 flex items-center gap-2">
        <CheckCircle2 size={15} className="text-[#1D9E75]" />
        <span className="text-sm font-medium text-gray-800 flex-1">Where did this happen?</span>
        <span className="text-xs font-semibold text-[#085041]">Done</span>
      </div>

      <div className="rounded-lg border border-gray-200 px-3 py-3">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-5 h-5 rounded-full bg-[#0F6E56] text-white text-[11px] font-bold flex items-center justify-center">2</span>
          <span className="text-sm font-medium text-gray-800">What went wrong?</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#FDF1E8] border border-[#F0A36D] text-[#9A3F0D] animate-[pulse_2s_ease-in-out_infinite]">Wrong strength picked</span>
          <span className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-600">Look-alike</span>
          <span className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-600">Wrong drug</span>
        </div>
      </div>

      <div className="rounded-lg border border-[#FCEBEB] bg-[#FCEBEB] px-3 py-2">
        <p className="text-xs font-bold text-[#791F1F] flex items-center gap-1.5">
          <AlertTriangle size={12} /> High-risk drug — Anticoagulant
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 px-3 py-3 opacity-60">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[11px] font-bold flex items-center justify-center">3</span>
          <span className="text-sm text-gray-600">Where was it caught?</span>
        </div>
      </div>
    </div>
  );
}

// Stage 2 — manager reviews. The Accept button pulses then becomes "accepted".
function ReviewStage() {
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAccepted(true), 1800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="space-y-3 animate-[fadeIn_0.4s_ease]">
      <div className="border border-gray-200 rounded-xl p-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-sm font-semibold text-gray-900">Wrong strength: Warfarin 1mg → 3mg</p>
          {accepted && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E1F5EE] text-[#085041] flex-shrink-0 animate-[fadeIn_0.3s_ease]">✓ Accepted</span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 mb-2.5">12 May · Final pharmacist check · Communication gap</p>

        <div className="bg-[#F0FAF5] border border-[#C8E6D8] rounded-lg p-2.5 mb-2.5">
          <p className="text-[10px] font-bold text-[#085041] uppercase tracking-wider mb-1">AI Recommendation</p>
          <p className="text-xs text-gray-800 leading-snug">Use colour-coded bins on the shelf to separate Warfarin strengths. Make the strength bigger on the dispensing label.</p>
        </div>

        {!accepted ? (
          <button className="w-full py-2 rounded-lg bg-[#0F6E56] text-white text-xs font-semibold flex items-center justify-center gap-1.5 animate-[pulse_1.5s_ease-in-out_infinite]">
            <CheckCircle2 size={14} /> Accept recommendation
          </button>
        ) : (
          <button className="w-full py-2 rounded-lg bg-gray-100 text-gray-500 text-xs font-medium" disabled>
            Card collapsing…
          </button>
        )}
      </div>
    </div>
  );
}

// Stage 3 — paper-style report sliding in from the right.
function PrintStage() {
  return (
    <div className="animate-[fadeIn_0.4s_ease]">
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4 relative overflow-hidden">
        {/* "Watermark" corner */}
        <div className="absolute top-3 right-3 text-[8px] text-gray-300 font-semibold uppercase tracking-widest">May 2026</div>

        <div className="flex items-center gap-1.5 mb-2">
          <ShieldIcon size={14} />
          <span className="text-[10px] font-bold">
            <span className="text-[#0F6E56]">NearMiss</span> Pro
          </span>
        </div>
        <p className="text-[8px] uppercase tracking-wider text-[#0F6E56] font-bold border-b border-[#0F6E56]/30 pb-1 mb-2">Period summary</p>
        <p className="text-[9px] text-gray-700 leading-relaxed mb-3">
          6 fewer near misses than last period (17 vs 23). 4 patterns resolved, 2 need attention. The biggest cause was high-volume periods…
        </p>

        <p className="text-[8px] uppercase tracking-wider text-[#0F6E56] font-bold border-b border-[#0F6E56]/30 pb-1 mb-2">What worked</p>
        <div className="space-y-1 mb-3">
          {[
            { d: 'Amoxicillin · Allergy missed', s: '4 → 0', tone: 'text-[#085041]' },
            { d: 'Atorvastatin · Wrong strength', s: '5 → 2', tone: 'text-[#085041]' },
            { d: 'Pantoprazole · Wrong drug', s: '1 → 3', tone: 'text-[#791F1F]' },
          ].map((r, i) => (
            <div key={i} className="flex items-center justify-between text-[9px]">
              <span className="text-gray-700">{r.d}</span>
              <span className={`font-semibold ${r.tone}`}>{r.s}</span>
            </div>
          ))}
        </div>

        <p className="text-[8px] uppercase tracking-wider text-[#0F6E56] font-bold border-b border-[#0F6E56]/30 pb-1 mb-2">What we'll do</p>
        <ol className="text-[9px] text-gray-700 space-y-1 list-decimal list-inside">
          <li>Open the meeting — read this summary aloud…</li>
          <li>Walk through the log — start with Pantoprazole…</li>
        </ol>
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

// "What makes this different" — speaks to the improvement loop:
// most logbooks capture, NearMissPro proves reduction.
function ClosedLoop() {
  return (
    <section className="px-5 py-20">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-sm font-semibold text-[#0F6E56] uppercase tracking-wide mb-3">The closed loop</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">Prove your actions worked.</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Most near-miss tools are logbooks. NearMissPro closes the loop: every system change you log against a pattern is tracked against future incidents, so you can see whether what you tried actually reduced the same kind of error happening again.
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

// Side-by-side "paper logbook vs NearMissPro" comparison. Honest in
// tone — paper works, but it carries overhead the pharmacist may not
// have weighed. Sits right before pricing so the switch argument
// lands before the visitor sees the price.
function VsPaper() {
  const rows = [
    { paper: '5+ minutes of handwriting per near miss', us: 'Under 60 seconds — structured form, drug autocomplete' },
    { paper: 'Handwriting identifies the staff member', us: 'Truly anonymous — the team sees the event, not the writer' },
    { paper: 'Hours of flipping through pages to review the month', us: 'Manager review in minutes — auto-grouped, AI suggestion on every incident' },
    { paper: 'Patterns only visible if you re-read every entry', us: 'Auto-detected, flagged on the dashboard mid-month so you can act early' },
    { paper: 'Monthly meeting report written from scratch every time', us: 'Auto-generated meeting script — summary, agenda, sign-off included' },
    { paper: '"Did our actions work?" — almost impossible to answer', us: 'Pattern comparison vs prior period — built-in, on every report' },
    { paper: 'Audit trail is the book itself — can be lost or altered', us: 'Immutable timestamped log — every void, edit, and decision saved. Meets your CQI audit requirements.' },
  ];
  return (
    <section className="px-5 py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-[#0F6E56] uppercase tracking-wide mb-3">Why pharmacists switch from paper</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Paper works — but here's what you're carrying.</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">The classic A4 logbook captures what happened. NearMissPro turns each near miss into a system change that actually reduces the next one.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Paper column — muted */}
          <div className="bg-white rounded-2xl p-7 border border-gray-200">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-5">Paper logbook today</p>
            <ul className="space-y-3.5">
              {rows.map((r, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700 leading-snug">
                  <XCircle size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>{r.paper}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* NearMissPro column — accented */}
          <div className="bg-white rounded-2xl p-7 border-2 border-[#0F6E56]/30 shadow-md">
            <p className="text-xs font-bold uppercase tracking-wider text-[#0F6E56] mb-5">With NearMissPro</p>
            <ul className="space-y-3.5">
              {rows.map((r, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-800 leading-snug">
                  <CheckCircle2 size={16} className="text-[#1D9E75] flex-shrink-0 mt-0.5" />
                  <span>{r.us}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 text-center">
          <a href="#trial" className="inline-flex items-center gap-2 bg-[#0F6E56] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#0B5A46] transition-colors group">
            Start your 3-month free trial
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </a>
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
                'Full audit log — every void, edit, and decision saved',
                'Meets Pharmacy Council CQI audit requirements',
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
