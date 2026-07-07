import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { detectPHI, phiHint, PhiKind } from '../lib/phi';
import {
  STAGES, WHERE_CAUGHT, CAUGHT_DEFAULT_BY_STAGE, FACTORS,
  FACTORS_DEFAULT_VISIBLE, FORMULATIONS, triggersFor, isNonDrugError,
} from '../lib/taxonomy';
import type { SubError } from '../lib/taxonomy';
import { NZ_DRUG_LIST, isKnownNzDrug, readDrugHistory, recordDrugInHistory } from '../lib/nzDrugList';
import { checkHighRisk } from '../lib/highRiskDrugs';
import { looksLikeGibberish } from '../lib/gibberish';
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

// The "nothing stood out" escape for Section 4 — lets the form proceed
// when no contributing factor applies, without pretending one did.
const NO_FACTOR = 'No obvious reason';

// Semantic colour for a sub-error chip based on its text. Matches the old style:
// coral = drug swap, amber = strength/dose, purple = formulation, green = other.
function subColor(label: string, selected: boolean): string {
  if (!selected) return 'chip-off';
  const l = label.toLowerCase();
  if (l.includes('wrong drug') || l.includes('look-alike') || l.includes('sound-alike') || l.includes('drug on label') || l.includes('drug entered') || l.includes('brand')) return 'chip-coral';
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

  // Pharmacy-wide custom chips loaded from the server. When the user
  // taps "+ Other" we POST the typed label so it sticks around as a
  // normal chip for every staff member on every device. Deleted via the
  // × on the chip OR via the management UI in Settings → Pharmacy.
  type CustomItem = { id: string; label: string };
  const [customChips, setCustomChips] = useState<{
    stage: CustomItem[]; error_type: CustomItem[]; where_caught: CustomItem[]; factor: CustomItem[];
  }>({ stage: [], error_type: [], where_caught: [], factor: [] });
  const [customLimitMsg, setCustomLimitMsg] = useState('');
  useEffect(() => {
    api.listCustomOptions()
      .then(r => setCustomChips(r))
      .catch(() => { /* not fatal — form still works with built-in chips */ });
  }, []);
  const addCustomChip = useCallback(async (section: 'stage' | 'error_type' | 'where_caught' | 'factor', label: string): Promise<boolean> => {
    setCustomLimitMsg('');
    try {
      const saved = await api.addCustomOption(section, label);
      setCustomChips(prev => {
        if (prev[section].some(c => c.label === saved.label)) return prev;
        return { ...prev, [section]: [...prev[section], { id: saved.id, label: saved.label }] };
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save';
      setCustomLimitMsg(msg);
      return false;
    }
  }, []);
  const removeCustomChip = useCallback(async (section: 'stage' | 'error_type' | 'where_caught' | 'factor', id: string) => {
    // Optimistic — pop it out, then call delete. If delete fails the
    // worst case is it reappears next time the page is opened.
    setCustomChips(prev => ({ ...prev, [section]: prev[section].filter(c => c.id !== id) }));
    try { await api.deleteCustomOption(id); } catch { /* silent */ }
  }, []);

  // Patient-reached gate — the form's opening question. A near miss is by
  // definition caught BEFORE the medication reaches the patient. If it
  // reached them, this is a dispensing error and belongs in a different
  // process. We don't capture it here.
  //   null   → not yet answered (gate is showing)
  //   'yes'  → caught before patient (continue logging as near miss)
  //   'no'   → reached patient (show redirect, don't continue)
  // Stored in sessionStorage alongside the draft so a navigate-and-back
  // resumes the session. Skipped entirely when editing an existing incident.
  const GATE_KEY = 'nmp_record_gate';
  const [gate, setGate] = useState<'yes' | 'no' | null>(() => {
    try {
      const v = sessionStorage.getItem(GATE_KEY);
      return v === 'yes' || v === 'no' ? v : null;
    } catch { return null; }
  });
  useEffect(() => {
    try {
      if (gate) sessionStorage.setItem(GATE_KEY, gate);
      else sessionStorage.removeItem(GATE_KEY);
    } catch { /* noop */ }
  }, [gate]);

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
    const acc = { drug: false, strength: false, quantity: false, formulation: false, interaction: false };
    for (const sub of draft.errorTypes) {
      const t = triggersFor(sub);
      acc.drug ||= t.drug;
      acc.strength ||= t.strength;
      acc.quantity ||= t.quantity;
      acc.formulation ||= t.formulation;
      acc.interaction ||= t.interaction;
    }
    return acc;
  }, [draft.errorTypes]);

  // True when the chosen error type implies a specific medicine — drug name
  // becomes required so reports and pattern matching can group properly.
  // Default to required as soon as an error type is picked; only relaxed when
  // EVERY selected error type is genuinely not about a medicine (wrong
  // patient, NHI mismatch, register not signed, bag mix-up, etc).
  const drugRequired = draft.errorTypes.length > 0
    && !draft.errorTypes.every(e => isNonDrugError(e));

  // Autocomplete suggestions: pharmacy's own drug history first (encourages
  // canonical spelling propagation), then the bundled NZ list as fallback.
  // Re-read history on each open so newly-logged drugs surface immediately.
  const drugSuggestions = useMemo(() => {
    const history = readDrugHistory();
    const historyLower = new Set(history.map(s => s.toLowerCase()));
    const nzExtras = NZ_DRUG_LIST.filter(d => !historyLower.has(d.toLowerCase()));
    return [...history, ...nzExtras];
    // Recompute when the form opens (re-mounts) — using submitted to invalidate.
  }, [submitted]);

  // Typo hint: drug typed isn't in pharmacy history nor the NZ list.
  // Doesn't block submit — could be a private-supply or imported drug —
  // but nudges the user to double-check spelling so patterns group.
  const drugNotRecognised = useMemo(() => {
    const v = draft.drugName.trim();
    if (!v) return false;
    if (isKnownNzDrug(v)) return false;
    const history = readDrugHistory();
    return !history.some(s => s.toLowerCase() === v.toLowerCase());
  }, [draft.drugName]);

  // High-risk drug detection — Medsafe-aligned. Two distinct cases:
  //   A) the prescribed drug is high-risk → standard dispensing guidance.
  //   B) the high-risk drug appears only as the 'given in error' drug
  //      (a wrong-drug swap) → standard dispensing advice is irrelevant.
  //      The near miss IS the swap; what matters is preventing the next
  //      one (shelf separation, TALLman lettering, second check).
  const highRisk = useMemo(() => {
    const prescribedMatch = checkHighRisk(draft.drugName);
    const dispensedMatch = checkHighRisk(draft.dispensedDrug);
    if (prescribedMatch) return { ...prescribedMatch, swapContext: false };
    if (dispensedMatch) {
      // The high-risk drug was the one almost handed out by mistake.
      return {
        category: dispensedMatch.category,
        guidance: `${draft.dispensedDrug.trim() || dispensedMatch.category} is high-risk and was almost given by mistake. Even though caught, this matters — wrong-${dispensedMatch.category.toLowerCase()} swaps can be fatal. Move it away from look-alike items, use TALLman lettering on the bin, and require a second-pharmacist check at picking.`,
        swapContext: true,
      };
    }
    return null;
  }, [draft.drugName, draft.dispensedDrug]);

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

  // Drug + error-type hotspot: is the same (drug, primary error) pair already
  // 2+ in the last 30 days? Debounced 500ms so we don't hammer the endpoint
  // while the user is still typing the drug name.
  const [hotspot, setHotspot] = useState<{ count: number; days: number; drug: string; errorType: string } | null>(null);
  useEffect(() => {
    const drug = draft.drugName.trim();
    const primary = draft.errorTypes[0];
    if (drug.length < 3 || !primary) { setHotspot(null); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      api.checkHotspot(drug, primary)
        .then(r => {
          if (cancelled) return;
          setHotspot(r.isHotspot ? { count: r.count, days: r.days, drug, errorType: primary } : null);
        })
        .catch(() => { if (!cancelled) setHotspot(null); });
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [draft.drugName, draft.errorTypes]);

  // ── Handlers ────────────────────────────────────────────────
  const onStageTap = (label: string) => {
    tap();
    // Tapping the already-selected stage deselects everything and returns
    // to Section 1. Tapping a different stage switches to it and wipes
    // L2/L3 because sub-errors are stage-specific.
    if (draft.errorStep === label) {
      update({
        errorStep: '', errorTypes: [],
        drugName: '', dispensedDrug: '',
        prescribedStrength: '', dispensedStrength: '',
        correctFormulation: '', dispensedFormulation: '',
        prescribedQuantity: '', dispensedQuantity: '',
        whereCaught: '', factors: [],
        showMoreSub: false,
      });
      setOpenSection(1);
      return;
    }
    update({
      errorStep: label,
      errorTypes: [],
      drugName: '', dispensedDrug: '',
      prescribedStrength: '', dispensedStrength: '',
      correctFormulation: '', dispensedFormulation: '',
      prescribedQuantity: '', dispensedQuantity: '',
      // Where-caught is left BLANK on purpose. Previously we
      // pre-filled it with the last-used value or a stage default,
      // which made Section 3 show "Done" the moment a stage was
      // picked — confusing because the user had never touched it
      // and it looked like the section had auto-popped.
      whereCaught: '',
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

  // Umbrella chips: a sub-error with `refinements` expands into specific parts
  // (e.g. "Wrong directions" → dose/frequency/route). The group is the bare
  // umbrella label (= general/unspecified) plus its refinement labels.
  const umbrellas = useMemo(() => (stage?.subErrors.filter(s => s.refinements) || []), [stage]);
  const groupOf = (u: SubError) => [u.label, ...(u.refinements || [])];
  const isUmbrellaSelected = (u: SubError) => draft.errorTypes.some(e => groupOf(u).includes(e));

  // Tap the umbrella chip: deselect the whole group if anything's on, else
  // select the bare umbrella label (general, unspecified).
  const toggleUmbrella = (u: SubError) => {
    tap();
    const g = groupOf(u);
    if (draft.errorTypes.some(e => g.includes(e))) {
      update({ errorTypes: draft.errorTypes.filter(e => !g.includes(e)) });
    } else {
      update({ errorTypes: [...draft.errorTypes, u.label] });
      if (draft.errorStep) pushRecent(draft.errorStep, u.label);
    }
  };

  // Pick a specific part. Adding one drops the bare umbrella label so we don't
  // double-count; removing the last specific falls back to the general.
  const refineUmbrella = (u: SubError, part: string) => {
    tap();
    const has = draft.errorTypes.includes(part);
    let next: string[];
    if (has) {
      next = draft.errorTypes.filter(e => e !== part);
      const anySpecificLeft = (u.refinements || []).some(r => next.includes(r));
      if (!anySpecificLeft && !next.includes(u.label)) next.push(u.label);
    } else {
      next = [...draft.errorTypes.filter(e => e !== u.label), part];
      if (draft.errorStep) pushRecent(draft.errorStep, part);
    }
    update({ errorTypes: next });
  };

  const setWhereCaught = (w: string) => {
    tap();
    // Tapping the currently-selected chip deselects it (stays on Section 3).
    if (draft.whereCaught === w) {
      update({ whereCaught: '' });
      return;
    }
    update({ whereCaught: w });
    try { localStorage.setItem(LAST_CAUGHT_KEY, w); } catch { /* noop */ }
    setOpenSection(4);
  };

  const toggleFactor = (f: string) => {
    tap();
    // Picking a real factor clears the "no obvious reason" escape — they
    // can't both be true.
    update({
      factors: draft.factors.includes(f)
        ? draft.factors.filter(x => x !== f)
        : [...draft.factors.filter(x => x !== NO_FACTOR), f],
    });
  };

  // Escape hatch: a factor is required to submit, but sometimes nothing
  // stood out. "No obvious reason" satisfies that and is mutually exclusive
  // with the real factors.
  const toggleNoFactor = () => {
    tap();
    update({
      factors: draft.factors.includes(NO_FACTOR) ? [] : [NO_FACTOR],
    });
  };

  const resetDraft = useCallback(() => {
    setDraft(EMPTY);
    setGate(null); // re-prompt the patient-reached gate for the next incident
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(GATE_KEY);
    } catch { /* noop */ }
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
        // Add the drug name to this pharmacy's autocomplete history so future
        // entries get suggestions in the canonical spelling used here.
        if (draft.drugName.trim()) recordDrugInHistory(draft.drugName.trim());
        if (draft.dispensedDrug.trim()) recordDrugInHistory(draft.dispensedDrug.trim());
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
    const t = setTimeout(() => nav('/app'), 30000);
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
    if (drugRequired && !draft.drugName.trim()) return 'Add the drug name below';
    return editingIncidentId ? 'Save changes' : 'Submit near miss ✓';
  })();
  const canSubmit =
    !!draft.errorStep &&
    draft.errorTypes.length > 0 &&
    !!draft.whereCaught &&
    draft.factors.length > 0 &&
    !anyPhi &&
    // Drug name is required when the chosen error type implies a specific
    // medicine, so reports and pattern matching have something to group on.
    (!drugRequired || !!draft.drugName.trim());

  // ── Success screen ──────────────────────────────────────────
  if (submitted) {
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
        <button onClick={() => nav('/app')}
          className="w-full bg-[#0F6E56] text-white font-bold py-5 rounded-xl hover:bg-[#0B5A46] transition-colors text-base">
          Done
        </button>
        {retracted ? (
          <div className="w-full mt-3 bg-[#F0FAF5] border-2 border-[#C8E6D8] rounded-xl px-4 py-3 text-sm text-[#085041] leading-snug">
            All good — your manager will tidy it up. Nothing else to do.
          </div>
        ) : (
          <>
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

  // ── Patient-reached gate ────────────────────────────────────
  // A near miss is, by definition, caught before the medication reaches
  // the patient. If it reached them, this is a dispensing error and needs
  // a different process (Pharmacy Council notification, CARM via Medsafe,
  // possible HDC if harm). We never silently capture it as a near miss.
  // Skipped when editing an existing incident (already past the gate).
  if (!editingIncidentId && gate === null) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h1 className="text-lg font-bold text-gray-900 mb-1">Logging a dispensing near miss</h1>
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">
            Was it caught <span className="font-semibold">before</span> the medicine was handed to the patient?
          </p>
          <div className="space-y-2">
            <button onClick={() => { tap(); setGate('yes'); }}
              className="w-full py-4 px-4 rounded-xl bg-[#0F6E56] text-white text-base font-semibold hover:bg-[#0B5A46] flex items-center justify-center gap-2">
              <CheckCircle2 size={18} /> Yes — caught in time
            </button>
            <button onClick={() => { tap(); setGate('no'); }}
              className="w-full py-4 px-4 rounded-xl bg-white text-[#791F1F] text-base font-semibold border-2 border-[#C84B4B] hover:bg-[#FCEBEB] flex items-center justify-center gap-2">
              <AlertTriangle size={18} /> No — the patient received it
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-4 leading-snug text-center">
            NearMissPro is for events caught before they reached the patient. Anything that reached the patient is a dispensing error and needs a different process.
          </p>
        </div>
      </div>
    );
  }
  if (!editingIncidentId && gate === 'no') {
    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border-2 border-[#C84B4B] p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={24} className="text-[#C84B4B] flex-shrink-0 mt-0.5" />
            <div>
              <h1 className="text-lg font-bold text-[#791F1F]">This is a dispensing error</h1>
              <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                NearMissPro doesn't capture events that reached the patient. Use your pharmacy's incident process.
              </p>
            </div>
          </div>
          <div className="bg-[#FCEBEB] rounded-xl p-4 text-sm text-[#791F1F] leading-relaxed mb-4">
            <p className="font-semibold mb-2">Speak to the Pharmacist-in-Charge now.</p>
            <p className="text-xs text-gray-700">Depending on what happened, this may also require:</p>
            <ul className="text-xs text-gray-700 mt-1.5 space-y-0.5 list-disc pl-5">
              <li>CARM report (Medsafe)</li>
              <li>Pharmacy Council NZ notification</li>
              <li>Patient disclosure (Code of Health and Disability Services Consumers' Rights)</li>
              <li>HDC notification if harm occurred</li>
              <li>Your indemnity insurer</li>
            </ul>
          </div>
          <button onClick={() => { tap(); setGate(null); }}
            className="w-full py-3 px-4 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200">
            Back — actually it was caught in time
          </button>
        </div>
      </div>
    );
  }

  // ── Derived for sidebar summary ─────────────────────────────
  const hasStage = !!draft.errorStep;
  const hasSub = draft.errorTypes.length > 0;
  // Section 2 only counts as "done" once the required drug name is filled —
  // otherwise the green tick made a half-finished section look complete.
  const section2Done = hasSub && (!drugRequired || !!draft.drugName.trim());
  const hasCaught = !!draft.whereCaught;
  const hasFactor = draft.factors.length > 0;

  const summaryTags: { label: string; color: string }[] = [];
  if (draft.errorStep) summaryTags.push({ label: draft.errorStep, color: 'chip-teal' });
  draft.errorTypes.forEach(e => summaryTags.push({ label: e, color: subColor(e, true) }));
  if (draft.drugName && draft.dispensedDrug) summaryTags.push({ label: `${draft.drugName} ${triggers.interaction ? '+' : '→'} ${draft.dispensedDrug}`, color: 'chip-coral' });
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
          {customLimitMsg && (
            <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              <span className="flex-1">{customLimitMsg}</span>
              <button onClick={() => setCustomLimitMsg('')} className="text-amber-700 opacity-60 hover:opacity-100">×</button>
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
          <SectionHeader num={1} title="Where did this happen?" subtitle="Pick the step where the near miss happened" done={hasStage} open={openSection === 1} onClick={() => toggleSection(1)} />
          {openSection === 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <p className="text-xs text-gray-500">
                Tap the step in dispensing where the near miss happened — just one.
              </p>
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
              {/* Pharmacy-wide custom stages (saved server-side) +
                  Other input. The orphan CustomChip below covers the
                  rare case where the draft holds a value that's since
                  been removed from the pharmacy list. */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {customChips.stage.map(c => (
                  <SharedChip
                    key={c.id}
                    label={c.label}
                    selected={draft.errorStep === c.label}
                    selectedClass="chip-teal"
                    onSelect={() => onStageTap(c.label)}
                    onDelete={() => {
                      if (draft.errorStep === c.label) onStageTap(c.label);
                      removeCustomChip('stage', c.id);
                    }}
                  />
                ))}
                {draft.errorStep
                  && !STAGES.some(s => s.label === draft.errorStep)
                  && !customChips.stage.some(c => c.label === draft.errorStep) && (
                  <CustomChip
                    label={draft.errorStep}
                    onRemove={() => onStageTap(draft.errorStep)}
                  />
                )}
                <OtherChip
                  placeholder="e.g. PSO funding step"
                  check={text => api.checkCustomOption('stage', text)}
                  onAdd={async text => {
                    const ok = await addCustomChip('stage', text);
                    if (ok) onStageTap(text);
                    return ok;
                  }}
                />
              </div>
            </div>
          )}

          {/* ═══ Section 2: What went wrong? ═══ */}
          <SectionHeader num={2} title="What went wrong?" subtitle={hasStage ? 'Pick one or more that apply' : 'Choose a step first'} done={section2Done} open={openSection === 2} onClick={() => { if (hasStage) toggleSection(2); }} />
          {openSection === 2 && hasStage && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3" ref={l2Ref}>
              <p className="text-xs text-gray-500">
                Tap what went wrong — pick more than one if it applies. Chips with a ▸ open up so you can be more specific.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visibleSubs.map(s => {
                  const umbrella = umbrellas.find(u => u.label === s.label);
                  const selected = umbrella ? isUmbrellaSelected(umbrella) : draft.errorTypes.includes(s.label);
                  return (
                    <button
                      key={s.label}
                      onClick={() => (umbrella ? toggleUmbrella(umbrella) : toggleSub(s.label))}
                      className={`chip text-base font-semibold py-3 px-4 ${subColor(s.label, selected)} ${s.recent && !selected ? 'border-[#1D9E75]' : ''}`}
                    >
                      {s.recent && <span className="text-[10px] text-[#1D9E75] mr-1">recent</span>}
                      {s.label}
                      {umbrella && <span className="ml-1 opacity-60">{selected ? '▾' : '▸'}</span>}
                    </button>
                  );
                })}
                {hasHiddenSubs && (
                  <button
                    onClick={() => { tap(); update({ showMoreSub: true }); }}
                    className="chip text-base font-semibold chip-other"
                  >
                    More…
                  </button>
                )}
                {/* Pharmacy-wide custom error types — tap to add/remove
                    from this incident; × to remove from the pharmacy. */}
                {customChips.error_type.map(c => {
                  const selected = draft.errorTypes.includes(c.label);
                  return (
                    <SharedChip
                      key={c.id}
                      label={c.label}
                      selected={selected}
                      selectedClass="chip-green"
                      onSelect={() => toggleSub(c.label)}
                      onDelete={() => {
                        if (selected) update({ errorTypes: draft.errorTypes.filter(x => x !== c.label) });
                        removeCustomChip('error_type', c.id);
                      }}
                    />
                  );
                })}
                {/* Orphan: selected custom value no longer in either list.
                    Refinement labels (e.g. "Wrong frequency") count as known —
                    they live under the "Wrong directions" umbrella and show in
                    the refine row, not as loose custom chips. */}
                {draft.errorTypes
                  .filter(et => !(stage?.subErrors.some(s => s.label === et || s.refinements?.includes(et))) && !customChips.error_type.some(c => c.label === et))
                  .map(et => (
                    <CustomChip
                      key={et}
                      label={et}
                      colour="green"
                      onRemove={() => update({ errorTypes: draft.errorTypes.filter(x => x !== et) })}
                    />
                  ))
                }
                <OtherChip
                  placeholder="e.g. PSO funding error"
                  check={text => api.checkCustomOption('error_type', text)}
                  onAdd={async text => {
                    const ok = await addCustomChip('error_type', text);
                    if (!ok) return false;
                    if (!draft.errorTypes.includes(text)) update({ errorTypes: [...draft.errorTypes, text] });
                    if (draft.errorStep) pushRecent(draft.errorStep, text);
                    return true;
                  }}
                />
              </div>

              {/* Umbrella refine rows — one per selected umbrella chip.
                  Picking a part swaps the general umbrella label for the
                  specific one; leaving it stays general. */}
              {umbrellas.filter(u => isUmbrellaSelected(u)).map(u => (
                <div key={u.label} className="rounded-xl p-3 border-[1.5px] border-gray-200 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    {u.refineTitle || 'Which one?'} <span className="font-normal text-gray-400">(optional)</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(u.refinements || []).map(part => (
                      <button
                        key={part}
                        onClick={() => refineUmbrella(u, part)}
                        className={`chip text-sm font-semibold py-2 px-3 ${subColor(part, draft.errorTypes.includes(part))}`}
                      >
                        {part}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Layer 3 — drug + intended → given fields.
                  Shown whenever a drug is involved (drugRequired) OR a
                  specific trigger field fires. Previously only rendered
                  when a trigger fired, so cases like "Wrong directions"
                  and "Wrong pack size" never asked for the drug, which
                  meant headlines on the report dropped the medicine. */}
              {(drugRequired || triggers.drug || triggers.strength || triggers.quantity || triggers.formulation || triggers.interaction) && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  {highRisk && (
                    <div className="rounded-xl border-2 border-[#C84B4B] bg-[#FCEBEB] p-3">
                      <p className="text-xs font-bold text-[#791F1F] flex items-center gap-1.5">
                        <AlertTriangle size={14} /> High-risk drug — {highRisk.category}
                      </p>
                      <p className="text-[11px] text-[#791F1F] mt-1 leading-snug">{highRisk.guidance}</p>
                    </div>
                  )}
                  {/* Single drug-name field for cases where the error doesn't
                      involve a wrong drug (wrong strength / quantity /
                      formulation of the right drug). The "wrong drug" path
                      below captures both prescribed + dispensed drugs in its
                      own intended→given box so it doesn't need this. */}
                  {!triggers.drug && (
                    <div className="rounded-xl p-3 border-[1.5px] border-blue-200 bg-blue-50">
                      <p className="text-xs font-semibold text-blue-700 mb-2">
                        Drug <span className="text-red-600">*</span>
                      </p>
                      <input
                        type="text"
                        value={draft.drugName}
                        onChange={e => update({ drugName: e.target.value })}
                        list="drug-suggestions"
                        placeholder="e.g. Atorvastatin"
                        className="input-field text-sm py-2 w-full"
                        autoComplete="off"
                      />
                      {phi.drugName.hit && (
                        <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                          <AlertTriangle size={12} /> Looks like patient info — use a drug name only.
                        </p>
                      )}
                      {!phi.drugName.hit && draft.drugName && drugNotRecognised && (
                        <p className="text-[11px] text-gray-500 mt-1.5">
                          Not in the NZ drug list — please double-check spelling so the report can spot patterns.
                        </p>
                      )}
                      {!phi.drugName.hit && draft.drugName && !drugNotRecognised && (
                        <p className="text-[11px] text-[#085041] mt-1.5">
                          ✓ Recognised
                        </p>
                      )}
                    </div>
                  )}
                  {/* Interaction only: the drug being dispensed is captured
                      above; this second field records the OTHER drug it
                      interacts with, so the report names both medicines. */}
                  {triggers.interaction && (
                    <div className="rounded-xl p-3 border-[1.5px] border-blue-200 bg-blue-50">
                      <p className="text-xs font-semibold text-blue-700 mb-2">
                        Interacts with
                      </p>
                      <input
                        type="text"
                        value={draft.dispensedDrug}
                        onChange={e => update({ dispensedDrug: e.target.value })}
                        list="drug-suggestions"
                        placeholder="e.g. Warfarin"
                        className="input-field text-sm py-2 w-full"
                        autoComplete="off"
                      />
                      {phi.dispensedDrug.hit && (
                        <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                          <AlertTriangle size={12} /> Looks like patient info — use a drug name only.
                        </p>
                      )}
                    </div>
                  )}
                  {triggers.drug && (
                    <>
                      <IntendedGiven
                        label="Drug" colour="coral"
                        labelRequired
                        a={draft.drugName} onA={v => update({ drugName: v })}
                        b={draft.dispensedDrug} onB={v => update({ dispensedDrug: v })}
                        aHint="Prescribed (e.g. Losartan)"
                        bHint="Given in error (e.g. Lisinopril)"
                        datalistId="drug-suggestions"
                        aPhi={phi.drugName}
                        bPhi={phi.dispensedDrug}
                      />
                      {!phi.drugName.hit && draft.drugName && drugNotRecognised && (
                        <p className="text-[11px] text-gray-500 -mt-1 ml-1">
                          Prescribed drug not in the NZ list — double-check spelling.
                        </p>
                      )}
                    </>
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
                  <p className="text-[11px] text-gray-400 italic">
                    {triggers.drug || triggers.strength || triggers.quantity || triggers.formulation
                      ? 'Drug name required — it helps the report spot patterns. The "what was meant → what was given" boxes are optional but recommended.'
                      : 'Drug name required — it helps the report group near misses by medicine so patterns show up.'}
                  </p>
                </div>
              )}

              {hotspot && (
                <HotspotPanel
                  drug={hotspot.drug}
                  errorType={hotspot.errorType}
                  count={hotspot.count}
                  days={hotspot.days}
                />
              )}

            </div>
          )}

          <datalist id="drug-suggestions">
            {/* Pharmacy's own drug history first — encourages spelling consistency */}
            {drugSuggestions.map(d => <option key={d} value={d} />)}
          </datalist>

          {/* ═══ Section 3: Where was it caught? ═══ */}
          <SectionHeader num={3} title="Where was it caught?" subtitle={hasStage ? 'Pre-selected based on the step' : ''} done={hasCaught} open={openSection === 3} onClick={() => { if (hasStage) toggleSection(3); }} />
          {openSection === 3 && hasStage && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2" ref={caughtRef}>
              <p className="text-xs text-gray-500">
                We've pre-picked the usual spot for this step — tap a different one if it was caught somewhere else.
              </p>
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
                {/* Pharmacy-wide custom where-caught chips */}
                {customChips.where_caught.map(c => (
                  <SharedChip
                    key={c.id}
                    label={c.label}
                    selected={draft.whereCaught === c.label}
                    selectedClass="chip-blue"
                    onSelect={() => setWhereCaught(c.label)}
                    onDelete={() => {
                      if (draft.whereCaught === c.label) update({ whereCaught: '' });
                      removeCustomChip('where_caught', c.id);
                    }}
                  />
                ))}
                {draft.whereCaught
                  && !WHERE_CAUGHT.includes(draft.whereCaught)
                  && !customChips.where_caught.some(c => c.label === draft.whereCaught) && (
                  <CustomChip
                    label={draft.whereCaught}
                    colour="blue"
                    onRemove={() => update({ whereCaught: '' })}
                  />
                )}
                <OtherChip
                  placeholder="e.g. By a customer at handout"
                  check={text => api.checkCustomOption('where_caught', text)}
                  onAdd={async text => {
                    const ok = await addCustomChip('where_caught', text);
                    if (ok) setWhereCaught(text);
                    return ok;
                  }}
                />
              </div>
            </div>
          )}

          {/* ═══ Section 4: What was happening at the time? ═══ */}
          <SectionHeader num={4} title="What was happening at the time?" subtitle="Any factors that may have contributed" done={hasFactor} open={openSection === 4} onClick={() => { if (hasCaught) toggleSection(4); }} />
          {openSection === 4 && hasCaught && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3" ref={factorsRef}>
              <p className="text-xs text-gray-500">
                Tap anything that may have played a part. If nothing stood out, tap "No obvious reason" below. Then submit.
              </p>
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
                {/* Pharmacy-wide custom factors */}
                {customChips.factor.map(c => {
                  const selected = draft.factors.includes(c.label);
                  return (
                    <SharedChip
                      key={c.id}
                      label={c.label}
                      selected={selected}
                      selectedClass="chip-amber"
                      onSelect={() => toggleFactor(c.label)}
                      onDelete={() => {
                        if (selected) update({ factors: draft.factors.filter(x => x !== c.label) });
                        removeCustomChip('factor', c.id);
                      }}
                    />
                  );
                })}
                {/* Orphan: selected custom factor no longer in either list */}
                {draft.factors.filter(f => !FACTORS.includes(f) && !customChips.factor.some(c => c.label === f)).map(f => (
                  <CustomChip
                    key={f}
                    label={f}
                    colour="amber"
                    onRemove={() => update({ factors: draft.factors.filter(x => x !== f) })}
                  />
                ))}
                <OtherChip
                  placeholder="e.g. Power outage"
                  check={text => api.checkCustomOption('factor', text)}
                  onAdd={async text => {
                    const ok = await addCustomChip('factor', text);
                    if (!ok) return false;
                    if (!draft.factors.includes(text)) update({ factors: [...draft.factors, text] });
                    return true;
                  }}
                />
              </div>

              {/* Escape hatch — a factor is required to submit, so this lets
                  someone proceed honestly when nothing stood out. Always
                  visible (not hidden behind "More factors…"). */}
              <div className="pt-1 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Nothing stood out?</p>
                <button
                  onClick={toggleNoFactor}
                  className={`chip text-base font-semibold py-3 px-4 ${draft.factors.includes(NO_FACTOR) ? 'chip-amber' : 'chip-off'}`}
                >
                  No obvious reason
                </button>
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
                // "What went wrong" isn't complete until the required drug is
                // named — same rule as the section-2 tick, so nothing greens early.
                { met: section2Done, label: 'What went wrong' },
                ...(drugRequired ? [{ met: !!draft.drugName.trim(), label: 'Drug name' }] : []),
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

// Render a user-typed custom value as a chip with an X to remove it.
// Confirms before deleting because the user invested typing effort
// (built-in chips don't need this — they can be re-tapped to re-add).
function CustomChip({ label, onRemove, colour = 'green' }: { label: string; onRemove: () => void; colour?: 'green' | 'amber' | 'blue' }) {
  const styles = {
    green: 'bg-emerald-50 border-emerald-400 text-emerald-900',
    amber: 'bg-amber-50 border-amber-400 text-amber-900',
    blue:  'bg-blue-50 border-blue-400 text-blue-900',
  }[colour];
  return (
    <span className={`chip text-base font-semibold py-3 px-4 border-dashed ${styles} inline-flex items-center gap-2`}>
      <span className="text-[10px] font-bold uppercase opacity-70">custom</span>
      <span>{label}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          tap();
          if (window.confirm(`Remove "${label}"?`)) onRemove();
        }}
        className="text-current opacity-60 hover:opacity-100 ml-1 -mr-1 leading-none"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </span>
  );
}

// Pharmacy-wide custom chip — looks like a built-in chip but with a
// dashed border (so it's visually distinct as "we added this") and a
// small × at the right edge for pharmacy-wide removal. Tap the chip
// body to select/deselect for this incident.
function SharedChip({ label, selected, selectedClass, onSelect, onDelete }: {
  label: string;
  selected: boolean;
  selectedClass: string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`chip text-base font-semibold py-3 px-4 border-dashed ${selected ? selectedClass : 'chip-off'} inline-flex items-center gap-2`}
    >
      <span>{label}</span>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          tap();
          if (window.confirm(`Remove "${label}" from the pharmacy's chips? Other staff won't see it any more.`)) onDelete();
        }}
        className="opacity-50 hover:opacity-100 -mr-1 leading-none px-1 cursor-pointer"
        aria-label={`Remove ${label}`}
      >
        ×
      </span>
    </button>
  );
}

// "+ Other" chip with an inline text input. Lets staff add a custom
// value when none of the built-in chips fit. Whatever they type is
// added to the same string array as the chip selections, so every
// downstream system (pattern matching, summarizeIncident, report,
// audit log) treats the custom text identically to a built-in chip.
// Capped at 80 chars to keep entries snappy enough to render in a
// chip row.
function OtherChip({ onAdd, placeholder, max = 80, check }: { onAdd: (text: string) => void | boolean | Promise<void | boolean>; placeholder: string; max?: number; check?: (text: string) => Promise<{ ok: boolean; reason?: string }> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  // When the text looks like scribble, the first Add click sets this
  // to a short reason; the button becomes "Save anyway" and a warning
  // shows under the input. Editing the text clears it so the check
  // re-runs on the next click.
  const [override, setOverride] = useState<string | null>(null);
  // Patient-info block. Unlike `override`, this can't be saved-anyway — a
  // chip is shared with the whole team, so it must never carry patient info.
  const [phiWarn, setPhiWarn] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // If onAdd returns false (e.g. cap hit, server rejected) keep the
  // input open so the user's typed text isn't lost.
  const submit = async () => {
    const t = text.trim();
    if (!t || saving) return;

    // Hard block on high-confidence patient identifiers (NHI number, DOB,
    // phone / long digit run). These are never a real category, so we don't
    // save them or send them to the AI check. The "name" heuristic (two
    // capitalised words) is skipped here — legit labels like "Special
    // Authority" would trip it.
    const idKinds = detectPHI(t).kinds.filter(k => k !== 'name');
    if (idKinds.length > 0) { setPhiWarn(phiHint(idKinds)); return; }

    setSaving(true);
    try {
      // Two-layer scribble check. Skipped entirely after the user
      // confirms with a second click ("Save anyway").
      if (override === null) {
        // 1. Fast local heuristics — catches obvious junk for free.
        const local = looksLikeGibberish(t);
        if (!local.ok) {
          setOverride(local.reason || 'looks unusual');
          return;
        }
        // 2. AI backstop for borderline cases that pass heuristics
        //    but aren't real words (e.g. "asopas", "qweop").
        //    Fail-open: any network/API error lets the save proceed.
        if (check) {
          try {
            const ai = await check(t);
            if (!ai.ok) {
              setOverride(ai.reason || "doesn't look like a real category");
              return;
            }
          } catch { /* fail-open */ }
        }
      }

      const result = await onAdd(t);
      if (result === false) return;
      setText('');
      setOverride(null);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (v: string) => {
    setText(v.slice(0, max));
    if (override !== null) setOverride(null);
    if (phiWarn !== null) setPhiWarn(null);
  };

  if (!open) {
    return (
      <button
        onClick={() => { tap(); setOpen(true); }}
        className="chip text-base font-semibold chip-other"
      >
        + Other…
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1 w-full sm:w-auto">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') { setText(''); setOverride(null); setPhiWarn(null); setOpen(false); } }}
          placeholder={placeholder}
          maxLength={max}
          disabled={saving}
          className="input-field text-sm py-2 px-3 flex-1 min-w-[180px]"
        />
        <button
          onClick={submit}
          disabled={!text.trim() || saving}
          className={`text-white text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-50 ${override ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#0F6E56] hover:bg-[#0B5A46]'}`}
        >
          {saving ? 'Saving…' : (override ? 'Save anyway' : 'Add')}
        </button>
        <button
          onClick={() => { setText(''); setOverride(null); setPhiWarn(null); setOpen(false); }}
          disabled={saving}
          className="text-sm text-gray-500 px-2 py-2"
        >
          Cancel
        </button>
      </div>
      {phiWarn && (
        <p className="text-xs text-red-600 px-1 flex items-start gap-1">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{phiWarn} A saved chip is shared with the whole team, so it can't include patient details.</span>
        </p>
      )}
      {override && !phiWarn && (
        <p className="text-xs text-amber-700 px-1 flex items-start gap-1">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>"{text.trim()}" {override}. Edit it, or tap "Save anyway" to keep it.</span>
        </p>
      )}
    </div>
  );
}

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
  labelRequired?: boolean;
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
      <p className={`text-xs font-semibold ${c.title} mb-2`}>
        {props.label}
        {props.labelRequired && <span className="text-red-600"> *</span>}
        {' — intended → given'}
      </p>
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

// ── Hotspot panel — shared intervention log per (drug, error_type) ──
// Shown on the Record form when the drug+error pair has 2+ priors.
// Staff see what's already been tried and can add a new intervention.
// Saves to pattern_interventions independently of the incident submit,
// so an intervention is captured even if the incident isn't submitted.
function HotspotPanel({ drug, errorType, count, days }: {
  drug: string; errorType: string; count: number; days: number;
}) {
  interface Intervention { id: string; note: string; created_at: string; }
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.listInterventions(drug, errorType)
      .then(r => { if (!cancelled) setInterventions(r.interventions); })
      .catch(() => { /* ignore; empty list is fine */ });
    return () => { cancelled = true; };
  }, [drug, errorType]);

  const add = async () => {
    const text = note.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const saved = await api.addIntervention(drug, errorType, text);
      setInterventions(prev => [...prev, { id: saved.id, note: saved.note, created_at: saved.created_at }]);
      setNote('');
    } catch { /* silent — user can retry */ }
    finally { setBusy(false); }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });

  return (
    <div className="bg-[#FAEEDA] border border-[#BA7517] rounded-xl px-3 py-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="text-[#BA7517] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[#633806] leading-snug">
          <span className="font-semibold">Repeat pattern —</span> {drug} with "{errorType}" has come up{' '}
          <span className="font-semibold">{count} times</span> in the last {days} days.
          {count >= 3 && (
            <> <span className="font-semibold">Worth telling the pharmacist-in-charge now</span> so they can change something before it happens again.</>
          )}
        </p>
      </div>

      {interventions.length > 0 && (
        <div className="pl-6 text-xs text-[#633806]">
          <p className="font-semibold mb-1">Actions tried so far:</p>
          <ul className="space-y-0.5">
            {interventions.map(iv => (
              <li key={iv.id} className="leading-snug">
                • <span className="text-[#633806]/70">{fmt(iv.created_at)} —</span> {iv.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pl-6">
        <p className="text-[11px] text-[#633806]/90 mb-1 font-medium">
          What did you do this time? <span className="text-[#633806]/50 font-normal">(optional — helps the team)</span>
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder="e.g. Added yellow sticker to shelf"
            maxLength={500}
            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-[#BA7517]/40 bg-white focus:outline-none focus:ring-2 focus:ring-[#BA7517]"
          />
          <button
            onClick={add}
            disabled={!note.trim() || busy}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#BA7517] text-white hover:bg-[#9A6113] disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
