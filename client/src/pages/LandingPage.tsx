import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ShieldIcon } from '../components/Logo';
import { MarketingHeader, MarketingFooter } from '../components/MarketingChrome';
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
      <MarketingHeader />
      <Hero />
      <TwoPains />
      <ComplianceBadges />
      <ThreeSteps />
      <ClosedLoop />
      <VsPaper />
      <Pricing />
      <SignupForm />
      <MarketingFooter />
    </div>
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
            Log near misses in seconds. <span className="bg-gradient-to-r from-[#0F6E56] to-[#1D9E75] bg-clip-text text-transparent">Review in minutes.</span> Prevent the next error.
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-lg">
            Staff record a dispensing near miss in under a minute — anonymous, so they actually do it. Come review time it's grouped for you, each with an NZ-best-practice suggestion and the report already written. And every review shows whether last month's fixes worked — so the same mistakes stop coming back before one reaches a patient. Built for NZ community pharmacy.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Link to="/signup" className="bg-[#0F6E56] text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-[#0B5A46] transition-colors flex items-center gap-2 group">
              Start your 3-month free trial
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
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
    const HOLDS = [7500, 3500, 4000]; // ms per stage — Record longer so the 4-step click-through has time to play
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
          <div className="p-5 min-h-[420px]">
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

        {/* Anonymous stamp shows ONLY on the Record stage. The Review
            and Print stages are managerial — anonymity has already
            been promised, repeating it there feels like over-claiming. */}
        {stage === 0 && (
          <div className="absolute -bottom-3 -left-3 bg-white rounded-2xl shadow-lg border border-gray-200 px-3 py-2 -rotate-3 flex items-center gap-1.5 animate-[fadeIn_0.4s_ease]">
            <Lock size={12} className="text-[#0F6E56]" />
            <p className="text-xs font-semibold text-gray-700">Anonymous</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Stage 1 — animated walk-through of the record flow with a visible
// mouse cursor. Cycles through four micro-steps so visitors literally
// see each click happen. Tap order: stage chip → error chip → where-
// caught chip → submit (pulses).
function RecordStage() {
  // 0 = section 1 active (stage), 1 = section 2 active (error type),
  // 2 = section 3 active (where caught), 3 = section 4 active
  // (factors), 4 = all done & submit pulsing.
  type Step = 0 | 1 | 2 | 3 | 4;
  const [step, setStep] = useState<Step>(0);
  const [clicking, setClicking] = useState(false);
  useEffect(() => {
    // Per-step hold. Each: ~500ms cursor lands → click flash → ~1000ms
    // hold showing the new selected state.
    const HOLDS = [1500, 1500, 1500, 1500, 1200];
    const clickAt = setTimeout(() => {
      setClicking(true);
      setTimeout(() => setClicking(false), 200);
    }, 500);
    const advance = setTimeout(() => setStep(s => Math.min(4, s + 1) as Step), HOLDS[step]);
    return () => { clearTimeout(clickAt); clearTimeout(advance); };
  }, [step]);

  // Cursor target — measured live from the DOM so it always lands on
  // the actual chip the demo is "clicking", even as the layout shifts
  // (sections collapsing, high-risk warning appearing, etc).
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRefs = useRef<(HTMLElement | null)[]>([]);
  const [pos, setPos] = useState({ top: 60, left: 60 });
  useLayoutEffect(() => {
    const container = containerRef.current;
    const target = targetRefs.current[step];
    if (!container || !target) return;
    const c = container.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    // Land the cursor tip slightly above-left of centre, like a real
    // pointer about to click — feels more natural than dead-centre.
    setPos({
      top: t.top - c.top + t.height * 0.4,
      left: t.left - c.left + t.width * 0.55,
    });
  }, [step]);

  return (
    <div ref={containerRef} className="space-y-3 animate-[fadeIn_0.4s_ease] relative">
      {/* Floating cursor — moves between chips via CSS transition,
          briefly scales down on each click. Pointer-events disabled
          so it doesn't intercept hover/clicks on the demo. */}
      <div
        className="absolute pointer-events-none z-20 transition-all duration-500 ease-out"
        style={{
          top: `${pos.top}px`,
          left: `${pos.left}px`,
          transform: clicking ? 'scale(0.85)' : 'scale(1)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="drop-shadow-md">
          <path d="M3 2L19 11L11 13L9 19L3 2Z" fill="white" stroke="#111" strokeWidth="1.3" strokeLinejoin="round"/>
        </svg>
        {clicking && (
          <span className="absolute -top-1 -left-1 w-6 h-6 rounded-full border-2 border-[#0F6E56] animate-ping" />
        )}
      </div>

      {/* Step 1 — Where did this happen? */}
      {step === 0 ? (
        <div className="rounded-lg border border-gray-200 px-3 py-3">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-5 h-5 rounded-full bg-[#0F6E56] text-white text-[11px] font-bold flex items-center justify-center">1</span>
            <span className="text-sm font-medium text-gray-800">Where did this happen?</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span ref={el => { targetRefs.current[0] = el; }} className="text-xs font-semibold px-3 py-1 rounded-full bg-[#E1F5EE] border border-[#1D9E75] text-[#085041] animate-[pulse_1.2s_ease-in-out_infinite]">Drug picked from shelf</span>
            <span className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-600">Labelling</span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-[#F0FAF5] border border-[#C8E6D8] px-3 py-2.5 flex items-center gap-2 animate-[fadeIn_0.3s_ease]">
          <CheckCircle2 size={15} className="text-[#1D9E75]" />
          <span className="text-sm font-medium text-gray-800 flex-1">Where did this happen?</span>
          <span className="text-xs font-semibold text-[#085041]">Done</span>
        </div>
      )}

      {/* Step 2 — What went wrong? */}
      {step >= 1 && step <= 1 ? (
        <div className="rounded-lg border border-gray-200 px-3 py-3 animate-[fadeIn_0.3s_ease]">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-5 h-5 rounded-full bg-[#0F6E56] text-white text-[11px] font-bold flex items-center justify-center">2</span>
            <span className="text-sm font-medium text-gray-800">What went wrong?</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span ref={el => { targetRefs.current[1] = el; }} className="text-xs font-semibold px-3 py-1 rounded-full bg-[#FDF1E8] border border-[#F0A36D] text-[#9A3F0D] animate-[pulse_1.2s_ease-in-out_infinite]">Wrong strength picked</span>
            <span className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-600">Look-alike</span>
            <span className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-600">Wrong drug</span>
          </div>
        </div>
      ) : step >= 2 ? (
        <div className="rounded-lg bg-[#F0FAF5] border border-[#C8E6D8] px-3 py-2.5 flex items-center gap-2 animate-[fadeIn_0.3s_ease]">
          <CheckCircle2 size={15} className="text-[#1D9E75]" />
          <span className="text-sm font-medium text-gray-800 flex-1">What went wrong?</span>
          <span className="text-xs font-semibold text-[#085041]">Done</span>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 px-3 py-3 opacity-60">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[11px] font-bold flex items-center justify-center">2</span>
            <span className="text-sm text-gray-600">What went wrong?</span>
          </div>
        </div>
      )}

      {/* High-risk warning appears only after step 2 picks (drug-aware) */}
      {step >= 2 && (
        <div className="rounded-lg border border-[#FCEBEB] bg-[#FCEBEB] px-3 py-2 animate-[fadeIn_0.3s_ease]">
          <p className="text-xs font-bold text-[#791F1F] flex items-center gap-1.5">
            <AlertTriangle size={12} /> High-risk drug — Anticoagulant
          </p>
        </div>
      )}

      {/* Step 3 — Where was it caught? */}
      {step === 2 ? (
        <div className="rounded-lg border border-gray-200 px-3 py-3 animate-[fadeIn_0.3s_ease]">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-5 h-5 rounded-full bg-[#0F6E56] text-white text-[11px] font-bold flex items-center justify-center">3</span>
            <span className="text-sm font-medium text-gray-800">Where was it caught?</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span ref={el => { targetRefs.current[2] = el; }} className="text-xs font-semibold px-3 py-1 rounded-full bg-[#E1F5EE] border border-[#1D9E75] text-[#085041] animate-[pulse_1.2s_ease-in-out_infinite]">Final pharmacist check</span>
            <span className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-600">Technician spotted it</span>
          </div>
        </div>
      ) : step >= 3 ? (
        <div className="rounded-lg bg-[#F0FAF5] border border-[#C8E6D8] px-3 py-2.5 flex items-center gap-2 animate-[fadeIn_0.3s_ease]">
          <CheckCircle2 size={15} className="text-[#1D9E75]" />
          <span className="text-sm font-medium text-gray-800 flex-1">Where was it caught?</span>
          <span className="text-xs font-semibold text-[#085041]">Done</span>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 px-3 py-3 opacity-60">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[11px] font-bold flex items-center justify-center">3</span>
            <span className="text-sm text-gray-600">Where was it caught?</span>
          </div>
        </div>
      )}

      {/* Step 4 — What was happening at the time? (factors) */}
      {step === 3 ? (
        <div className="rounded-lg border border-gray-200 px-3 py-3 animate-[fadeIn_0.3s_ease]">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-5 h-5 rounded-full bg-[#0F6E56] text-white text-[11px] font-bold flex items-center justify-center">4</span>
            <span className="text-sm font-medium text-gray-800">What was happening at the time?</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span ref={el => { targetRefs.current[3] = el; }} className="text-xs font-semibold px-3 py-1 rounded-full bg-[#FDF8EB] border border-[#BA7517] text-[#633806] animate-[pulse_1.2s_ease-in-out_infinite]">Interruption or distraction</span>
            <span className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-600">Busy period</span>
          </div>
        </div>
      ) : step >= 4 ? (
        <div className="rounded-lg bg-[#F0FAF5] border border-[#C8E6D8] px-3 py-2.5 flex items-center gap-2 animate-[fadeIn_0.3s_ease]">
          <CheckCircle2 size={15} className="text-[#1D9E75]" />
          <span className="text-sm font-medium text-gray-800 flex-1">What was happening at the time?</span>
          <span className="text-xs font-semibold text-[#085041]">Done</span>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 px-3 py-3 opacity-60">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[11px] font-bold flex items-center justify-center">4</span>
            <span className="text-sm text-gray-600">What was happening at the time?</span>
          </div>
        </div>
      )}

      {/* Submit button — pulses on step 4 (all done) */}
      {step >= 4 && (
        <button ref={el => { targetRefs.current[4] = el; }} className="w-full py-2.5 rounded-lg bg-[#0F6E56] text-white text-sm font-semibold animate-pulse">
          Submit near miss
        </button>
      )}
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
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E1F5EE] text-[#085041] flex-shrink-0 animate-[fadeIn_0.3s_ease]">✓ Action agreed</span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 mb-2.5">12 May · Final pharmacist check · Message not passed on</p>

        <div className="bg-[#F0FAF5] border border-[#C8E6D8] rounded-lg p-2.5 mb-2.5">
          <p className="text-[10px] font-bold text-[#085041] uppercase tracking-wider mb-1">AI Recommendation</p>
          <p className="text-xs text-gray-800 leading-snug">Use colour-coded bins on the shelf to separate Warfarin strengths. Make the strength bigger on the dispensing label.</p>
        </div>

        {!accepted ? (
          <button className="w-full py-2 rounded-lg bg-[#0F6E56] text-white text-xs font-semibold flex items-center justify-center gap-1.5 animate-[pulse_1.5s_ease-in-out_infinite]">
            <CheckCircle2 size={14} /> Yes — we'll do this
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
        <p className="text-[8px] uppercase tracking-wider text-[#0F6E56] font-bold border-b border-[#0F6E56]/30 pb-1 mb-2">1. This month at a glance</p>
        <ul className="text-[9px] text-gray-700 leading-relaxed mb-3 space-y-0.5">
          <li>• 17 near misses this period vs 23 last — down 6</li>
          <li>• Near-miss rate: 17 of 8,010 scripts — 0.2%</li>
          <li>• Biggest cause: busy period</li>
        </ul>

        <p className="text-[8px] uppercase tracking-wider text-[#0F6E56] font-bold border-b border-[#0F6E56]/30 pb-1 mb-2">2. Follow-up from last review</p>
        <div className="space-y-1 mb-3 text-[9px] font-semibold">
          <p className="text-[#085041]">✓ 4 have not happened again</p>
          <p className="text-[#0F6E56]">↓ 2 are happening less often</p>
          <p className="text-[#791F1F]">⚠ 1 is still happening — discuss today</p>
        </div>

        <p className="text-[8px] uppercase tracking-wider text-[#0F6E56] font-bold border-b border-[#0F6E56]/30 pb-1 mb-2">3. Near misses — what we're doing</p>
        <div className="text-[9px] text-gray-700 leading-snug">
          <p className="font-semibold">Warfarin — wrong strength <span className="text-[#633806]">×2</span></p>
          <p className="text-[#085041]">What we're doing: colour-coded bins for Warfarin strengths.</p>
        </div>
      </div>
    </div>
  );
}

// The two moments that actually hurt in a pharmacy — recording (staff)
// and reviewing (manager). Named plainly, each with the fix, so a
// prospect sees their own problem in the first scroll.
function TwoPains() {
  return (
    <section className="px-5 py-16 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold text-[#0F6E56] uppercase tracking-wide mb-3">The two jobs no one enjoys</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">We fixed both of them.</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl p-7 border border-gray-200">
            <div className="w-11 h-11 rounded-xl bg-[#E1F5EE] flex items-center justify-center mb-4 text-[#0F6E56]">
              <ClipboardPlus size={20} />
            </div>
            <h3 className="font-bold text-lg mb-2">Recording — for staff</h3>
            <p className="text-sm text-gray-500 mb-3"><span className="font-semibold text-gray-700">The pain:</span> stopping mid-dispense to hand-write in the logbook. So dispensing near misses go unreported.</p>
            <p className="text-sm text-gray-600 leading-relaxed"><span className="font-semibold text-[#0F6E56]">The fix:</span> a 60-second form with drug autocomplete, right on your dispensary computer (or a phone or tablet if you prefer). Anonymous, so staff aren't afraid to log. Quick enough that they actually do it.</p>
          </div>
          <div className="bg-white rounded-2xl p-7 border border-gray-200">
            <div className="w-11 h-11 rounded-xl bg-[#E1F5EE] flex items-center justify-center mb-4 text-[#0F6E56]">
              <BarChart3 size={20} />
            </div>
            <h3 className="font-bold text-lg mb-2">Reviewing — for the manager</h3>
            <p className="text-sm text-gray-500 mb-3"><span className="font-semibold text-gray-700">The pain:</span> an afternoon flipping through the book, grouping by hand, writing a report from scratch.</p>
            <p className="text-sm text-gray-600 leading-relaxed"><span className="font-semibold text-[#0F6E56]">The fix:</span> near misses grouped for you, an NZ-best-practice suggestion on each, and a printable review report ready in minutes — so the only thing left is deciding and doing.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComplianceBadges() {
  const items = ['Pharmacy Council NZ', 'Medsafe', 'HQSC', 'Te Whatu Ora', 'NZ Formulary', 'Misuse of Drugs Act'];
  return (
    <section className="px-5 py-8 border-y border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-xs uppercase tracking-widest text-gray-400 font-semibold mb-4">Built on guidance from</p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {items.map(i => (
            <span key={i} className="text-sm font-medium text-gray-500">{i}</span>
          ))}
        </div>
        <p className="text-center text-[11px] italic text-gray-400 mt-4">References, not endorsements — NearMissPro has not been certified by any of these bodies.</p>
      </div>
    </section>
  );
}

function ThreeSteps() {
  const steps = [
    {
      icon: <ClipboardPlus size={20} />,
      title: 'Staff log it',
      body: 'A staff member records a near miss in under a minute. It stays anonymous, and the first question checks it was caught before the patient — so real dispensing errors go to the right process, not this one.',
      bullets: ['60-second form', 'High-risk drug alerts', 'Stops accidental patient info'],
    },
    {
      icon: <BarChart3 size={20} />,
      title: 'Manager reviews',
      body: 'The manager works through each near miss and gets a suggested action drawn from NZ community-pharmacy best practice (Medsafe, NZ Formulary, Pharmacy Council, HQSC). Accept it, reword it, or decide no change is needed. Repeats are grouped so nothing is read twice.',
      bullets: ['Suggestions from NZ best practice', 'One decision per near miss', 'Repeats grouped automatically'],
    },
    {
      icon: <FileText size={20} />,
      title: 'Report for the meeting',
      body: 'One click makes a printable report that reads like a meeting run-sheet. It shows what changed since last review, this period\'s near misses with the action for each, and your near-miss rate per scripts dispensed.',
      bullets: ['Compares to your last report', 'Shows near-miss rate (% of scripts)', 'Sign-off table for the audit log'],
    },
  ];
  return (
    <section className="px-5 py-20 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-[#0F6E56] uppercase tracking-wide mb-3">How it works</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Three simple steps every month.</h2>
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
            Most near-miss tools are just logbooks. NearMissPro compares every report to your last one: each problem from last review is followed up and marked as gone, happening less, or still happening — so you can see whether what you changed actually worked.
          </p>
          <ul className="space-y-3">
            {[
              { icon: <TrendingDown size={16} />, text: 'A problem gone since last review shows as "not happened again".' },
              { icon: <AlertTriangle size={16} />, text: 'Still happening despite a change? It\'s flagged for the team to rethink.' },
              { icon: <Shield size={16} />, text: 'Every decision, void and edit is in the audit log with a timestamp.' },
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
    { paper: 'No sense of whether things are getting better or worse', us: 'Every report compares to your last one, plus your near-miss rate per scripts dispensed' },
    { paper: '"Did our actions work?" — almost impossible to answer', us: 'Each problem from last review followed up — gone, less often, or still happening' },
    { paper: 'Audit trail is the book itself — can be lost or altered', us: 'Immutable timestamped log — every void, edit, and decision saved. Designed to support your CQI audit work.' },
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
          <Link to="/signup" className="inline-flex items-center gap-2 bg-[#0F6E56] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#0B5A46] transition-colors group">
            Start your 3-month free trial
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
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
            <p className="text-sm text-gray-500 mb-6">or <span className="font-semibold text-gray-700">$300/year</span> — save $60</p>
            <ul className="space-y-2.5 text-sm text-gray-700 mb-7">
              {[
                'All staff included — no per-user fees',
                'Unlimited near misses + reports',
                'Full audit log — every void, edit, and decision saved',
                'Designed to support your CQI audit work',
                'AI-assisted recommendations',
                'Email support direct from the founder',
              ].map(i => (
                <li key={i} className="flex items-start gap-2"><CheckCircle2 size={16} className="text-[#1D9E75] mt-0.5 flex-shrink-0" /> {i}</li>
              ))}
            </ul>
            <Link to="/signup" className="block w-full bg-[#0F6E56] text-white text-center font-semibold py-3 rounded-xl hover:bg-[#0B5A46] transition-colors">
              Start your 3-month free trial
            </Link>
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

