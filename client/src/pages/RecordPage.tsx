import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { CheckCircle2, AlertTriangle, ArrowRight, Flag, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface Opt { id: string; label: string; group_name: string; category: string; }

const DRUG_SUGGESTIONS = ['Metformin', 'Warfarin', 'Amoxicillin', 'Flucloxacillin', 'Losartan', 'Omeprazole', 'Simvastatin', 'Amlodipine'];
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
  const [options, setOptions] = useState<Record<string, Record<string, Opt[]>>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Section 1
  const [selectedErrors, setSelectedErrors] = useState<string[]>([]);
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [showOther, setShowOther] = useState<Record<string, boolean>>({});
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
  const [timeOfDay, setTimeOfDay] = useState('');

  // Section 3
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
  const [factorOtherTexts, setFactorOtherTexts] = useState<Record<string, string>>({});
  const [showFactorOther, setShowFactorOther] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');

  // UI state — which section is expanded
  const [openSection, setOpenSection] = useState(1);

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

  const DISPENSING_LABELS = [...SWAP_CHIPS, 'Wrong quantity', 'Expired medication'];
  const LABELLING_LABELS = ['Wrong directions on label', 'CAL missing or incorrect', 'Label on wrong item'];
  const toggleError = (label: string) => {
    setSelectedErrors(prev => {
      const next = prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label];
      // If selecting a patient-level error, clear dispensing + labelling errors
      if ((label === 'Wrong patient' || label === 'Repeat dispensed early') && next.includes(label)) {
        return next.filter(l => !DISPENSING_LABELS.includes(l) && !LABELLING_LABELS.includes(l));
      }
      return next;
    });
  };
  const toggleFactor = (label: string) => setSelectedFactors(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);

  const resetForm = useCallback(() => {
    setSelectedErrors([]); setOtherTexts({}); setShowOther({});
    setDrugName(''); setDispensedDrug(''); setPrescribedStrength('');
    setDispensedStrength(''); setCorrectFormulation(''); setDispensedFormulation('');
    setWhereCaught(''); setOtherCaught(''); setShowOtherCaught(false);
    setTimeOfDay(''); setSelectedFactors([]);
    setFactorOtherTexts({}); setShowFactorOther({}); setNotes('');
    setSubmitted(false); setIncidentId(''); setAutoResetTimer(30); setEditTimer(900);
    setFlagSent(false); setError(''); setOpenSection(1);
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

  // ── Confirmation ──
  if (submitted) {
    const editPct = (editTimer / 900) * 100;
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-[#E1F5EE] flex items-center justify-center mb-4">
          <CheckCircle2 size={40} className="text-[#0F6E56]" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Report submitted</h2>
        <p className="text-sm text-gray-500 mb-1">Logged at {submittedAt}</p>
        <p className="text-sm text-gray-500 mb-6">Thank you \u2014 your report helps keep patients safe.</p>
        <div className="w-full max-w-xs mb-4">
          <div className="text-xs text-gray-400 mb-1">Edit window: {Math.floor(editTimer / 60)}:{String(editTimer % 60).padStart(2, '0')}</div>
          <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-[#0F6E56] h-2 rounded-full transition-all" style={{ width: `${editPct}%` }} /></div>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          {editTimer > 0 && <button onClick={() => { setSubmitted(false); setAutoResetTimer(999); }} className="btn-outline text-sm">Edit this report</button>}
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

  // If "Wrong patient" or "Repeat dispensed early" selected, Dispensing and Labelling don't apply
  const patientLevelError = selectedErrors.includes('Wrong patient') || selectedErrors.includes('Repeat dispensed early');
  const shouldHideGroup = (group: string) => patientLevelError && (group === 'Dispensing' || group === 'Labelling');

  // Summary tags for sidebar
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

  // Section header component
  const SectionHeader = ({ num, title, done, open, onClick }: { num: number; title: string; done: boolean; open: boolean; onClick: () => void }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl text-left transition-colors ${open ? 'bg-white shadow-sm border border-gray-200' : done ? 'bg-[#F0FAF5] border border-[#C8E6D8]' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${done ? 'bg-[#1D9E75] text-white' : open ? 'bg-[#0F6E56] text-white' : 'bg-gray-300 text-white'}`}>
        {done ? <svg width="12" height="10" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : num}
      </div>
      <span className={`flex-1 text-sm font-semibold ${done ? 'text-[#085041]' : 'text-gray-900'}`}>{title}</span>
      {done && !open && <span className="text-xs text-[#1D9E75]">Done</span>}
      {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
    </button>
  );

  const GroupLabel = ({ text }: { text: string }) => (
    <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-3 mb-1.5">{text}</div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-32 lg:pb-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── LEFT: Form ── */}
        <div className="flex-1 min-w-0 space-y-3">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}

          {/* ═══ Section 1: What went wrong ═══ */}
          <SectionHeader num={1} title="What went wrong?" done={hasErrorType && hasDrugDetails} open={openSection === 1} onClick={() => setOpenSection(openSection === 1 ? 0 : 1)} />

          {openSection === 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
              {Object.entries(errorOpts).map(([group, opts]) => {
                if (shouldHideGroup(group)) return null;
                return (
                <div key={group}>
                  <GroupLabel text={group} />
                  <div className="flex flex-wrap gap-1.5">
                    {opts.map(opt => (
                      <button key={opt.id} onClick={() => toggleError(opt.label)}
                        className={`chip text-[13px] py-2 px-3 ${chipColor(opt.label, selectedErrors.includes(opt.label))}`}>
                        {opt.label}
                      </button>
                    ))}
                    <button onClick={() => setShowOther(p => ({ ...p, [group]: !p[group] }))}
                      className={`chip text-[13px] py-2 px-3 ${showOther[group] || otherTexts[group]?.trim() ? 'chip-green' : 'chip-other'}`}>
                      {otherTexts[group]?.trim() ? `Other: "${otherTexts[group].trim().slice(0, 20)}${otherTexts[group].trim().length > 20 ? '...' : ''}"` : '+ Other'}
                    </button>
                  </div>
                  {showOther[group] && (
                    <input type="text" maxLength={120} value={otherTexts[group] || ''} autoFocus
                      onChange={e => setOtherTexts(p => ({ ...p, [group]: e.target.value }))}
                      className="input-field text-sm mt-1.5" placeholder="Describe \u2014 do not enter patient names or identifiers" />
                  )}
                </div>
                );
              })}

              {patientLevelError && (
                <p className="text-xs text-gray-400 italic mt-2">Dispensing and labelling errors not applicable when wrong patient or repeat dispensed early is selected.</p>
              )}

              {/* Swap boxes */}
              {hasSwap('Wrong drug') && (
                <div className="rounded-xl p-3 border-[1.5px] border-[#D85A30] mt-3" style={{ background: '#FFF5F0' }}>
                  <p className="text-xs font-semibold text-[#712B13] mb-2">Which drug was dispensed instead?</p>
                  <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
                    <div>
                      <label className="text-[11px] text-gray-500 mb-0.5 block">Prescribed</label>
                      <input type="text" value={drugName} onChange={e => setDrugName(e.target.value)} className="input-field text-sm py-2" placeholder="e.g. Losartan" list="drug-suggestions" />
                    </div>
                    <ArrowRight size={16} className="text-[#D85A30] mb-2.5" />
                    <div>
                      <label className="text-[11px] text-gray-500 mb-0.5 block">Dispensed in error</label>
                      <input type="text" value={dispensedDrug} onChange={e => setDispensedDrug(e.target.value)} className="input-field text-sm py-2" placeholder="e.g. Lisinopril" list="drug-suggestions" />
                    </div>
                  </div>
                </div>
              )}
              {hasSwap('Wrong dose') && (
                <div className="rounded-xl p-3 border-[1.5px] border-[#BA7517] mt-3" style={{ background: '#FFFBF0' }}>
                  <p className="text-xs font-semibold text-[#633806] mb-2">Which strength was dispensed instead?</p>
                  <div className="mb-2">
                    <label className="text-[11px] text-gray-500 mb-0.5 block">Drug name</label>
                    <input type="text" value={drugName} onChange={e => setDrugName(e.target.value)} className="input-field text-sm py-2" placeholder="e.g. Losartan" list="drug-suggestions" />
                  </div>
                  <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
                    <div>
                      <label className="text-[11px] text-gray-500 mb-0.5 block">Prescribed</label>
                      <input type="text" value={prescribedStrength} onChange={e => setPrescribedStrength(e.target.value)} className="input-field text-sm py-2" placeholder="e.g. 25mg" />
                    </div>
                    <ArrowRight size={16} className="text-[#BA7517] mb-2.5" />
                    <div>
                      <label className="text-[11px] text-gray-500 mb-0.5 block">Dispensed</label>
                      <input type="text" value={dispensedStrength} onChange={e => setDispensedStrength(e.target.value)} className="input-field text-sm py-2" placeholder="e.g. 50mg" />
                    </div>
                  </div>
                </div>
              )}
              {hasSwap('Wrong formulation') && (
                <div className="rounded-xl p-3 border-[1.5px] border-[#7F77DD] mt-3" style={{ background: '#F5F3FF' }}>
                  <p className="text-xs font-semibold text-[#3C3489] mb-2">Which formulation was dispensed instead?</p>
                  <div className="mb-2">
                    <label className="text-[11px] text-gray-500 mb-0.5 block">Drug name</label>
                    <input type="text" value={drugName} onChange={e => setDrugName(e.target.value)} className="input-field text-sm py-2" placeholder="e.g. Losartan" list="drug-suggestions" />
                  </div>
                  <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
                    <div>
                      <label className="text-[11px] text-gray-500 mb-0.5 block">Correct</label>
                      <input type="text" value={correctFormulation} onChange={e => setCorrectFormulation(e.target.value)} className="input-field text-sm py-2" placeholder="e.g. Tablet" />
                    </div>
                    <ArrowRight size={16} className="text-[#7F77DD] mb-2.5" />
                    <div>
                      <label className="text-[11px] text-gray-500 mb-0.5 block">Dispensed</label>
                      <input type="text" value={dispensedFormulation} onChange={e => setDispensedFormulation(e.target.value)} className="input-field text-sm py-2" placeholder="e.g. Capsule" />
                    </div>
                  </div>
                </div>
              )}
              {!hasAnySwap && hasErrorType && (
                <div className="rounded-xl p-3 border-[1.5px] border-[#1D9E75] mt-3" style={{ background: '#F0FAF5' }}>
                  <label className="text-xs font-semibold text-[#085041] mb-1 block">Drug involved (optional)</label>
                  <input type="text" value={drugName} onChange={e => setDrugName(e.target.value)} className="input-field text-sm py-2" placeholder="e.g. Losartan" list="drug-suggestions" />
                </div>
              )}
              <datalist id="drug-suggestions">{DRUG_SUGGESTIONS.map(d => <option key={d} value={d} />)}</datalist>

              {hasErrorType && hasDrugDetails && (
                <button onClick={() => setOpenSection(2)} className="mt-3 text-sm font-medium text-[#0F6E56] flex items-center gap-1 hover:underline">
                  Next: Where was it caught? <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}

          {/* ═══ Section 2: Where caught ═══ */}
          <SectionHeader num={2} title="Where was it caught?" done={hasWhereCaught} open={openSection === 2} onClick={() => setOpenSection(openSection === 2 ? 0 : 2)} />

          {openSection === 2 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {caughtOpts.map((opt: Opt) => (
                  <button key={opt.id} onClick={() => { setWhereCaught(opt.label); setShowOtherCaught(false); setOtherCaught(''); }}
                    className={`chip text-[13px] py-2 px-3 ${whereCaught === opt.label ? 'chip-blue' : 'chip-off'}`}>{opt.label}</button>
                ))}
                <button onClick={() => { setShowOtherCaught(!showOtherCaught); setWhereCaught(''); }}
                  className={`chip text-[13px] py-2 px-3 ${showOtherCaught || otherCaught.trim() ? 'chip-blue' : 'chip-other'}`}>
                  {otherCaught.trim() ? `Other: "${otherCaught.trim().slice(0, 20)}${otherCaught.trim().length > 20 ? '...' : ''}"` : '+ Other'}
                </button>
              </div>
              {showOtherCaught && (
                <input type="text" maxLength={120} value={otherCaught} onChange={e => setOtherCaught(e.target.value)} autoFocus
                  className="input-field text-sm" placeholder="Describe \u2014 do not enter patient names or identifiers" />
              )}

              <GroupLabel text="Time of day" />
              <div className="flex flex-wrap gap-1.5">
                {TIME_OPTIONS.map(t => (
                  <button key={t} onClick={() => setTimeOfDay(prev => prev === t ? '' : t)}
                    className={`chip text-[13px] py-2 px-3 ${timeOfDay === t ? 'chip-blue' : 'chip-off'}`}>{t}</button>
                ))}
              </div>

              {hasWhereCaught && (
                <button onClick={() => setOpenSection(3)} className="mt-2 text-sm font-medium text-[#0F6E56] flex items-center gap-1 hover:underline">
                  Next: Contributing factors <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}

          {/* ═══ Section 3: Factors ═══ */}
          <SectionHeader num={3} title="What contributed?" done={hasFactor} open={openSection === 3} onClick={() => setOpenSection(openSection === 3 ? 0 : 3)} />

          {openSection === 3 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
              {Object.entries(factorOpts).map(([group, opts]) => (
                <div key={group}>
                  <GroupLabel text={group} />
                  <div className="flex flex-wrap gap-1.5">
                    {opts.map((opt: Opt) => (
                      <button key={opt.id} onClick={() => toggleFactor(opt.label)}
                        className={`chip text-[13px] py-2 px-3 ${selectedFactors.includes(opt.label) ? 'chip-amber' : 'chip-off'}`}>{opt.label}</button>
                    ))}
                    <button onClick={() => setShowFactorOther(p => ({ ...p, [group]: !p[group] }))}
                      className={`chip text-[13px] py-2 px-3 ${showFactorOther[group] || factorOtherTexts[group]?.trim() ? 'chip-amber' : 'chip-other'}`}>
                      {factorOtherTexts[group]?.trim() ? `Other: "${factorOtherTexts[group].trim().slice(0, 20)}${factorOtherTexts[group].trim().length > 20 ? '...' : ''}"` : '+ Other'}
                    </button>
                  </div>
                  {showFactorOther[group] && (
                    <input type="text" maxLength={120} value={factorOtherTexts[group] || ''} autoFocus
                      onChange={e => setFactorOtherTexts(p => ({ ...p, [group]: e.target.value }))}
                      className="input-field text-sm mt-1.5" placeholder="Describe \u2014 do not enter patient names or identifiers" />
                  )}
                </div>
              ))}
              <div className="mt-3">
                <label className="text-[11px] text-gray-400 mb-0.5 block">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input-field text-sm resize-none"
                  placeholder="Any extra context \u2014 do not enter patient names or identifiers" />
              </div>
            </div>
          )}

          {/* Mobile submit */}
          <div className="lg:hidden mt-2">
            <p className="text-[10px] text-gray-400 text-center mb-2">Anonymous \u2014 your manager sees what happened, not who submitted it.</p>
            <button onClick={handleSubmit} disabled={!canSubmit || submitting}
              className={`w-full py-4 rounded-xl font-semibold text-sm ${canSubmit ? 'bg-[#0F6E56] text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              {submitting ? 'Submitting...' : canSubmit ? 'Submit report' : `Still needed: ${stillNeeded.join(', ')}`}
            </button>
          </div>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-16 space-y-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Summary</h3>
              {tags.length === 0 ? (
                <p className="text-xs text-gray-300 italic">Select an error type to begin.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {tags.map((t, i) => <span key={i} className={`inline-block text-[11px] py-0.5 px-2 rounded-full font-medium border ${t.color}`}>{t.label}</span>)}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              {[
                { met: hasErrorType, label: 'Error type' },
                { met: hasDrugDetails, label: 'Drug details' },
                { met: hasWhereCaught, label: 'Where caught' },
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

            <p className="text-[10px] text-gray-400 text-center leading-tight">Anonymous \u2014 your manager sees what happened, not who submitted it.</p>

            <button onClick={handleSubmit} disabled={!canSubmit || submitting}
              className={`w-full py-3 rounded-xl font-semibold text-sm ${canSubmit ? 'bg-[#0F6E56] text-white hover:bg-[#0B5A46]' : 'bg-[#CCCCCC] text-gray-500 cursor-not-allowed'}`}>
              {submitting ? 'Submitting...' : canSubmit ? 'Submit report' : `Still needed: ${stillNeeded.join(', ')}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
