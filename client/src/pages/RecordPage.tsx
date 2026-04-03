import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { CheckCircle2, AlertTriangle, ArrowLeftRight, Flag, Loader2, X } from 'lucide-react';

interface Opt { id: string; label: string; group_name: string; category: string; }

const DRUG_SUGGESTIONS = ['Metformin', 'Warfarin', 'Amoxicillin', 'Flucloxacillin'];
const SWAP_CHIPS = ['Wrong drug', 'Wrong dose', 'Wrong formulation'];

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Morning 8\u201312pm';
  if (h < 14) return 'Lunch 12\u20132pm';
  if (h < 18) return 'Afternoon 2\u20136pm';
  return 'Evening 6pm+';
}

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

  // Section 1
  const [selectedErrors, setSelectedErrors] = useState<string[]>([]);
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [showOther, setShowOther] = useState<Record<string, boolean>>({});
  // Swap data
  const [drugName, setDrugName] = useState('');
  const [dispensedDrug, setDispensedDrug] = useState('');
  const [prescribedStrength, setPrescribedStrength] = useState('');
  const [dispensedStrength, setDispensedStrength] = useState('');
  const [correctFormulation, setCorrectFormulation] = useState('');
  const [dispensedFormulation, setDispensedFormulation] = useState('');

  // Section 2
  const [whereCaught, setWhereCaught] = useState('');
  const [otherCaught, setOtherCaught] = useState('');
  const [showOtherCaught, setShowOtherCaught] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState(getTimeOfDay());

  // Section 3
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
  const [factorOtherTexts, setFactorOtherTexts] = useState<Record<string, string>>({});
  const [showFactorOther, setShowFactorOther] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');

  // Confirmation state
  const [submitted, setSubmitted] = useState(false);
  const [incidentId, setIncidentId] = useState('');
  const [submittedAt, setSubmittedAt] = useState('');
  const [autoResetTimer, setAutoResetTimer] = useState(30);
  const [editTimer, setEditTimer] = useState(900); // 15 min in seconds
  const [flagSent, setFlagSent] = useState(false);

  useEffect(() => {
    api.getOptions().then(d => setOptions(d)).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Auto-reset countdown
  useEffect(() => {
    if (!submitted) return;
    const interval = setInterval(() => {
      setAutoResetTimer(prev => {
        if (prev <= 1) { resetForm(); return 30; }
        return prev - 1;
      });
      setEditTimer(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted]);

  const hasSwap = (label: string) => selectedErrors.includes(label);
  const hasAnySwap = SWAP_CHIPS.some(c => hasSwap(c));

  // Validation
  const hasErrorType = selectedErrors.length > 0;
  const hasDrugDetails = (() => {
    if (hasSwap('Wrong drug') && (!drugName.trim() || !dispensedDrug.trim())) return false;
    if (hasSwap('Wrong dose') && (!prescribedStrength.trim() || !dispensedStrength.trim())) return false;
    if (hasSwap('Wrong formulation') && (!correctFormulation.trim() || !dispensedFormulation.trim())) return false;
    if (!hasAnySwap && hasErrorType) return true; // green box drug name optional when no swap
    if (hasAnySwap) return true;
    return true;
  })();
  const hasWhereCaught = !!whereCaught || (showOtherCaught && !!otherCaught.trim());
  const hasFactor = selectedFactors.length > 0;
  const canSubmit = hasErrorType && hasDrugDetails && hasWhereCaught && hasFactor;

  const stillNeeded: string[] = [];
  if (!hasErrorType) stillNeeded.push('error type');
  if (!hasDrugDetails) stillNeeded.push('drug details');
  if (!hasWhereCaught) stillNeeded.push('where caught');
  if (!hasFactor) stillNeeded.push('a factor');

  const toggleError = (label: string) => {
    setSelectedErrors(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  };

  const toggleFactor = (label: string) => {
    setSelectedFactors(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  };

  const resetForm = useCallback(() => {
    setSelectedErrors([]); setOtherTexts({}); setShowOther({});
    setDrugName(''); setDispensedDrug(''); setPrescribedStrength('');
    setDispensedStrength(''); setCorrectFormulation(''); setDispensedFormulation('');
    setWhereCaught(''); setOtherCaught(''); setShowOtherCaught(false);
    setTimeOfDay(getTimeOfDay()); setSelectedFactors([]);
    setFactorOtherTexts({}); setShowFactorOther({}); setNotes('');
    setSubmitted(false); setIncidentId(''); setAutoResetTimer(30); setEditTimer(900);
    setFlagSent(false); setError('');
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true); setError('');
    try {
      // Collect other entries
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
        timeOfDay,
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
    try {
      await api.flagIncident(incidentId);
      setFlagSent(true);
    } catch { /* ignore */ }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-[#0F6E56]" size={32} /></div>;

  // ── Confirmation screen ──
  if (submitted) {
    const editPercent = (editTimer / 900) * 100;
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-[#E1F5EE] flex items-center justify-center mb-4">
          <CheckCircle2 size={40} className="text-[#0F6E56]" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Report submitted</h2>
        <p className="text-sm text-gray-500 mb-1">Logged at {submittedAt}</p>
        <p className="text-sm text-gray-500 mb-6">Thank you — your report helps keep patients safe.</p>

        {/* Edit window bar */}
        <div className="w-full max-w-xs mb-4">
          <div className="text-xs text-gray-400 mb-1">Edit window: {Math.floor(editTimer / 60)}:{String(editTimer % 60).padStart(2, '0')}</div>
          <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-[#0F6E56] h-2 rounded-full transition-all" style={{ width: `${editPercent}%` }} /></div>
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          {editTimer > 0 && (
            <button onClick={() => { setSubmitted(false); setAutoResetTimer(999); }} className="btn-outline text-sm">Edit this report</button>
          )}
          <button onClick={handleFlag} disabled={flagSent} className={`btn text-sm ${flagSent ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100'}`}>
            <Flag size={14} /> {flagSent ? 'Flagged for manager' : 'Flag for manager'}
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

  const SectionLabel = ({ text }: { text: string }) => (
    <div className="flex items-center gap-3 mb-3 mt-6 first:mt-0">
      <span className="text-[13px] font-semibold text-[#1A1A1A] uppercase tracking-wide whitespace-nowrap">{text}</span>
      <div className="flex-1 border-t border-gray-200" style={{ borderWidth: '0.5px' }} />
    </div>
  );

  // ── Build live summary tags ──
  const summaryTags: { label: string; color: string }[] = [];
  selectedErrors.forEach(e => {
    const c = e === 'Wrong drug' ? 'chip-coral' : e === 'Wrong dose' ? 'chip-amber' : e === 'Wrong formulation' ? 'chip-purple' : 'chip-green';
    summaryTags.push({ label: e, color: c });
  });
  if (hasSwap('Wrong drug') && drugName && dispensedDrug) summaryTags.push({ label: `${drugName} → ${dispensedDrug}`, color: 'chip-coral' });
  if (hasSwap('Wrong dose') && prescribedStrength && dispensedStrength) summaryTags.push({ label: `${prescribedStrength} → ${dispensedStrength}`, color: 'chip-amber' });
  if (hasSwap('Wrong formulation') && correctFormulation && dispensedFormulation) summaryTags.push({ label: `${correctFormulation} → ${dispensedFormulation}`, color: 'chip-purple' });
  if (whereCaught) summaryTags.push({ label: whereCaught, color: 'chip-blue' });
  if (timeOfDay) summaryTags.push({ label: timeOfDay, color: 'chip-blue' });
  selectedFactors.forEach(f => summaryTags.push({ label: f, color: 'chip-amber' }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-32 lg:pb-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left: Form ── */}
        <div className="flex-1 min-w-0">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}

          {/* Section 1: What went wrong */}
          <h2 className="text-xl font-bold text-gray-900 mb-1">What went wrong?</h2>
          <p className="text-sm text-gray-500 mb-4">Select all that apply</p>

          {Object.entries(errorOpts).map(([group, opts]) => (
            <div key={group}>
              <SectionLabel text={group} />
              <div className="flex flex-wrap gap-2 mb-2">
                {opts.map(opt => (
                  <button key={opt.id} onClick={() => toggleError(opt.label)}
                    className={`chip ${chipColor(opt.label, selectedErrors.includes(opt.label))}`}
                    aria-pressed={selectedErrors.includes(opt.label)}>
                    {opt.label}
                  </button>
                ))}
                <button onClick={() => setShowOther(p => ({ ...p, [group]: !p[group] }))}
                  className={`chip ${showOther[group] ? 'chip-green' : 'chip-other'}`}>+ Other</button>
              </div>
              {showOther[group] && (
                <input type="text" maxLength={120} value={otherTexts[group] || ''}
                  onChange={e => setOtherTexts(p => ({ ...p, [group]: e.target.value }))}
                  className="input-field mb-2" placeholder="Describe — do not enter patient names or identifiers" />
              )}
            </div>
          ))}

          {/* Swap boxes */}
          <div className="space-y-2 mt-4">
            {hasSwap('Wrong drug') && (
              <div className="rounded-2xl p-4 border-[1.5px] border-[#D85A30]" style={{ background: '#FFF5F0' }}>
                <p className="text-sm font-semibold text-[#712B13] mb-3">Which drug was dispensed instead?</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Prescribed</label>
                    <input type="text" value={drugName} onChange={e => setDrugName(e.target.value)} className="input-field"
                      placeholder="Drug name" list="drug-suggestions" />
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-[#D85A30] flex items-center justify-center flex-shrink-0 mt-5">
                    <ArrowLeftRight size={16} className="text-[#D85A30]" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Dispensed in error</label>
                    <input type="text" value={dispensedDrug} onChange={e => setDispensedDrug(e.target.value)} className="input-field"
                      placeholder="Drug name" list="drug-suggestions" />
                  </div>
                </div>
              </div>
            )}
            {hasSwap('Wrong dose') && (
              <div className="rounded-2xl p-4 border-[1.5px] border-[#BA7517]" style={{ background: '#FFFBF0' }}>
                <p className="text-sm font-semibold text-[#633806] mb-3">Which strength was dispensed instead?</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Prescribed strength</label>
                    <input type="text" value={prescribedStrength} onChange={e => setPrescribedStrength(e.target.value)} className="input-field" placeholder="e.g. 500mg" />
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-[#BA7517] flex items-center justify-center flex-shrink-0 mt-5">
                    <ArrowLeftRight size={16} className="text-[#BA7517]" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Dispensed in error</label>
                    <input type="text" value={dispensedStrength} onChange={e => setDispensedStrength(e.target.value)} className="input-field" placeholder="e.g. 1000mg" />
                  </div>
                </div>
              </div>
            )}
            {hasSwap('Wrong formulation') && (
              <div className="rounded-2xl p-4 border-[1.5px] border-[#7F77DD]" style={{ background: '#F5F3FF' }}>
                <p className="text-sm font-semibold text-[#3C3489] mb-3">Which formulation was dispensed instead?</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Correct formulation</label>
                    <input type="text" value={correctFormulation} onChange={e => setCorrectFormulation(e.target.value)} className="input-field" placeholder="e.g. Liquid" />
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-[#7F77DD] flex items-center justify-center flex-shrink-0 mt-5">
                    <ArrowLeftRight size={16} className="text-[#7F77DD]" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Dispensed in error</label>
                    <input type="text" value={dispensedFormulation} onChange={e => setDispensedFormulation(e.target.value)} className="input-field" placeholder="e.g. Tablet" />
                  </div>
                </div>
              </div>
            )}
            {!hasAnySwap && hasErrorType && (
              <div className="rounded-2xl p-4 border-[1.5px] border-[#1D9E75]" style={{ background: '#F0FAF5' }}>
                <label className="text-sm font-semibold text-[#085041] mb-2 block">Drug involved</label>
                <input type="text" value={drugName} onChange={e => setDrugName(e.target.value)} className="input-field"
                  placeholder="Drug name (optional)" list="drug-suggestions" />
              </div>
            )}
          </div>

          <datalist id="drug-suggestions">
            {DRUG_SUGGESTIONS.map(d => <option key={d} value={d} />)}
          </datalist>

          {/* Section 2: Where was it caught */}
          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-1">Where was it caught?</h2>
          <p className="text-sm text-gray-500 mb-4">Select one</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {caughtOpts.map(opt => (
              <button key={opt.id} onClick={() => { setWhereCaught(opt.label); setShowOtherCaught(false); setOtherCaught(''); }}
                className={`chip ${whereCaught === opt.label ? 'chip-blue' : 'chip-off'}`}
                aria-pressed={whereCaught === opt.label}>{opt.label}</button>
            ))}
            <button onClick={() => { setShowOtherCaught(!showOtherCaught); setWhereCaught(''); }}
              className={`chip ${showOtherCaught ? 'chip-blue' : 'chip-other'}`}>+ Other</button>
          </div>
          {showOtherCaught && (
            <input type="text" maxLength={120} value={otherCaught} onChange={e => setOtherCaught(e.target.value)}
              className="input-field mb-4" placeholder="Describe — do not enter patient names or identifiers" />
          )}

          <SectionLabel text="Time of day" />
          <div className="flex flex-wrap gap-2 mb-4">
            {['Morning 8\u201312pm', 'Lunch 12\u20132pm', 'Afternoon 2\u20136pm', 'Evening 6pm+'].map(t => (
              <button key={t} onClick={() => setTimeOfDay(t)}
                className={`chip ${timeOfDay === t ? 'chip-blue' : 'chip-off'}`}
                aria-pressed={timeOfDay === t}>{t}</button>
            ))}
          </div>

          {/* Section 3: Contributing factors */}
          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-1">What contributed to it?</h2>
          <p className="text-sm text-gray-500 mb-4">Select all that apply</p>

          {Object.entries(factorOpts).map(([group, opts]) => (
            <div key={group}>
              <SectionLabel text={group} />
              <div className="flex flex-wrap gap-2 mb-2">
                {opts.map(opt => (
                  <button key={opt.id} onClick={() => toggleFactor(opt.label)}
                    className={`chip ${selectedFactors.includes(opt.label) ? 'chip-amber' : 'chip-off'}`}
                    aria-pressed={selectedFactors.includes(opt.label)}>{opt.label}</button>
                ))}
                <button onClick={() => setShowFactorOther(p => ({ ...p, [group]: !p[group] }))}
                  className={`chip ${showFactorOther[group] ? 'chip-amber' : 'chip-other'}`}>+ Other</button>
              </div>
              {showFactorOther[group] && (
                <input type="text" maxLength={120} value={factorOtherTexts[group] || ''}
                  onChange={e => setFactorOtherTexts(p => ({ ...p, [group]: e.target.value }))}
                  className="input-field mb-2" placeholder="Describe — do not enter patient names or identifiers" />
              )}
            </div>
          ))}

          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-field resize-none"
              placeholder="Any extra context for the manager — do not enter patient names or identifiers" />
          </div>

          {/* Mobile submit (hidden on desktop) */}
          <div className="lg:hidden mt-6">
            <p className="text-xs text-gray-400 text-center mb-2">Your report is anonymous — your manager sees what happened, not who submitted it.</p>
            <button onClick={handleSubmit} disabled={!canSubmit || submitting}
              className={`w-full text-base py-4 rounded-xl font-semibold transition-colors ${canSubmit ? 'bg-[#0F6E56] text-white hover:bg-[#0B5A46]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              {submitting ? 'Submitting...' : canSubmit ? 'Submit report' : `Still needed: ${stillNeeded.join(', ')}`}
            </button>
          </div>
        </div>

        {/* ── Right sidebar: Live summary ── */}
        <div className="hidden lg:block w-80 flex-shrink-0">
          <div className="sticky top-20 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Live summary</h3>
              {summaryTags.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Select an error type to begin.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {summaryTags.map((t, i) => (
                    <span key={i} className={`chip text-xs py-1 px-2.5 ${t.color}`}>{t.label}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Requirements</h3>
              {[
                { met: hasErrorType, label: 'Error type selected' },
                { met: hasDrugDetails, label: hasSwap('Wrong drug') ? 'Both drug names entered' : hasSwap('Wrong formulation') ? 'Formulation details entered' : 'Drug / swap details entered' },
                { met: hasWhereCaught, label: 'Where caught selected' },
                { met: hasFactor, label: 'Contributing factor selected' },
              ].map(({ met, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${met ? 'bg-[#1D9E75]' : 'bg-gray-200'}`}>
                    {met && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className={`text-sm ${met ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 text-center">Your report is anonymous — your manager sees what happened, not who submitted it.</p>

            <button onClick={handleSubmit} disabled={!canSubmit || submitting}
              className={`w-full text-base py-4 rounded-xl font-semibold transition-colors ${canSubmit ? 'bg-[#0F6E56] text-white hover:bg-[#0B5A46]' : 'bg-[#CCCCCC] text-gray-500 cursor-not-allowed'}`}>
              {submitting ? 'Submitting...' : canSubmit ? 'Submit report' : `Still needed: ${stillNeeded.join(', ')}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
