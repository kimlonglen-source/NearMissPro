import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { detectPHI, phiHint, PhiKind } from '../lib/phi';
import {
  STAGES, WHERE_CAUGHT, CAUGHT_DEFAULT_BY_STAGE, FACTORS,
  FACTORS_DEFAULT_VISIBLE, FORMULATIONS, DRUG_SUGGESTIONS, triggersFor,
} from '../lib/taxonomy';
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

const SESSION_KEY = 'nmp_record_draft';
const LAST_CAUGHT_KEY = 'nmp_last_where_caught';
const RECENT_KEY = (stage: string) => `nmp_recent_${stage}`;

function tap() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(10); } catch { /* noop */ }
  }
}

function pushRecent(stage: string, sub: string) {
  try {
    const key = RECENT_KEY(stage);
    const prev: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    const next = [sub, ...prev.filter(s => s !== sub)].slice(0, 3);
    localStorage.setItem(key, JSON.stringify(next));
  } catch { /* noop */ }
}

function readRecent(stage: string): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY(stage)) || '[]'); }
  catch { return []; }
}

interface Draft {
  errorStep: string;
  errorTypes: string[];
  drugName: string;
  dispensedDrug: string;
  prescribedStrength: string;
  dispensedStrength: string;
  correctFormulation: string;
  dispensedFormulation: string;
  prescribedQuantity: string;
  dispensedQuantity: string;
  whereCaught: string;
  factors: string[];
  notes: string;
  showAnythingElse: boolean;
  showMoreSub: boolean;
  showMoreFactors: boolean;
}

const EMPTY: Draft = {
  errorStep: '', errorTypes: [],
  drugName: '', dispensedDrug: '',
  prescribedStrength: '', dispensedStrength: '',
  correctFormulation: '', dispensedFormulation: '',
  prescribedQuantity: '', dispensedQuantity: '',
  whereCaught: '', factors: [], notes: '',
  showAnythingElse: false, showMoreSub: false, showMoreFactors: false,
};

