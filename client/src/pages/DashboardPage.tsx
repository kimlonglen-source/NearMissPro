import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, AlertTriangle, Clock, ChevronDown, ChevronUp, Edit3, MessageSquare, XCircle, Loader2, FileText } from 'lucide-react';

interface Rec { id: string; ai_text: string; manager_outcome: string | null; manager_text?: string; private_note?: string; }
interface Incident {
  id: string; error_types: string[]; drug_name: string; dispensed_drug?: string;
  prescribed_strength?: string; dispensed_strength?: string; correct_formulation?: string;
  dispensed_formulation?: string; where_caught: string; time_of_day: string;
  factors: string[]; notes?: string; submitted_at: string; status: string;
  flagged_by_staff: boolean; flag_note?: string; recommendations: Rec[];
}

function dateAgo(days: number) { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); }

const PERIODS = [
  { label: 'This month', days: 30 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Custom range', days: 0 },
];

export function DashboardPage() {
  const { pharmacyName } = useAuth();
  const nav = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [patternAlert, setPatternAlert] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modText, setModText] = useState('');
  const [showMod, setShowMod] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const getFrom = () => period.days > 0 ? dateAgo(period.days) : customFrom;

  const load = async () => {
    const from = getFrom();
    if (!from) return;
    try {
      const params: Record<string, string> = { from };
      if (period.days === 0 && customTo) params.to = customTo;
      const [res, pa] = await Promise.all([
        api.getIncidents(params),
        api.getPatternAlert().catch(() => ({ alert: null })),
      ]);
      const list = (res.incidents as unknown as Incident[]).sort((a, b) => {
        const ap = isPending(a), bp = isPending(b);
        if (ap !== bp) return ap ? -1 : 1;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });
      setIncidents(list);
      setPatternAlert(pa.alert);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (period.days > 0 || (customFrom && customTo)) { setLoading(true); load(); } }, [period, customFrom, customTo]);

  const isPending = (i: Incident) => i.status === 'active' && !i.recommendations?.[0]?.manager_outcome;
  const activeIncidents = incidents.filter(i => i.status === 'active');
  const voidedIncidents = incidents.filter(i => i.status === 'voided');
  const pendingList = activeIncidents.filter(isPending);
  const reviewedList = activeIncidents.filter(i => !isPending(i));
  const allReviewed = pendingList.length === 0 && activeIncidents.length > 0;
  const step = pendingList.length > 0 ? 1 : allReviewed ? 2 : 0;

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
      const start = period.days > 0 ? dateAgo(period.days) : customFrom;
      const end = period.days > 0 ? new Date().toISOString().slice(0, 10) : customTo;
      if (!start || !end) return;
      const report = await api.generateReport({ periodStart: start, periodEnd: end, generatedBy: pharmacyName || 'Manager', isCustomRange: period.days === 0 });
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

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-[#0F6E56]" size={32} /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Review incidents</h1>
        <div className="flex items-center gap-2">
          <select className="input-field w-auto text-sm py-2" value={period.days}
            onChange={e => setPeriod(PERIODS.find(p => p.days === +e.target.value) || PERIODS[0])}>
            {PERIODS.map(p => <option key={p.days} value={p.days}>{p.label}</option>)}
          </select>
          {period.days === 0 && (
            <div className="flex items-center gap-1">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="input-field w-auto text-sm py-2" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="input-field w-auto text-sm py-2" />
            </div>
          )}
        </div>
      </div>

      {/* Pattern alert */}
      {patternAlert && (
        <div className="bg-[#FAEEDA] border border-[#BA7517] rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
          <AlertTriangle size={16} className="text-[#BA7517] mt-0.5 flex-shrink-0" />
          <p className="text-sm text-[#633806]">{patternAlert}</p>
        </div>
      )}

      {/* Guided step box */}
      <div className={`rounded-xl p-5 mb-5 border ${step === 1 ? 'bg-[#FAEEDA] border-[#BA7517]' : step === 2 ? 'bg-[#E1F5EE] border-[#1D9E75]' : 'bg-gray-50 border-gray-200'}`}>
        {activeIncidents.length === 0 ? (
          <div className="text-center py-2">
            <Clock size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No incidents recorded yet</p>
            <p className="text-xs text-gray-400 mt-1">When staff record near misses, they will appear here for you to review.</p>
          </div>
        ) : step === 1 ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-[#633806]">{pendingList.length} incident{pendingList.length > 1 ? 's' : ''} to review</p>
              <span className="text-xs text-[#633806]/60">{reviewedList.length}/{activeIncidents.length}</span>
            </div>
            <div className="w-full h-2 bg-[#BA7517]/20 rounded-full mb-3">
              <div className="h-2 bg-[#BA7517] rounded-full transition-all" style={{ width: `${(reviewedList.length / activeIncidents.length) * 100}%` }} />
            </div>
            <p className="text-xs text-[#633806]/70">Tap each incident below. Read the recommendation, then choose Accept, Modify, or No action.</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={20} className="text-[#085041]" />
              <p className="text-sm font-bold text-[#085041]">All {activeIncidents.length} incidents reviewed</p>
            </div>
            <p className="text-xs text-[#085041]/70 mb-3">Your review is complete. Generate the report for your team meeting.</p>
            <button onClick={handleReport} disabled={busy}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-[#0F6E56] text-white hover:bg-[#0B5A46] flex items-center justify-center gap-2">
              <FileText size={16} /> Generate report
            </button>
          </>
        )}
      </div>

      {/* Incident list */}
      <div className="space-y-2">
        {activeIncidents.map(inc => {
          const isOpen = activeId === inc.id;
          const outcome = getOutcome(inc);
          const rec = inc.recommendations?.[0];
          const pending = isPending(inc);

          return (
            <div key={inc.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${pending ? 'border-l-4 border-l-[#BA7517] border-t border-r border-b border-t-gray-200 border-r-gray-200 border-b-gray-200' : 'border-gray-200'}`}>
              {/* Collapsed */}
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
                    {inc.time_of_day && ` \u00B7 ${inc.time_of_day}`}
                  </p>
                </div>
                {outcomeBadge(outcome)}
                {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {/* Expanded */}
              {isOpen && (
                <div className="border-t px-4 py-4 space-y-4" onClick={e => e.stopPropagation()}>
                  {/* Details */}
                  {(inc.dispensed_drug || inc.dispensed_strength || inc.dispensed_formulation || inc.factors.length > 0 || inc.notes) && (
                    <div className="text-sm space-y-1">
                      {inc.dispensed_drug && <p className="text-gray-700"><span className="text-gray-500">Drug swap:</span> {inc.drug_name} \u2192 {inc.dispensed_drug}</p>}
                      {inc.dispensed_strength && <p className="text-gray-700"><span className="text-gray-500">Strength:</span> {inc.prescribed_strength} \u2192 {inc.dispensed_strength}</p>}
                      {inc.dispensed_formulation && <p className="text-gray-700"><span className="text-gray-500">Formulation:</span> {inc.correct_formulation} \u2192 {inc.dispensed_formulation}</p>}
                      {inc.factors.length > 0 && <p className="text-gray-700"><span className="text-gray-500">Factors:</span> {inc.factors.join(', ')}</p>}
                      {inc.notes && <p className="text-gray-500 text-xs italic">{inc.notes}</p>}
                    </div>
                  )}

                  {/* AI Recommendation */}
                  {rec && (
                    <div className="bg-[#F0FAF5] border border-[#C8E6D8] rounded-xl p-4">
                      <p className="text-xs font-bold text-[#085041] uppercase tracking-wider mb-2">Recommendation</p>
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
                          disabled={busy} onClick={() => doAction(rec, 'no_action')}>
                          No action needed
                        </button>
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
                      <p className="text-xs text-gray-500">This note is private \u2014 it won't appear in reports.</p>
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

      {/* Past reports */}
      <div className="mt-8 text-center">
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
