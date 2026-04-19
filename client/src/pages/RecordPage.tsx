import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { detectPHI, phiHint, PhiKind } from '../lib/phi';
import {
  STAGES, WHERE_CAUGHT, CAUGHT_DEFAULT_BY_STAGE, FACTORS,
  FACTORS_DEFAULT_VISIBLE, FORMULATIONS, DRUG_SUGGESTIONS, triggersFor,
} from '../lib/taxonomy';
import { CheckCircle2, AlertTriangle, ArrowRight, ChevronDown, ChevronUp, Clock } from 'lucide-react';

const SESSION_KEY = 'nmp_record_draft';
const LAST_CAUGHT_KEY = 'nmp_last_where_caught';
const RECENT_KEY = (stage: string) => `nmp_recent_${stage}`;

function tap() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(10); } catch { /* noop */ }
  }
}

function todayYMD(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function nowHM(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Semantic colour for a sub-error chip based on its text. Matches the old style:
// coral = drug swap, amber = strength/dose, purple = formulation, green = other.
function subColor(label: string, selected: boolean): string {
  if (!selected) return 'chip-off';
  const l = label.toLowerCase();
  if (l.includes('wrong drug') || l.includes('look-alike') || l.includes('sound-alike') || l.includes('drug on label') || l.includes('drug entered')) return 'chip-coral';
  if (l.includes('strength') || l.includes('dose')) return 'chip-amber';
  if (l.includes('formulation')) return 'chip-purple';
  return 'chip-green';
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
  const [openSection, setOpenSection] = useState<number>(1);
  // Track the incident we just created so "Fix something" and "Oops" can act on it.
  const [submittedIncidentId, setSubmittedIncidentId] = useState<string>('');
  const [editableUntil, setEditableUntil] = useState<string>('');
  // Non-null while the user is editing an existing incident (submit uses PATCH).
  const [editingIncidentId, setEditingIncidentId] = useState<string>('');
  // Set to true after the user taps "Oops" so the success screen shows
  // reassurance text instead of secondary buttons.
  const [retracted, setRetracted] = useState(false);
  // "When did it happen?" — pre-filled with now. If staff adjust, we send
  // occurredAt; the server validates and re-derives time_of_day from it.
  const [occurredDate, setOccurredDate] = useState<string>(() => todayYMD());
  const [occurredTime, setOccurredTime] = useState<string>(() => nowHM());
  // Snapshot of the last-submitted time block, so "Fix something" can restore it.
  const [lastOccurred, setLastOccurred] = useState<{ date: string; time: string } | null>(null);

  const l2Ref = useRef<HTMLDivElement>(null);
  const caughtRef = useRef<HTMLDivElement>(null);
  const factorsRef = useRef<HTMLDivElement>(null);

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
    setOpenSection(2);
    setTimeout(() => l2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const toggleSub = (sub: string) => {
    tap();
    const has = draft.errorTypes.includes(sub);
    const next = has ? draft.errorTypes.filter(e => e !== sub) : [...draft.errorTypes, sub];
    update({ errorTypes: next });
    if (!has && draft.errorStep) pushRecent(draft.errorStep, sub);
  };

  const setWhereCaught = (w: string) => {
    tap();
    update({ whereCaught: w });
    try { localStorage.setItem(LAST_CAUGHT_KEY, w); } catch { /* noop */ }
    setOpenSection(4);
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
    // Combine date + time into an ISO string; omit if invalid.
    let occurredAt: string | undefined;
    if (occurredDate && occurredTime) {
      const d = new Date(`${occurredDate}T${occurredTime}`);
      if (!Number.isNaN(d.getTime())) occurredAt = d.toISOString();
    }
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
      occurredAt,
    };
  }, [draft, occurredDate, occurredTime]);

  const doSubmit = async (quick: boolean) => {
    if (submitting) return;
    if (!quick && (!draft.errorStep || draft.errorTypes.length === 0 || !draft.whereCaught || draft.factors.length === 0 || anyPhi)) return;
    tap();
    setSubmitting(true); setSubmitError('');
    // Snapshot what we're submitting so "Record another like this" and
    // "Fix something" can re-use it after resetDraft() clears the form.
    setLastDraft(quick ? null : { ...draft });
    setLastOccurred(quick ? null : { date: occurredDate, time: occurredTime });
    // Optimistic — show the success screen immediately. POST/PATCH in background.
    setSubmittedAt(new Date().toLocaleString('en-NZ', {
      hour: '2-digit', minute: '2-digit', weekday: 'long', day: 'numeric', month: 'short',
    }));
    setSubmitted(true);
    setRetracted(false);
    try {
      const payload = buildPayload(quick);
      if (editingIncidentId) {
        // Save changes to an existing incident — keep the same id + edit window.
        await api.editIncident(editingIncidentId, payload);
      } else {
        const incident = await api.createIncident(payload) as { id: string; editable_until: string };
        setSubmittedIncidentId(incident.id);
        setEditableUntil(incident.editable_until);
      }
      resetDraft();
      setEditingIncidentId('');
    } catch (err) {
      setSubmitted(false);
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // "Fix something" — restore the just-submitted draft into the form and
  // switch the next Submit to an edit (PATCH).
  const fixSomething = () => {
    if (!lastDraft || !submittedIncidentId) return;
    tap();
    setDraft(lastDraft);
    if (lastOccurred) {
      setOccurredDate(lastOccurred.date);
      setOccurredTime(lastOccurred.time);
    }
    setEditingIncidentId(submittedIncidentId);
    setSubmitted(false);
    setSubmitError('');
    setOpenSection(1);
  };

  // "Oops — this one wasn't a near-miss" — flag for manager review. Stays on
  // the success screen but replaces the secondary buttons with a reassurance.
  const oopsWasntNearMiss = async () => {
    if (!submittedIncidentId || retracted) return;
    tap();
    setRetracted(true);
    try { await api.flagIncident(submittedIncidentId, 'Submitted in error'); }
    catch { /* fire-and-forget; manager can still see the record */ }
  };

  // Auto-redirect after the success screen — long enough to read 4 buttons
  // and decide. Pause entirely after the user taps "Oops" so the reassurance
  // message stays put. Tapping Fix/Record-another flips submitted → false
  // which cancels via the cleanup below.
  useEffect(() => {
    if (!submitted || retracted) return;
    const t = setTimeout(() => nav('/'), 30000);
    return () => clearTimeout(t);
  }, [submitted, retracted, nav]);

  // ── Submit-button label ─────────────────────────────────────
  const submitLabel = (() => {
    if (submitting) return editingIncidentId ? 'Saving…' : 'Submitting…';
    if (anyPhi) return 'Remove patient info first';
    if (!draft.errorStep) return 'Tap where it happened';
    if (draft.errorTypes.length === 0) return 'Tap what went wrong';
    if (!draft.whereCaught) return 'Tap where it was caught';
    if (draft.factors.length === 0) return 'Tap what was happening at the time';
    return editingIncidentId ? 'Save changes' : 'Submit near miss ✓';
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
    // Secondary options (edit / retract) available only while the edit
    // window is open and only for real submissions (not "just log it").
    const withinEditWindow = !!editableUntil && new Date(editableUntil) > new Date();
    const canTidy = withinEditWindow && !!submittedIncidentId && !!lastDraft;
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
        {retracted ? (
          <div className="w-full mt-3 bg-[#F0FAF5] border-2 border-[#C8E6D8] rounded-xl px-4 py-3 text-sm text-[#085041] leading-snug">
            All good — your manager will tidy it up. Nothing else to do.
          </div>
        ) : (
          <>
            {lastDraft && (
              <button onClick={recordAnother}
                className="w-full mt-3 bg-white text-[#0F6E56] border-2 border-[#0F6E56] font-semibold py-4 rounded-xl hover:bg-gray-50 transition-colors text-base">
                Record another like this
              </button>
            )}
            {canTidy && (
              <>
                <button onClick={fixSomething}
                  className="w-full mt-3 bg-white text-gray-700 border border-gray-300 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Fix something
                </button>
                <button onClick={oopsWasntNearMiss}
                  className="w-full mt-2 bg-white text-gray-500 border border-gray-200 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Oops — this one wasn't a near-miss
                </button>
              </>
            )}
          </>
        )}
        {!retracted && <p className="text-xs text-gray-300 mt-6">Returning home in 30s…</p>}
      </div>
    );
  }

  // ── Derived for sidebar summary ─────────────────────────────
  const hasStage = !!draft.errorStep;
  const hasSub = draft.errorTypes.length > 0;
  const hasCaught = !!draft.whereCaught;
  const hasFactor = draft.factors.length > 0;

  const summaryTags: { label: string; color: string }[] = [];
  if (draft.errorStep) summaryTags.push({ label: draft.errorStep, color: 'chip-teal' });
  draft.errorTypes.forEach(e => summaryTags.push({ label: e, color: subColor(e, true) }));
  if (draft.drugName && draft.dispensedDrug) summaryTags.push({ label: `${draft.drugName} → ${draft.dispensedDrug}`, color: 'chip-coral' });
  if (draft.prescribedStrength && draft.dispensedStrength) summaryTags.push({ label: `${draft.prescribedStrength} → ${draft.dispensedStrength}`, color: 'chip-amber' });
  if (draft.correctFormulation && draft.dispensedFormulation) summaryTags.push({ label: `${draft.correctFormulation} → ${draft.dispensedFormulation}`, color: 'chip-purple' });
  if (draft.prescribedQuantity && draft.dispensedQuantity) summaryTags.push({ label: `qty ${draft.prescribedQuantity} → ${draft.dispensedQuantity}`, color: 'chip-amber' });
  if (draft.whereCaught) summaryTags.push({ label: `caught: ${draft.whereCaught}`, color: 'chip-blue' });
  draft.factors.forEach(f => summaryTags.push({ label: f, color: 'chip-amber' }));

  // Helper for section headers
  const toggleSection = (n: number) => { tap(); setOpenSection(openSection === n ? 0 : n); };
  const SectionHeader = ({ num, title, subtitle, done, open, onClick }: { num: number; title: string; subtitle: string; done: boolean; open: boolean; onClick: () => void }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl text-left transition-colors ${open ? 'bg-white shadow-sm border border-gray-200' : done ? 'bg-[#F0FAF5] border border-[#C8E6D8]' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${done ? 'bg-[#1D9E75] text-white' : open ? 'bg-[#0F6E56] text-white' : 'bg-gray-300 text-white'}`}>
        {done ? <svg width="12" height="10" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : num}
      </div>
      <div className="flex-1">
        <span className={`text-sm font-semibold ${done ? 'text-[#085041]' : 'text-gray-900'}`}>{title}</span>
        {!done && !open && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {done && !open && <span className="text-xs text-[#1D9E75]">✓ Done</span>}
      {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
    </button>
  );

  // ── Form ────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-32 lg:pb-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── LEFT: Form ── */}
        <div className="flex-1 min-w-0 space-y-3">
          {submitError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> {submitError}
            </div>
          )}

          {editingIncidentId && (
            <div className="p-3 bg-[#EEEDFE] border border-[#7F77DD] rounded-xl text-sm text-[#3C3489] flex items-center gap-2">
              <span className="font-semibold">Editing your report</span>
              <span>— change anything you need, then tap Save changes.</span>
            </div>
          )}

          {/* ─ When did it happen? — pre-filled, optional adjust ─ */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-2 flex-wrap">
            <Clock size={14} className="text-gray-400" />
            <span className="text-sm text-gray-600">Happened</span>
            <input type="date" value={occurredDate}
              max={todayYMD()}
              onChange={e => setOccurredDate(e.target.value)}
              className="text-sm text-gray-800 bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] rounded px-1 py-0.5" />
            <span className="text-sm text-gray-500">at</span>
            <input type="time" value={occurredTime}
              onChange={e => setOccurredTime(e.target.value)}
              className="text-sm text-gray-800 bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] rounded px-1 py-0.5" />
            <span className="text-[11px] text-gray-400 ml-auto">Adjust only if logging later</span>
          </div>

          {/* ═══ Section 1: Where did this happen? ═══ */}
          <SectionHeader num={1} title="Where did this happen?" subtitle="Pick the step where the error happened" done={hasStage} open={openSection === 1} onClick={() => toggleSection(1)} />
          {openSection === 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="grid grid-cols-2 gap-2">
                {STAGES.map(s => (
                  <button
                    key={s.label}
                    onClick={() => onStageTap(s.label)}
                    className={`chip justify-center text-center text-base font-bold leading-tight py-4 ${draft.errorStep === s.label ? 'chip-teal' : 'chip-off'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Section 2: What went wrong? ═══ */}
          <SectionHeader num={2} title="What went wrong?" subtitle={hasStage ? 'Pick one or more that apply' : 'Choose a step first'} done={hasSub} open={openSection === 2} onClick={() => { if (hasStage) toggleSection(2); }} />
          {openSection === 2 && stage && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3" ref={l2Ref}>
              <div className="flex flex-wrap gap-1.5">
                {visibleSubs.map(s => (
                  <button
                    key={s.label}
                    onClick={() => toggleSub(s.label)}
                    className={`chip text-base font-semibold py-3 px-4 ${subColor(s.label, draft.errorTypes.includes(s.label))} ${s.recent && !draft.errorTypes.includes(s.label) ? 'border-[#1D9E75]' : ''}`}
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

              {/* Layer 3 — intended → given, inline when triggered */}
              {(triggers.drug || triggers.strength || triggers.quantity || triggers.formulation) && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  {triggers.drug && (
                    <IntendedGiven
                      label="Drug" colour="coral"
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
                      label="Strength" colour="amber"
                      a={draft.prescribedStrength} onA={v => update({ prescribedStrength: v })}
                      b={draft.dispensedStrength} onB={v => update({ dispensedStrength: v })}
                      aHint="Prescribed (e.g. 25mg)"
                      bHint="Given (e.g. 50mg)"
                    />
                  )}
                  {triggers.quantity && (
                    <IntendedGivenNumeric
                      label="Quantity" colour="amber"
                      a={draft.prescribedQuantity} onA={v => update({ prescribedQuantity: v })}
                      b={draft.dispensedQuantity} onB={v => update({ dispensedQuantity: v })}
                    />
                  )}
                  {triggers.formulation && (
                    <IntendedGivenSelect
                      label="Formulation" colour="purple"
                      a={draft.correctFormulation} onA={v => update({ correctFormulation: v })}
                      b={draft.dispensedFormulation} onB={v => update({ dispensedFormulation: v })}
                      options={FORMULATIONS}
                    />
                  )}
                  <p className="text-[11px] text-gray-400 italic">Optional — you can submit without filling these.</p>
                </div>
              )}

              {hasSub && (
                <button onClick={() => setOpenSection(3)} className="mt-1 text-sm font-medium text-[#0F6E56] flex items-center gap-1 hover:underline">
                  Next: Where was it caught? <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}

          <datalist id="drug-suggestions">
            {DRUG_SUGGESTIONS.map(d => <option key={d} value={d} />)}
          </datalist>

          {/* ═══ Section 3: Where was it caught? ═══ */}
          <SectionHeader num={3} title="Where was it caught?" subtitle={hasStage ? 'Pre-selected based on the step' : ''} done={hasCaught} open={openSection === 3} onClick={() => { if (hasStage) toggleSection(3); }} />
          {openSection === 3 && hasStage && (
            <div className="bg-white rounded-xl border border-gray-200 p-4" ref={caughtRef}>
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
            </div>
          )}

          {/* ═══ Section 4: What was happening at the time? ═══ */}
          <SectionHeader num={4} title="What was happening at the time?" subtitle="Any factors that may have contributed" done={hasFactor} open={openSection === 4} onClick={() => { if (hasCaught) toggleSection(4); }} />
          {openSection === 4 && hasCaught && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3" ref={factorsRef}>
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

              {!draft.showAnythingElse ? (
                <button
                  onClick={() => { tap(); update({ showAnythingElse: true }); }}
                  className="text-sm text-[#0F6E56] font-medium hover:underline"
                >
                  + Anything else?
                </button>
              ) : (
                <div className="space-y-1 pt-2 border-t border-gray-100">
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
            </div>
          )}

          {/* Mobile submit — sticky bottom, only on small screens */}
          <div className="lg:hidden mt-2">
            <p className="text-[10px] text-gray-400 text-center mb-1">Anonymous — your manager sees what happened, not who submitted it.</p>
            <p className="text-[10px] text-gray-400 text-center mb-2">Submitted by mistake? You can tell your manager with one tap on the next screen — no blame.</p>
            <button
              onClick={() => doSubmit(false)}
              disabled={!canSubmit || submitting}
              className={`w-full py-4 rounded-xl font-bold text-base ${canSubmit && !submitting ? 'bg-[#0F6E56] text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              {submitLabel}
            </button>
          </div>
        </div>

        {/* ── RIGHT: Sidebar (desktop only) ── */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-16 space-y-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Summary</h3>
              {summaryTags.length === 0 ? (
                <p className="text-xs text-gray-300 italic">Select a step to begin.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {summaryTags.map((t, i) => <span key={i} className={`inline-block text-[11px] py-0.5 px-2 rounded-full font-medium border ${t.color}`}>{t.label}</span>)}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              {[
                { met: hasStage, label: 'Step where it happened' },
                { met: hasSub, label: 'What went wrong' },
                { met: hasCaught, label: 'Where caught' },
                { met: hasFactor, label: 'Factor' },
              ].map(({ met, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${met ? 'bg-[#1D9E75]' : 'bg-gray-200'}`}>
                    {met && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className={`text-xs ${met ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{label}</span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-gray-400 text-center leading-tight">Anonymous — your manager sees what happened, not who submitted it.</p>
            <p className="text-[10px] text-gray-400 text-center leading-tight">Submitted by mistake? You can tell your manager with one tap on the next screen — no blame.</p>

            <button
              onClick={() => doSubmit(false)}
              disabled={!canSubmit || submitting}
              className={`w-full py-3 rounded-xl font-semibold text-sm ${canSubmit && !submitting ? 'bg-[#0F6E56] text-white hover:bg-[#0B5A46]' : 'bg-[#CCCCCC] text-gray-500 cursor-not-allowed'}`}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared Layer 3 field components ──────────────────────────────

type BoxColour = 'coral' | 'amber' | 'purple' | 'gray';

const BOX_STYLE: Record<BoxColour, { border: string; bg: string; title: string; arrow: string }> = {
  coral:  { border: 'border-[#D85A30]', bg: '#FFF5F0', title: 'text-[#712B13]', arrow: 'text-[#D85A30]' },
  amber:  { border: 'border-[#BA7517]', bg: '#FFFBF0', title: 'text-[#633806]', arrow: 'text-[#BA7517]' },
  purple: { border: 'border-[#7F77DD]', bg: '#F5F3FF', title: 'text-[#3C3489]', arrow: 'text-[#7F77DD]' },
  gray:   { border: 'border-gray-200', bg: '#F9FAFB', title: 'text-gray-700',  arrow: 'text-gray-400' },
};

function IntendedGiven(props: {
  label: string;
  colour?: BoxColour;
  a: string; onA: (v: string) => void;
  b: string; onB: (v: string) => void;
  aHint: string; bHint: string;
  datalistId?: string;
  aPhi?: { hit: boolean; kinds: PhiKind[] };
  bPhi?: { hit: boolean; kinds: PhiKind[] };
}) {
  const c = BOX_STYLE[props.colour || 'gray'];
  return (
    <div className={`rounded-xl p-3 border-[1.5px] ${c.border}`} style={{ background: c.bg }}>
      <p className={`text-xs font-semibold ${c.title} mb-2`}>{props.label} — intended → given</p>
      <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
        <input type="text" value={props.a} onChange={e => props.onA(e.target.value)}
          list={props.datalistId} className="input-field text-sm py-2" placeholder={props.aHint} />
        <ArrowRight size={14} className={`${c.arrow} mb-2.5`} />
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
  colour?: BoxColour;
  a: string; onA: (v: string) => void;
  b: string; onB: (v: string) => void;
}) {
  const c = BOX_STYLE[props.colour || 'gray'];
  return (
    <div className={`rounded-xl p-3 border-[1.5px] ${c.border}`} style={{ background: c.bg }}>
      <p className={`text-xs font-semibold ${c.title} mb-2`}>{props.label} — intended → given</p>
      <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
        <input type="number" inputMode="decimal" min="0" step="any" value={props.a}
          onChange={e => props.onA(e.target.value)}
          className="input-field text-sm py-2" placeholder="e.g. 30" />
        <ArrowRight size={14} className={`${c.arrow} mb-2.5`} />
        <input type="number" inputMode="decimal" min="0" step="any" value={props.b}
          onChange={e => props.onB(e.target.value)}
          className="input-field text-sm py-2" placeholder="e.g. 60" />
      </div>
    </div>
  );
}

function IntendedGivenSelect(props: {
  label: string;
  colour?: BoxColour;
  a: string; onA: (v: string) => void;
  b: string; onB: (v: string) => void;
  options: string[];
}) {
  const c = BOX_STYLE[props.colour || 'gray'];
  return (
    <div className={`rounded-xl p-3 border-[1.5px] ${c.border}`} style={{ background: c.bg }}>
      <p className={`text-xs font-semibold ${c.title} mb-2`}>{props.label} — intended → given</p>
      <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
        <select value={props.a} onChange={e => props.onA(e.target.value)} className="input-field text-sm py-2">
          <option value="">Choose…</option>
          {props.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ArrowRight size={14} className={`${c.arrow} mb-2.5`} />
        <select value={props.b} onChange={e => props.onB(e.target.value)} className="input-field text-sm py-2">
          <option value="">Choose…</option>
          {props.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    </div>
  );
}