export function RecordPage() {
  const nav = useNavigate();
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) return { ...EMPTY, ...JSON.parse(saved) };
    } catch { /* noop */ }
    return EMPTY;
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [lastDraft, setLastDraft] = useState<Draft | null>(null);

  const l2Ref = useRef<HTMLElement>(null);
  const caughtRef = useRef<HTMLElement>(null);
  const factorsRef = useRef<HTMLElement>(null);

  // Persist draft across back-navigation / refresh.
  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(draft)); } catch { /* noop */ }
  }, [draft]);

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft(d => ({ ...d, ...patch }));
  }, []);

  const stage = useMemo(() => STAGES.find(s => s.label === draft.errorStep), [draft.errorStep]);
  const recentSubs = useMemo(
    () => draft.errorStep ? readRecent(draft.errorStep) : [],
    [draft.errorStep],
  );

  // Sub-error chip list: recent picks first, then common, then (on expand) the long tail.
  const visibleSubs = useMemo(() => {
    if (!stage) return [] as { label: string; recent: boolean }[];
    const seen = new Set<string>();
    const out: { label: string; recent: boolean }[] = [];
    for (const r of recentSubs) {
      if (stage.subErrors.some(s => s.label === r) && !seen.has(r)) {
        out.push({ label: r, recent: true });
        seen.add(r);
      }
    }
    for (const s of stage.subErrors) {
      if (seen.has(s.label)) continue;
      if (s.common || draft.showMoreSub) {
        out.push({ label: s.label, recent: false });
        seen.add(s.label);
      }
    }
    return out;
  }, [stage, recentSubs, draft.showMoreSub]);

  const hasHiddenSubs = !!stage && stage.subErrors.some(s => !s.common) && !draft.showMoreSub;

  // Layer 3 triggers — union across all selected sub-errors.
  const triggers = useMemo(() => {
    const acc = { drug: false, strength: false, quantity: false, formulation: false };
    for (const sub of draft.errorTypes) {
      const t = triggersFor(sub);
      acc.drug ||= t.drug;
      acc.strength ||= t.strength;
      acc.quantity ||= t.quantity;
      acc.formulation ||= t.formulation;
    }
    return acc;
  }, [draft.errorTypes]);

  const visibleFactors = useMemo(
    () => draft.showMoreFactors ? FACTORS : FACTORS.slice(0, FACTORS_DEFAULT_VISIBLE),
    [draft.showMoreFactors],
  );

  // PHI scans — live on every keystroke.
  const phi = useMemo(() => ({
    notes: detectPHI(draft.notes),
    drugName: detectPHI(draft.drugName),
    dispensedDrug: detectPHI(draft.dispensedDrug),
  }), [draft.notes, draft.drugName, draft.dispensedDrug]);
  const anyPhi = phi.notes.hit || phi.drugName.hit || phi.dispensedDrug.hit;

  // ── Handlers ────────────────────────────────────────────────
  const onStageTap = (label: string) => {
    tap();
    // Changing stage clears L2/L3 because sub-errors are stage-specific.
    const last = (() => { try { return localStorage.getItem(LAST_CAUGHT_KEY) || ''; } catch { return ''; } })();
    update({
      errorStep: label,
      errorTypes: [],
      drugName: '', dispensedDrug: '',
      prescribedStrength: '', dispensedStrength: '',
      correctFormulation: '', dispensedFormulation: '',
      prescribedQuantity: '', dispensedQuantity: '',
      // Pre-select where-caught: last used if present, else the stage default.
      whereCaught: last || CAUGHT_DEFAULT_BY_STAGE[label] || '',
      showMoreSub: false,
    });
    setTimeout(() => l2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const toggleSub = (sub: string) => {
    tap();
    const has = draft.errorTypes.includes(sub);
    const next = has ? draft.errorTypes.filter(e => e !== sub) : [...draft.errorTypes, sub];
    update({ errorTypes: next });
    if (!has && draft.errorStep) pushRecent(draft.errorStep, sub);
    // First L2 pick → scroll to where-caught.
    if (draft.errorTypes.length === 0 && next.length === 1) {
      setTimeout(() => caughtRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  };

  const setWhereCaught = (w: string) => {
    tap();
    update({ whereCaught: w });
    try { localStorage.setItem(LAST_CAUGHT_KEY, w); } catch { /* noop */ }
    if (!draft.whereCaught) {
      setTimeout(() => factorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  };

  const toggleFactor = (f: string) => {
    tap();
    update({
      factors: draft.factors.includes(f) ? draft.factors.filter(x => x !== f) : [...draft.factors, f],
    });
  };

  const resetDraft = useCallback(() => {
    setDraft(EMPTY);
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
  }, []);

  const buildPayload = useCallback((quick: boolean) => {
    if (quick) {
      return {
        errorStep: draft.errorStep,
        errorTypes: ['Unspecified — logged quickly'],
        factors: [],
      };
    }
    const num = (s: string) => {
      const n = parseFloat(s);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    return {
      errorStep: draft.errorStep,
      errorTypes: draft.errorTypes,
      drugName: draft.drugName.trim() || undefined,
      dispensedDrug: draft.dispensedDrug.trim() || undefined,
      prescribedStrength: draft.prescribedStrength.trim() || undefined,
      dispensedStrength: draft.dispensedStrength.trim() || undefined,
      correctFormulation: draft.correctFormulation || undefined,
      dispensedFormulation: draft.dispensedFormulation || undefined,
      prescribedQuantity: num(draft.prescribedQuantity),
      dispensedQuantity: num(draft.dispensedQuantity),
      whereCaught: draft.whereCaught || undefined,
      factors: draft.factors,
      notes: draft.notes.trim() || undefined,
    };
  }, [draft]);

  const doSubmit = async (quick: boolean) => {
    if (submitting) return;
    if (!quick && (!draft.errorStep || draft.errorTypes.length === 0 || !draft.whereCaught || draft.factors.length === 0 || anyPhi)) return;
    tap();
    setSubmitting(true); setSubmitError('');
    // Snapshot what we're submitting so "Record another like this" can re-use it
    // after resetDraft() clears the form.
    setLastDraft(quick ? null : { ...draft });
    // Optimistic — show the success screen immediately. POST in background.
    setSubmittedAt(new Date().toLocaleString('en-NZ', {
      hour: '2-digit', minute: '2-digit', weekday: 'long', day: 'numeric', month: 'short',
    }));
    setSubmitted(true);
    try {
      await api.createIncident(buildPayload(quick));
      resetDraft();
    } catch (err) {
      setSubmitted(false);
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-redirect 8s after success — shorter than the old 30s.
  useEffect(() => {
    if (!submitted) return;
    const t = setTimeout(() => nav('/'), 8000);
    return () => clearTimeout(t);
  }, [submitted, nav]);

  // ── Submit-button label ─────────────────────────────────────
  const submitLabel = (() => {
    if (submitting) return 'Submitting…';
    if (anyPhi) return 'Remove patient info first';
    if (!draft.errorStep) return 'Tap where it happened';
    if (draft.errorTypes.length === 0) return 'Tap what went wrong';
    if (!draft.whereCaught) return 'Tap where it was caught';
    if (draft.factors.length === 0) return 'Tap what was happening at the time';
    return 'Submit near miss ✓';
  })();
  const canSubmit =
    !!draft.errorStep &&
    draft.errorTypes.length > 0 &&
    !!draft.whereCaught &&
    draft.factors.length > 0 &&
    !anyPhi;

  // ── Success screen ──────────────────────────────────────────
  if (submitted) {
    const recordAnother = () => {
      if (!lastDraft) return;
      tap();
      // Restore the just-submitted draft so staff can tweak and resubmit.
      setDraft(lastDraft);
      setSubmitted(false);
      setSubmitError('');
    };
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center max-w-sm mx-auto">
        <div className="w-20 h-20 rounded-full bg-[#E1F5EE] flex items-center justify-center mb-4">
          <CheckCircle2 size={40} className="text-[#0F6E56]" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Near miss recorded</h2>
        <p className="text-sm text-gray-500 mb-1">Logged at {submittedAt}</p>
        <p className="text-sm text-gray-500 mb-8">Thank you — your report helps keep patients safe.</p>
        <button onClick={() => nav('/')}
          className="w-full bg-[#0F6E56] text-white font-bold py-5 rounded-xl hover:bg-[#0B5A46] transition-colors text-base">
          Done
        </button>
        {lastDraft && (
          <button onClick={recordAnother}
            className="w-full mt-3 bg-white text-[#0F6E56] border-2 border-[#0F6E56] font-semibold py-4 rounded-xl hover:bg-gray-50 transition-colors text-base">
            Record another like this
          </button>
        )}
        <p className="text-xs text-gray-300 mt-6">Returning home in 8s…</p>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {submitError && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {submitError}
          </div>
        )}

        {/* ── Layer 1: stage ── */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Where did this happen?</h2>
          <div className="grid grid-cols-2 gap-2">
            {STAGES.map(s => (
              <button
                key={s.label}
                onClick={() => onStageTap(s.label)}
                className={`chip justify-center text-center text-base font-bold leading-tight py-4 ${draft.errorStep === s.label ? 'chip-green' : 'chip-off'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Layer 2: sub-errors ── */}
        {stage && (
          <section ref={l2Ref}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-900">What went wrong?</h2>
              <button
                onClick={() => doSubmit(true)}
                className="text-xs text-gray-500 underline hover:text-gray-700"
              >
                Don't know — just log it
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {visibleSubs.map(s => (
                <button
                  key={s.label}
                  onClick={() => toggleSub(s.label)}
                  className={`chip text-base font-semibold py-3 px-4 ${draft.errorTypes.includes(s.label) ? 'chip-coral' : s.recent ? 'chip-off border-[#1D9E75]' : 'chip-off'}`}
                >
                  {s.recent && <span className="text-[10px] text-[#1D9E75] mr-1">recent</span>}
                  {s.label}
                </button>
              ))}
              {hasHiddenSubs && (
                <button
                  onClick={() => { tap(); update({ showMoreSub: true }); }}
                  className="chip text-base font-semibold chip-other"
                >
                  More…
                </button>
              )}
            </div>
          </section>
        )}

        {/* ── Layer 3: intended → given ── */}
        {draft.errorTypes.length > 0 && (triggers.drug || triggers.strength || triggers.quantity || triggers.formulation) && (
          <section className="space-y-3">
            {triggers.drug && (
              <IntendedGiven
                label="Drug"
                a={draft.drugName} onA={v => update({ drugName: v })}
                b={draft.dispensedDrug} onB={v => update({ dispensedDrug: v })}
                aHint="Prescribed (e.g. Losartan)"
                bHint="Given in error (e.g. Lisinopril)"
                datalistId="drug-suggestions"
                aPhi={phi.drugName}
                bPhi={phi.dispensedDrug}
              />
            )}
            {triggers.strength && (
              <IntendedGiven
                label="Strength"
                a={draft.prescribedStrength} onA={v => update({ prescribedStrength: v })}
                b={draft.dispensedStrength} onB={v => update({ dispensedStrength: v })}
                aHint="Prescribed (e.g. 25mg)"
                bHint="Given (e.g. 50mg)"
              />
            )}
            {triggers.quantity && (
              <IntendedGivenNumeric
                label="Quantity"
                a={draft.prescribedQuantity} onA={v => update({ prescribedQuantity: v })}
                b={draft.dispensedQuantity} onB={v => update({ dispensedQuantity: v })}
              />
            )}
            {triggers.formulation && (
              <IntendedGivenSelect
                label="Formulation"
                a={draft.correctFormulation} onA={v => update({ correctFormulation: v })}
                b={draft.dispensedFormulation} onB={v => update({ dispensedFormulation: v })}
                options={FORMULATIONS}
              />
            )}
            <p className="text-[11px] text-gray-400 italic">Optional — you can submit without filling these.</p>
          </section>
        )}

        <datalist id="drug-suggestions">
          {DRUG_SUGGESTIONS.map(d => <option key={d} value={d} />)}
        </datalist>

        {/* ── Where caught ── */}
        {draft.errorTypes.length > 0 && (
          <section ref={caughtRef}>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Where was it caught?</h2>
            <div className="flex flex-wrap gap-1.5">
              {WHERE_CAUGHT.map(w => (
                <button
                  key={w}
                  onClick={() => setWhereCaught(w)}
                  className={`chip text-base font-semibold py-3 px-4 ${draft.whereCaught === w ? 'chip-blue' : 'chip-off'}`}
                >
                  {w}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Factors ── */}
        {draft.whereCaught && (
          <section ref={factorsRef}>
            <h2 className="text-lg font-bold text-gray-900 mb-2">What was happening at the time?</h2>
            <div className="flex flex-wrap gap-1.5">
              {visibleFactors.map(f => (
                <button
                  key={f}
                  onClick={() => toggleFactor(f)}
                  className={`chip text-base font-semibold py-3 px-4 ${draft.factors.includes(f) ? 'chip-amber' : 'chip-off'}`}
                >
                  {f}
                </button>
              ))}
              {!draft.showMoreFactors && FACTORS.length > FACTORS_DEFAULT_VISIBLE && (
                <button
                  onClick={() => { tap(); update({ showMoreFactors: true }); }}
                  className="chip text-base font-semibold chip-other"
                >
                  More factors…
                </button>
              )}
            </div>
          </section>
        )}

        {/* ── Anything else (optional) ── */}
        {draft.factors.length > 0 && (
          <section>
            {!draft.showAnythingElse ? (
              <button
                onClick={() => { tap(); update({ showAnythingElse: true }); }}
                className="text-sm text-[#0F6E56] font-medium hover:underline"
              >
                + Anything else?
              </button>
            ) : (
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Anything else (optional)</label>
                <textarea
                  value={draft.notes}
                  onChange={e => update({ notes: e.target.value })}
                  maxLength={200}
                  rows={3}
                  className="input-field text-sm resize-none"
                  placeholder="Short context — no patient names, NHI, or dates of birth"
                  autoFocus
                />
                {phi.notes.hit && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle size={12} /> {phiHint(phi.notes.kinds)}
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Sticky submit ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg z-40">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => doSubmit(false)}
            disabled={!canSubmit || submitting}
            className={`w-full py-5 rounded-xl font-bold text-base transition-colors ${canSubmit && !submitting ? 'bg-[#0F6E56] text-white active:bg-[#094A3A]' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
          >
            {submitLabel}
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-1.5">
            Anonymous — your manager sees what happened, not who submitted it.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Shared Layer 3 field components ──────────────────────────────

function IntendedGiven(props: {
  label: string;
  a: string; onA: (v: string) => void;
  b: string; onB: (v: string) => void;
  aHint: string; bHint: string;
  datalistId?: string;
  aPhi?: { hit: boolean; kinds: PhiKind[] };
  bPhi?: { hit: boolean; kinds: PhiKind[] };
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">{props.label} — intended → given</p>
      <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
        <input type="text" value={props.a} onChange={e => props.onA(e.target.value)}
          list={props.datalistId} className="input-field text-sm py-2" placeholder={props.aHint} />
        <ArrowRight size={14} className="text-gray-400 mb-2.5" />
        <input type="text" value={props.b} onChange={e => props.onB(e.target.value)}
          list={props.datalistId} className="input-field text-sm py-2" placeholder={props.bHint} />
      </div>
      {(props.aPhi?.hit || props.bPhi?.hit) && (
        <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
          <AlertTriangle size={12} /> Looks like patient info — use a drug name only.
        </p>
      )}
    </div>
  );
}

function IntendedGivenNumeric(props: {
  label: string;
  a: string; onA: (v: string) => void;
  b: string; onB: (v: string) => void;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">{props.label} — intended → given</p>
      <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
        <input type="number" inputMode="decimal" min="0" step="any" value={props.a}
          onChange={e => props.onA(e.target.value)}
          className="input-field text-sm py-2" placeholder="e.g. 30" />
        <ArrowRight size={14} className="text-gray-400 mb-2.5" />
        <input type="number" inputMode="decimal" min="0" step="any" value={props.b}
          onChange={e => props.onB(e.target.value)}
          className="input-field text-sm py-2" placeholder="e.g. 60" />
      </div>
    </div>
  );
}

function IntendedGivenSelect(props: {
  label: string;
  a: string; onA: (v: string) => void;
  b: string; onB: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">{props.label} — intended → given</p>
      <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
        <select value={props.a} onChange={e => props.onA(e.target.value)} className="input-field text-sm py-2">
          <option value="">Choose…</option>
          {props.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ArrowRight size={14} className="text-gray-400 mb-2.5" />
        <select value={props.b} onChange={e => props.onB(e.target.value)} className="input-field text-sm py-2">
          <option value="">Choose…</option>
          {props.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    </div>
  );
}
