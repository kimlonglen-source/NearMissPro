import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, AlertTriangle, Clock, ChevronDown, ChevronUp, Edit3, MessageSquare, XCircle, Loader2, FileText, Calendar } from 'lucide-react';

interface Rec { id: string; ai_text: string; manager_outcome: string | null; manager_text?: string; private_note?: string; }
interface Incident {
  id: string; error_types: string[]; drug_name: string; dispensed_drug?: string;
  prescribed_strength?: string; dispensed_strength?: string; correct_formulation?: string;
  dispensed_formulation?: string; where_caught: string; time_of_day: string;
  factors: string[]; notes?: string; submitted_at: string; status: string;
  flagged_by_staff: boolean; flag_note?: string; recommendations: Rec[];
}

export function DashboardPage() {
  const { pharmacyName } = useAuth();
  const nav = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [patternAlert, setPatternAlert] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modText, setModText] = useState('');
  const [showMod, setShowMod] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingReport, setExistingReport] = useState<{ id: string; generated_at: string } | null>(null);

  // Date range — the first thing the manager sets
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));
  const [periodSet, setPeriodSet] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [res, pa, reports] = await Promise.all([
        api.getIncidents({ from: dateFrom, to: dateTo }),
        api.getPatternAlert().catch(() => ({ alert: null })),
        api.getReports(),
      ]);
      // Check if a report already exists for this date range
      const existing = (reports as { id: string; period_start: string; period_end: string; generated_at: string }[])
        .find(r => r.period_start <= dateFrom && r.period_end >= dateTo);
      setExistingReport(existing ? { id: existing.id, generated_at: existing.generated_at } : null);
      const list = (res.incidents as unknown as Incident[]).sort((a, b) => {
        const ap = isPending(a), bp = isPending(b);
        if (ap !== bp) return ap ? -1 : 1;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });
      setIncidents(list);
      setPatternAlert(pa.alert);
    } finally { setLoading(false); }
  };

  const isPending = (i: Incident) => i.status === 'active' && !i.recommendations?.[0]?.manager_outcome;
  const activeIncidents = incidents.filter(i => i.status === 'active');
  const voidedIncidents = incidents.filter(i => i.status === 'voided');
  const pendingList = activeIncidents.filter(isPending);
  const reviewedList = activeIncidents.filter(i => !isPending(i));
  const allReviewed = pendingList.length === 0 && activeIncidents.length > 0;

  const peakTime = (() => {
    const counts: Record<string, number> = {};
    activeIncidents.forEach(i => { if (i.time_of_day) counts[i.time_of_day] = (counts[i.time_of_day] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : '-';
  })();

  const doAction = async (rec: Rec, outcome: string, text?: string, note?: string) => {
    setBusy(true);
    try {
      await api.actionRecommendation(rec.id, { managerOutcome: outcome, managerText: text, privateNote: note });
      await load();
      setModText(''); setShowMod(false); setNoteText(''); setShowNote(false);
    } finally { setBusy(false); }
  };

  const doVoid = async () => {
    if (!voidId || !voidReason.trim()) return;
    setBusy(true);
    try { await api.voidIncident(voidId, voidReason.trim()); await load(); setVoidId(null); setVoidReason(''); } finally { setBusy(false); }
  };

  const handleReport = async () => {
    setBusy(true);
    try {
      const report = await api.generateReport({ periodStart: dateFrom, periodEnd: dateTo, generatedBy: pharmacyName || 'Manager' });
      nav(`/reports/${(report as { id: string }).id}`);
    } finally { setBusy(false); }
  };

  const getOutcome = (i: Incident) => i.status === 'voided' ? 'voided' : (i.recommendations?.[0]?.manager_outcome || null);

  const outcomeBadge = (outcome: string | null) => {
    if (!outcome) return <span className="bg-[#FAEEDA] text-[#633806] text-xs font-semibold px-2.5 py-1 rounded-full">Needs review</span>;
    const map: Record<string, string> = { accepted: 'bg-[#E1F5EE] text-[#085041]', modified: 'bg-[#EEEDFE] text-[#3C3489]', no_action: 'bg-gray-100 text-gray-600', voided: 'bg-[#FCEBEB] text-[#791F1F]' };
    const labels: Record<string, string> = { accepted: '\u2713 Accepted', modified: '\u2713 Modified', no_action: '\u2713 No action', voided: 'Voided' };
    return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[outcome] || ''}`}>{labels[outcome] || outcome}</span>;
  };

  const drugLabel = (i: Incident) => {
    if (i.dispensed_drug) return `${i.drug_name} \u2192 ${i.dispensed_drug}`;
    if (i.dispensed_strength) return `${i.drug_name} ${i.prescribed_strength} \u2192 ${i.dispensed_strength}`;
    if (i.dispensed_formulation) return `${i.drug_name} ${i.correct_formulation} \u2192 ${i.dispensed_formulation}`;
    return i.drug_name;
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });

  // ── Step 1: Pick review period ──
  if (!periodSet) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <Calendar size={40} className="mx-auto mb-4 text-[#0F6E56]" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Start a review</h1>
        <p className="text-sm text-gray-500 mb-6">Select the date range for the incidents you want to review.</p>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 text-left">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field text-sm" />
          </div>
        </div>

        <button onClick={() => { setPeriodSet(true); load(); }}
          disabled={!dateFrom || !dateTo}
          className="w-full mt-4 py-3.5 rounded-xl font-semibold text-sm bg-[#0F6E56] text-white hover:bg-[#0B5A46] disabled:bg-gray-200 disabled:text-gray-400">
          Load incidents
        </button>

        <button onClick={() => nav('/reports')} className="mt-4 text-sm text-gray-500 hover:text-[#0F6E56] flex items-center gap-1 mx-auto">
          <FileText size={14} /> View past reports
        </button>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-[#0F6E56]" size={32} /></div>;

  // ── Step 2: Review incidents ──
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header with period */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Review incidents</h1>
          <p className="text-xs text-gray-500">{fmtDate(dateFrom)} \u2014 {fmtDate(dateTo)}</p>
        </div>
        <button onClick={() => setPeriodSet(false)} className="text-sm text-gray-500 hover:text-[#0F6E56]">Change dates</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="text-xl font-bold">{activeIncidents.length}</div>
          <div className="text-[11px] text-gray-500">Active</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="text-xl font-bold text-[#BA7517]">{pendingList.length}</div>
          <div className="text-[11px] text-gray-500">Pending</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="text-xl font-bold text-[#0F6E56]">{reviewedList.length}</div>
          <div className="text-[11px] text-gray-500">Reviewed</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="text-xl font-bold">{peakTime}</div>
          <div className="text-[11px] text-gray-500">Peak time</div>
        </div>
      </div>

      {/* Pattern alert */}
      {patternAlert && (
        <div className="bg-[#FAEEDA] border border-[#BA7517] rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
          <AlertTriangle size={16} className="text-[#BA7517] mt-0.5 flex-shrink-0" />
          <p className="text-sm text-[#633806]">{patternAlert}</p>
        </div>
      )}

      {/* Progress */}
      {activeIncidents.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{pendingList.length > 0 ? `${pendingList.length} incident${pendingList.length > 1 ? 's' : ''} still to review` : 'All incidents reviewed'}</span>
            <span>{reviewedList.length}/{activeIncidents.length}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full">
            <div className={`h-2 rounded-full transition-all ${allReviewed ? 'bg-[#1D9E75]' : 'bg-[#BA7517]'}`}
              style={{ width: `${(reviewedList.length / activeIncidents.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeIncidents.length === 0 && (
        <div className="text-center py-12">
          <Clock size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No incidents recorded in this period</p>
          <p className="text-xs text-gray-400 mt-1">Try a different date range, or check back later.</p>
          <button onClick={() => setPeriodSet(false)} className="btn-outline text-sm mt-4">Change dates</button>
        </div>
      )}

      {/* Incident list */}
      <div className="space-y-2">
        {activeIncidents.map(inc => {
          const isOpen = activeId === inc.id;
          const outcome = getOutcome(inc);
          const rec = inc.recommendations?.[0];
          const pending = isPending(inc);

          return (
            <div key={inc.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${pending ? 'border-l-4 border-l-[#BA7517] border-t border-r border-b border-t-gray-200 border-r-gray-200 border-b-gray-200' : 'border-gray-200'}`}>
              <button className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                onClick={() => { setActiveId(isOpen ? null : inc.id); setShowMod(false); setShowNote(false); }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{inc.error_types.join(', ')}</span>
                    {inc.drug_name && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{drugLabel(inc)}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(inc.submitted_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                    {inc.where_caught && ` \u00B7 ${inc.where_caught}`}
                  </p>
                </div>
                {outcomeBadge(outcome)}
                {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {isOpen && (
                <div className="border-t px-4 py-4 space-y-4" onClick={e => e.stopPropagation()}>
                  {/* Details */}
                  {(inc.dispensed_drug || inc.dispensed_strength || inc.dispensed_formulation || inc.factors.length > 0 || inc.notes) && (
                    <div className="text-sm space-y-1">
                      {inc.dispensed_drug && <p><span className="text-gray-500">Drug swap:</span> <span className="font-medium">{inc.drug_name} \u2192 {inc.dispensed_drug}</span></p>}
                      {inc.dispensed_strength && <p><span className="text-gray-500">Strength:</span> <span className="font-medium">{inc.prescribed_strength} \u2192 {inc.dispensed_strength}</span></p>}
                      {inc.dispensed_formulation && <p><span className="text-gray-500">Formulation:</span> <span className="font-medium">{inc.correct_formulation} \u2192 {inc.dispensed_formulation}</span></p>}
                      {inc.time_of_day && <p><span className="text-gray-500">Time:</span> <span className="font-medium">{inc.time_of_day}</span></p>}
                      {inc.factors.length > 0 && <p><span className="text-gray-500">Factors:</span> <span className="font-medium">{inc.factors.join(', ')}</span></p>}
                      {inc.notes && <p className="text-gray-500 text-xs italic">{inc.notes}</p>}
                    </div>
                  )}

                  {/* AI Recommendation */}
                  {rec && (
                    <div className="bg-[#F0FAF5] border border-[#C8E6D8] rounded-xl p-4">
                      <p className="text-xs font-bold text-[#085041] uppercase tracking-wider mb-1">AI Recommendation</p>
                      <p className="text-[10px] text-[#085041]/60 mb-2">Read this suggestion, then choose an action below.</p>
                      <p className="text-sm text-gray-800 leading-relaxed">{rec.ai_text}</p>
                      {rec.manager_outcome === 'modified' && rec.manager_text && (
                        <div className="mt-3 pt-3 border-t border-[#C8E6D8]">
                          <p className="text-xs font-bold text-[#3C3489] mb-1">Your version:</p>
                          <p className="text-sm text-gray-800">{rec.manager_text}</p>
                        </div>
                      )}
                      {rec.private_note && (
                        <div className="mt-3 pt-3 border-t border-[#C8E6D8]">
                          <p className="text-xs text-gray-500"><MessageSquare size={10} className="inline mr-1" />Note: {rec.private_note}</p>
                        </div>
                      )}
                      <p className="text-[9px] text-gray-400 mt-3 italic">Advisory only. The pharmacist-in-charge makes all decisions.</p>
                    </div>
                  )}

                  {/* Actions */}
                  {inc.status !== 'voided' && rec && !showMod && !showNote && (
                    <div className="space-y-2">
                      {pending && <p className="text-xs font-medium text-gray-600">What would you like to do?</p>}
                      <button className="w-full py-3.5 rounded-xl font-semibold text-sm bg-[#0F6E56] text-white hover:bg-[#0B5A46] flex items-center justify-center gap-2"
                        disabled={busy} onClick={() => doAction(rec, 'accepted')}>
                        <CheckCircle2 size={16} /> Accept recommendation
                      </button>
                      <div className="flex gap-2">
                        <button className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[#EEEDFE] text-[#3C3489] hover:bg-[#E0DEFE] flex items-center justify-center gap-1.5"
                          onClick={() => { setShowMod(true); setModText(rec.manager_text || rec.ai_text); }}>
                          <Edit3 size={14} /> Modify
                        </button>
                        <button className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                          disabled={busy} onClick={() => doAction(rec, 'no_action')}>No action needed</button>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button className="flex-1 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-50 border border-gray-200 flex items-center justify-center gap-1"
                          onClick={() => { setShowNote(true); setNoteText(rec.private_note || ''); }}>
                          <MessageSquare size={12} /> Private note
                        </button>
                        <button className="py-2 px-3 rounded-lg text-xs text-red-500 hover:bg-red-50 border border-red-200 flex items-center justify-center gap-1"
                          onClick={() => setVoidId(inc.id)}>
                          <XCircle size={12} /> Void
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Modify inline */}
                  {showMod && activeId === inc.id && rec && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Edit the recommendation in your own words:</p>
                      <textarea className="input-field text-sm border-[#7F77DD]" rows={3} value={modText} onChange={e => setModText(e.target.value)} autoFocus />
                      <div className="flex gap-2">
                        <button className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[#7F77DD] text-white hover:bg-[#6B63C7]"
                          disabled={busy || !modText.trim()} onClick={() => doAction(rec, 'modified', modText)}>Save</button>
                        <button className="py-2.5 px-4 rounded-xl text-sm text-gray-500 hover:bg-gray-100" onClick={() => setShowMod(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Note inline */}
                  {showNote && activeId === inc.id && rec && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">This note is private and won't appear in reports.</p>
                      <textarea className="input-field text-sm" rows={2} value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus />
                      <div className="flex gap-2">
                        <button className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300"
                          disabled={busy || !noteText.trim()} onClick={() => { doAction(rec, rec.manager_outcome || 'accepted', undefined, noteText); setShowNote(false); }}>Save note</button>
                        <button className="py-2.5 px-4 rounded-xl text-sm text-gray-500 hover:bg-gray-100" onClick={() => setShowNote(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Voided section */}
      {voidedIncidents.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Voided ({voidedIncidents.length})</h3>
          <div className="space-y-1">
            {voidedIncidents.map(inc => (
              <div key={inc.id} className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-2 flex items-center gap-3 opacity-60">
                <XCircle size={14} className="text-red-400 flex-shrink-0" />
                <span className="text-sm text-gray-600 flex-1">{inc.error_types.join(', ')} {inc.drug_name && `\u2014 ${inc.drug_name}`}</span>
                <span className="text-xs text-gray-400">{new Date(inc.submitted_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Report section — at the bottom ── */}
      {activeIncidents.length > 0 && (
        <div className="mt-8 space-y-3">
          {/* Existing report indicator */}
          {existingReport && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-800">A report for this period already exists</p>
                <p className="text-xs text-blue-600 mt-0.5">Generated {new Date(existingReport.generated_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <button onClick={() => nav(`/reports/${existingReport.id}`)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5">
                <FileText size={14} /> View report
              </button>
            </div>
          )}

          {/* Generate report */}
          <div className={`rounded-xl p-5 border ${allReviewed ? 'bg-[#E1F5EE] border-[#1D9E75]' : 'bg-gray-50 border-gray-200'}`}>
            {allReviewed ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={20} className="text-[#085041]" />
                  <p className="text-sm font-bold text-[#085041]">All {activeIncidents.length} incidents reviewed</p>
                </div>
                <p className="text-xs text-[#085041]/70 mb-4">
                  {existingReport ? 'You can generate an updated report with your latest reviews.' : 'Generate the report for your team meeting and compliance file.'}
                </p>
                <button onClick={handleReport} disabled={busy}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm bg-[#0F6E56] text-white hover:bg-[#0B5A46] flex items-center justify-center gap-2">
                  <FileText size={16} /> {existingReport ? 'Generate updated report' : 'Generate report'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-500">Generate report</p>
                <p className="text-xs text-gray-400 mt-1">Review all {pendingList.length} remaining incident{pendingList.length > 1 ? 's' : ''} above before generating.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Past reports */}
      <div className="mt-6 text-center">
        <button onClick={() => nav('/reports')} className="text-sm text-gray-500 hover:text-[#0F6E56] flex items-center gap-1 mx-auto">
          <FileText size={14} /> View past reports
        </button>
      </div>

      {/* Void modal */}
      {voidId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-[#791F1F] mb-2">Void this incident</h3>
            <p className="text-sm text-gray-500 mb-3">This cannot be undone. The incident will be excluded from reports.</p>
            <textarea className="input-field" rows={3} placeholder="Reason (required)" value={voidReason} onChange={e => setVoidReason(e.target.value)} autoFocus />
            <div className="flex gap-3 mt-4">
              <button className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200" onClick={() => { setVoidId(null); setVoidReason(''); }}>Cancel</button>
              <button className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700" disabled={busy || !voidReason.trim()} onClick={doVoid}>Void incident</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
