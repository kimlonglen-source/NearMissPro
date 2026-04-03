import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { CheckCircle2, AlertTriangle, ArrowLeftRight, Flag, Loader2 } from 'lucide-react';

interface Opt { id: string; label: string; group_name: string; category: string; }

const DRUG_SUGGESTIONS = ['Metformin', 'Warfarin', 'Amoxicillin', 'Flucloxacillin'];
const SWAP_CHIPS = ['Wrong drug', 'Wrong dose', 'Wrong formulation'];
const TIME_OPTIONS = ['Morning 8\u201312pm', 'Lunch 12\u20132pm', 'Afternoon 2\u20136pm', 'Evening 6pm+'];

function chipColor(label: string, selected: boolean): string {
  if (!selected) return 'chip-off';
  if (label === 'Wrong drug') return 'chip-coral';
  if (label === 'Wrong dose') return 'chip-amber';
  if (label === 'Wrong formulation') return 'chip-purple';
  return 'chip-green';
}

export function RecordPage() {
  const nav = useNavigate();
  const [options, setOptions] = useState<Record<string, Record<string, Opt[]>>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Section 1 — What went wrong
  const [selectedErrors, setSelectedErrors] = useState<string[]>([]);
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [showOther, setShowOther] = useState<Record<string, boolean>>({});
  const [drugName, setDrugName] = useState('');
  const [dispensedDrug, setDispensedDrug] = useState('');
  const [prescribedStrength, setPrescribedStrength] = useState('');
  const [dispensedStrength, setDispensedStrength] = useState('');
  const [correctFormulation, setCorrectFormulation] = useState('');
  const [dispensedFormulation, setDispensedFormulation] = useState('');

  // Section 2 — Where caught
  const [whereCaught, setWhereCaught] = useState('');
  const [otherCaught, setOtherCaught] = useState('');
  const [showOtherCaught, setShowOtherCaught] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState('');

  // Section 3 — Factors
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
  const [factorOtherTexts, setFactorOtherTexts] = useState<Record<string, string>>({});
  const [showFactorOther, setShowFactorOther] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');

  // Confirmation
  const [submitted, setSubmitted] = useState(false);
  const [incidentId, setIncidentId] = useState('');
  const [submittedAt, setSubmittedAt] = useState('');
  const [autoResetTimer, setAutoResetTimer] = useState(30);
  const [editTimer, setEditTimer] = useState(900);
  const [flagSent, setFlagSent] = useState(false);

  useEffect(() => {
    api.getOptions().then(d => setOptions(d)).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!submitted) return;
    const interval = setInterval(() => {
      setAutoResetTimer(prev => { if (prev <= 1) { resetForm(); return 30; } return prev - 1; });
      setEditTimer(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted]);

  const hasSwap = (label: string) => selectedErrors.includes(label);
  const hasAnySwap = SWAP_CHIPS.some(c => hasSwap(c));

  // ── Validation ──
  const hasErrorType = selectedErrors.length > 0;
  const hasDrugDetails = (() => {
    if (!hasErrorType) return false;
    if (hasSwap('Wrong drug') && (!drugName.trim() || !dispensedDrug.trim())) return false;
    if (hasSwap('Wrong dose') && (!prescribedStrength.trim() || !dispensedStrength.trim())) return false;
    if (hasSwap('Wrong formulation') && (!correctFormulation.trim() || !dispensedFormulation.trim())) return false;
    return true;
  })();
  const hasWhereCaught = !!whereCaught || (showOtherCaught && !!otherCaught.trim());
  const hasFactor = selectedFactors.length > 0;
  const canSubmit = hasErrorType && hasDrugDetails && hasWhereCaught && hasFactor;

  const stillNeeded: string[] = [];
  if (!hasErrorType) stillNeeded.push('error type');
  if (hasErrorType && !hasDrugDetails) stillNeeded.push('drug details');
  if (!hasWhereCaught) stillNeeded.push('where caught');
  if (!hasFactor) stillNeeded.push('a factor');

  const toggleError = (label: string) => setSelectedErrors(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  const toggleFactor = (label: string) => setSelectedFactors(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);

  const resetForm = useCallback(() => {
    setSelectedErrors([]); setOtherTexts({}); setShowOther({});
    setDrugName(''); setDispensedDrug(''); setPrescribedStrength('');
    setDispensedStrength(''); setCorrectFormulation(''); setDispensedFormulation('');
    setWhereCaught(''); setOtherCaught(''); setShowOtherCaught(false);
    setTimeOfDay(''); setSelectedFactors([]);
    setFactorOtherTexts({}); setShowFactorOther({}); setNotes('');
    setSubmitted(false); setIncidentId(''); setAutoResetTimer(30); setEditTimer(900);
    setFlagSent(false); setError('');
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true); setError('');
    try {
      const otherEntries: { category: string; text: string }[] = [];
      for (const [group, text] of Object.entries(otherTexts)) {
        if (text.trim()) otherEntries.push({ category: `error_type:${group}`, text: text.trim() });
      }
      if (showOtherCaught && otherCaught.trim()) otherEntries.push({ category: 'where_caught', text: otherCaught.trim() });
      for (const [group, text] of Object.entries(factorOtherTexts)) {
        if (text.trim()) otherEntries.push({ category: `factor:${group}`, text: text.trim() });
      }

      const incident = await api.createIncident({
        errorTypes: selectedErrors,
        drugName: drugName || undefined,
        dispensedDrug: hasSwap('Wrong drug') ? dispensedDrug : undefined,
        prescribedStrength: hasSwap('Wrong dose') ? prescribedStrength : undefined,
        dispensedStrength: hasSwap('Wrong dose') ? dispensedStrength : undefined,
        correctFormulation: hasSwap('Wrong formulation') ? correctFormulation : undefined,
        dispensedFormulation: hasSwap('Wrong formulation') ? dispensedFormulation : undefined,
        whereCaught: whereCaught || (showOtherCaught ? otherCaught : undefined),
        timeOfDay: timeOfDay || undefined,
        factors: selectedFactors,
        otherEntries,
        notes: notes || undefined,
      });

      setIncidentId(incident.id as string);
      setSubmittedAt(new Date().toLocaleString('en-NZ', { hour: '2-digit', minute: '2-digit', weekday: 'long', day: 'numeric', month: 'short' }));
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally { setSubmitting(false); }
  };

  const handleFlag = async () => {
    if (!incidentId || flagSent) return;
    try { await api.flagIncident(incidentId); setFlagSent(true); } catch { /* ignore */ }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-[#0F6E56]" size={32} /></div>;

  // ── Confirmation screen ──
  if (submitted) {
    const editPct = (editTimer / 900) * 100;
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-[#E1F5EE] flex items-center justify-center mb-4">
          <CheckCircle2 size={40} className="text-[#0F6E56]" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Report submitted</h2>
        <p className="text-sm text-gray-500 mb-1">Logged at {submittedAt}</p>
        <p className="text-sm text-gray-500 mb-6">Thank you — your report helps keep patients safe.</p>
        <div className="w-full max-w-xs mb-4">
          <div className="text-xs text-gray-400 mb-1">Edit window: {Math.floor(editTimer / 60)}:{String(editTimer % 60).padStart(2, '0')}</div>
          <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-[#0F6E56] h-2 rounded-full transition-all" style={{ width: `${editPct}%` }} /></div>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          {editTimer > 0 && <button onClick={() => { setSubmitted(false); setAutoResetTimer(999); }} className="btn-outline text-sm">Edit this report</button>}
          <button onClick={handleFlag} disabled={flagSent} className={`btn text-sm ${flagSent ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100'}`}>
            <Flag size={14} /> {flagSent ? 'Flagged' : 'Flag for manager'}
          </button>
          <button onClick={resetForm} className="btn-teal text-sm">Done</button>
        </div>
        <p className="text-xs text-gray-300 mt-6">Auto-reset in {autoResetTimer}s</p>
      </div>
    );
  }

  // ── Form ──
  const errorOpts = options.error_type || {};
  const caughtOpts = (options.where_caught || {}).default || [];
  const factorOpts = options.factor || {};

  // Build summary tags
  const tags: { label: string; color: string }[] = [];
  selectedErrors.forEach(e => {
    tags.push({ label: e, color: e === 'Wrong drug' ? 'chip-coral' : e === 'Wrong dose' ? 'chip-amber' : e === 'Wrong formulation' ? 'chip-purple' : 'chip-green' });
  });
  if (hasSwap('Wrong drug') && drugName && dispensedDrug) tags.push({ label: `${drugName} \u2192 ${dispensedDrug}`, color: 'chip-coral' });
  if (hasSwap('Wrong dose') && prescribedStrength && dispensedStrength) tags.push({ label: `${prescribedStrength} \u2192 ${dispensedStrength}`, color: 'chip-amber' });
  if (hasSwap('Wrong formulation') && correctFormulation && dispensedFormulation) tags.push({ label: `${correctFormulation} \u2192 ${dispensedFormulation}`, color: 'chip-purple' });
  if (whereCaught) tags.push({ label: whereCaught, color: 'chip-blue' });
  if (timeOfDay) tags.push({ label: timeOfDay, color: 'chip-blue' });
  selectedFactors.forEach(f => tags.push({ label: f, color: 'chip-amber' }));

  const SectionDivider = ({ text }: { text: string }) => (
    <div className="flex items-center gap-3 mt-5 mb-2">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{text}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );

  const SwapBox = ({ borderColor, bgColor, textColor, title, leftLabel, rightLabel, leftVal, rightVal, onLeft, onRight, suggestions }: {
    borderColor: string; bgColor: string; textColor: string; title: string;
    leftLabel: string; rightLabel: string; leftVal: string; rightVal: string;
    onLeft: (v: string) => void; onRight: (v: string) => void; suggestions?: boolean;
  }) => (
    <div className="rounded-xl p-4 border-[1.5px] mt-3" style={{ borderColor, background: bgColor }}>
      <p className="text-sm font-semibold mb-3" style={{ color: textColor }}>{title}</p>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">{leftLabel}</label>
          <input type="text" value={leftVal} onChange={e => onLeft(e.target.value)} className="input-field text-sm"
            placeholder={leftLabel} list={suggestions ? 'drug-suggestions' : undefined} />
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-4" style={{ border: `2px solid ${borderColor}` }}>
          <ArrowLeftRight size={14} style={{ color: borderColor }} />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">{rightLabel}</label>
          <input type="text" value={rightVal} onChange={e => onRight(e.target.value)} className="input-field text-sm"
            placeholder={rightLabel} list={suggestions ? 'drug-suggestions' : undefined} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-32 lg:pb-6">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* ── LEFT: Form ── */}
        <div className="flex-1 min-w-0 space-y-6">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}

          {/* ═══ Section 1: What went wrong ═══ */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-0.5">What went wrong?</h2>
            <p className="text-xs text-gray-400 mb-3">Select all that apply</p>

            {Object.entries(errorOpts).map(([group, opts]) => (
              <div key={group}>
                <SectionDivider text={group} />
                <div className="flex flex-wrap gap-1.5">
                  {opts.map(opt => (
                    <button key={opt.id} onClick={() => toggleError(opt.label)}
                      className={`chip text-sm ${chipColor(opt.label, selectedErrors.includes(opt.label))}`}
                      aria-pressed={selectedErrors.includes(opt.label)}>
                      {opt.label}
                    </button>
                  ))}
                  <button onClick={() => setShowOther(p => ({ ...p, [group]: !p[group] }))}
                    className={`chip text-sm ${showOther[group] ? 'chip-green' : 'chip-other'}`}>
                    + Other
                  </button>
                </div>
                {showOther[group] && (
                  <input type="text" maxLength={120} value={otherTexts[group] || ''} autoFocus
                    onChange={e => setOtherTexts(p => ({ ...p, [group]: e.target.value }))}
                    className="input-field text-sm mt-2" placeholder="Describe \u2014 do not enter patient names or identifiers" />
                )}
              </div>
            ))}

            {/* Swap boxes */}
            {hasSwap('Wrong drug') && (
              <SwapBox borderColor="#D85A30" bgColor="#FFF5F0" textColor="#712B13"
                title="Which drug was dispensed instead?"
                leftLabel="Prescribed" rightLabel="Dispensed in error"
                leftVal={drugName} rightVal={dispensedDrug}
                onLeft={setDrugName} onRight={setDispensedDrug} suggestions />
            )}
            {hasSwap('Wrong dose') && (
              <SwapBox borderColor="#BA7517" bgColor="#FFFBF0" textColor="#633806"
                title="Which strength was dispensed instead?"
                leftLabel="Prescribed strength" rightLabel="Dispensed in error"
                leftVal={prescribedStrength} rightVal={dispensedStrength}
                onLeft={setPrescribedStrength} onRight={setDispensedStrength} />
            )}
            {hasSwap('Wrong formulation') && (
              <SwapBox borderColor="#7F77DD" bgColor="#F5F3FF" textColor="#3C3489"
                title="Which formulation was dispensed instead?"
                leftLabel="Correct formulation" rightLabel="Dispensed in error"
                leftVal={correctFormulation} rightVal={dispensedFormulation}
                onLeft={setCorrectFormulation} onRight={setDispensedFormulation} />
            )}
            {!hasAnySwap && hasErrorType && (
              <div className="rounded-xl p-4 border-[1.5px] border-[#1D9E75] mt-3" style={{ background: '#F0FAF5' }}>
                <label className="text-sm font-semibold text-[#085041] mb-2 block">Drug involved</label>
                <input type="text" value={drugName} onChange={e => setDrugName(e.target.value)} className="input-field text-sm"
                  placeholder="Drug name (optional)" list="drug-suggestions" />
              </div>
            )}
            <datalist id="drug-suggestions">{DRUG_SUGGESTIONS.map(d => <option key={d} value={d} />)}</datalist>
          </div>

          {/* ═══ Section 2: Where caught ═══ */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-0.5">Where was it caught?</h2>
            <p className="text-xs text-gray-400 mb-3">Select one</p>
            <div className="flex flex-wrap gap-1.5">
              {caughtOpts.map((opt: Opt) => (
                <button key={opt.id} onClick={() => { setWhereCaught(opt.label); setShowOtherCaught(false); setOtherCaught(''); }}
                  className={`chip text-sm ${whereCaught === opt.label ? 'chip-blue' : 'chip-off'}`}>{opt.label}</button>
              ))}
              <button onClick={() => { setShowOtherCaught(!showOtherCaught); setWhereCaught(''); }}
                className={`chip text-sm ${showOtherCaught ? 'chip-blue' : 'chip-other'}`}>+ Other</button>
            </div>
            {showOtherCaught && (
              <input type="text" maxLength={120} value={otherCaught} onChange={e => setOtherCaught(e.target.value)} autoFocus
                className="input-field text-sm mt-2" placeholder="Describe \u2014 do not enter patient names or identifiers" />
            )}

            <SectionDivider text="Time of day" />
            <div className="flex flex-wrap gap-1.5">
              {TIME_OPTIONS.map(t => (
                <button key={t} onClick={() => setTimeOfDay(prev => prev === t ? '' : t)}
                  className={`chip text-sm ${timeOfDay === t ? 'chip-blue' : 'chip-off'}`}>{t}</button>
              ))}
            </div>
          </div>

          {/* ═══ Section 3: Contributing factors ═══ */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-0.5">What contributed to it?</h2>
            <p className="text-xs text-gray-400 mb-3">Select all that apply</p>

            {Object.entries(factorOpts).map(([group, opts]) => (
              <div key={group}>
                <SectionDivider text={group} />
                <div className="flex flex-wrap gap-1.5">
                  {opts.map((opt: Opt) => (
                    <button key={opt.id} onClick={() => toggleFactor(opt.label)}
                      className={`chip text-sm ${selectedFactors.includes(opt.label) ? 'chip-amber' : 'chip-off'}`}>{opt.label}</button>
                  ))}
                  <button onClick={() => setShowFactorOther(p => ({ ...p, [group]: !p[group] }))}
                    className={`chip text-sm ${showFactorOther[group] ? 'chip-amber' : 'chip-other'}`}>+ Other</button>
                </div>
                {showFactorOther[group] && (
                  <input type="text" maxLength={120} value={factorOtherTexts[group] || ''} autoFocus
                    onChange={e => setFactorOtherTexts(p => ({ ...p, [group]: e.target.value }))}
                    className="input-field text-sm mt-2" placeholder="Describe \u2014 do not enter patient names or identifiers" />
                )}
              </div>
            ))}

            <div className="mt-4">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input-field text-sm resize-none"
                placeholder="Any extra context for the manager \u2014 do not enter patient names or identifiers" />
            </div>
          </div>

          {/* Mobile submit */}
          <div className="lg:hidden">
            <p className="text-[11px] text-gray-400 text-center mb-2">Your report is anonymous \u2014 your manager sees what happened, not who submitted it.</p>
            <button onClick={handleSubmit} disabled={!canSubmit || submitting}
              className={`w-full py-4 rounded-xl font-semibold text-sm transition-colors ${canSubmit ? 'bg-[#0F6E56] text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              {submitting ? 'Submitting...' : canSubmit ? 'Submit report' : `Still needed: ${stillNeeded.join(', ')}`}
            </button>
          </div>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-16 space-y-3">
            {/* Live summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Live summary</h3>
              {tags.length === 0 ? (
                <p className="text-sm text-gray-300 italic">Select an error type to begin.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {tags.map((t, i) => <span key={i} className={`inline-block text-[11px] py-0.5 px-2 rounded-full font-medium border ${t.color}`}>{t.label}</span>)}
                </div>
              )}
            </div>

            {/* Requirements */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Requirements</h3>
              {[
                { met: hasErrorType, label: 'Error type selected' },
                { met: hasDrugDetails, label: hasSwap('Wrong drug') ? 'Both drug names entered' : hasSwap('Wrong formulation') ? 'Formulation details entered' : hasSwap('Wrong dose') ? 'Both strengths entered' : 'Drug details' },
                { met: hasWhereCaught, label: 'Where caught selected' },
                { met: hasFactor, label: 'Contributing factor selected' },
              ].map(({ met, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${met ? 'bg-[#1D9E75]' : 'bg-gray-200'}`}>
                    {met && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className={`text-xs ${met ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{label}</span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-gray-400 text-center leading-tight">Your report is anonymous \u2014 your manager sees what happened, not who submitted it.</p>

            <button onClick={handleSubmit} disabled={!canSubmit || submitting}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${canSubmit ? 'bg-[#0F6E56] text-white hover:bg-[#0B5A46]' : 'bg-[#CCCCCC] text-gray-500 cursor-not-allowed'}`}>
              {submitting ? 'Submitting...' : canSubmit ? 'Submit report' : `Still needed: ${stillNeeded.join(', ')}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
