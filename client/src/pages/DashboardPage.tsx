import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, AlertTriangle, Clock, ChevronDown, ChevronUp, Edit3, MessageSquare, XCircle, ArrowRight, ArrowLeft, Loader2, FileText } from 'lucide-react';

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
  const pendingList = incidents.filter(isPending);
  const reviewedList = incidents.filter(i => !isPending(i));
  const allReviewed = pendingList.length === 0 && incidents.length > 0;

  const peakTime = (() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => { if (i.time_of_day) counts[i.time_of_day] = (counts[i.time_of_day] || 0) + 1; });
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
    const map: Record<string, { cls: string; label: string }> = {
      accepted: { cls: 'bg-[#E1F5EE] text-[#085041]', label: '\u2713 Accepted' },
      modified: { cls: 'bg-[#EEEDFE] text-[#3C3489]', label: '\u2713 Modified' },
      no_action: { cls: 'bg-gray-100 text-gray-600', label: '\u2713 No action' },
      voided: { cls: 'bg-[#FCEBEB] text-[#791F1F]', label: 'Voided' },
    };
    const d = outcome ? map[outcome] : null;
    if (!d) return <span className="bg-[#FAEEDA] text-[#633806] text-xs font-semibold px-2 py-0.5 rounded-full">\u25CB Pending</span>;
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.cls}`}>{d.label}</span>;
  };

  const drugLabel = (i: Incident) => {
    if (i.dispensed_drug) return `${i.drug_name} \u2192 ${i.dispensed_drug}`;
    if (i.dispensed_strength) return `${i.drug_name} ${i.prescribed_strength} \u2192 ${i.dispensed_strength}`;
    if (i.dispensed_formulation) return `${i.drug_name} ${i.correct_formulation} \u2192 ${i.dispensed_formulation}`;
    return i.drug_name;
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-[#0F6E56]" size={32} /></div>;

  // ── Step indicator ──
  const step = pendingList.length > 0 ? 1 : allReviewed ? 2 : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-xs text-gray-500">{pharmacyName}</p>
        </div>
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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="text-xl font-bold">{incidents.length}</div>
          <div className="text-[11px] text-gray-500">Total</div>
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

      {/* ── Guided instruction box ── */}
      <div className={`rounded-xl p-4 mb-4 border ${step === 1 ? 'bg-[#FAEEDA] border-[#BA7517]' : step === 2 ? 'bg-[#E1F5EE] border-[#1D9E75]' : 'bg-gray-50 border-gray-200'}`}>
        {incidents.length === 0 ? (
          <div className="text-center py-4">
            <Clock size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No incidents recorded this period</p>
            <p className="text-xs text-gray-400 mt-1">Share the pharmacy login with your team to start recording near misses.</p>
          </div>
        ) : step === 1 ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#633806]">Step 1: Review {pendingList.length} pending incident{pendingList.length > 1 ? 's' : ''}</p>
              <p className="text-xs text-[#633806]/70 mt-0.5">Click each incident below to read the AI recommendation, then Accept, Modify, or take No action.</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#633806]/60 mb-1">{reviewedList.length}/{incidents.length} done</div>
              <div className="w-24 h-2 bg-[#BA7517]/20 rounded-full">
                <div className="h-2 bg-[#BA7517] rounded-full transition-all" style={{ width: `${(reviewedList.length / incidents.length) * 100}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#085041]"><CheckCircle2 size={16} className="inline mr-1" />All incidents reviewed</p>
              <p className="text-xs text-[#085041]/70 mt-0.5">Step 2: Generate the report for your team meeting and compliance file.</p>
            </div>
            <button onClick={handleReport} disabled={busy} className="btn-teal text-sm">
              <FileText size={16} /> Generate report
            </button>
          </div>
        )}
      </div>

      {/* ── Incident list ── */}
      <div className="space-y-2">
        {incidents.map(inc => {
          const isOpen = activeId === inc.id;
          const outcome = getOutcome(inc);
          const rec = inc.recommendations?.[0];
          const pending = isPending(inc);

          return (
            <div key={inc.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${pending ? 'border-[#BA7517]/30 shadow-sm' : 'border-gray-200'}`}>
              {/* Collapsed row */}
              <button className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                onClick={() => { setActiveId(isOpen ? null : inc.id); setShowMod(false); setShowNote(false); }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{inc.error_types.join(', ')}</span>
                    {inc.drug_name && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{drugLabel(inc)}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span>{new Date(inc.submitted_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</span>
                    {inc.where_caught && <span>{inc.where_caught}</span>}
                  </div>
                </div>
                {outcomeBadge(outcome)}
                {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {/* Expanded */}
              {isOpen && (
                <div className="border-t px-4 py-4 space-y-3" onClick={e => e.stopPropagation()}>
                  {/* Incident details */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {inc.dispensed_drug && <div><span className="text-gray-500">Drug swap:</span> <span className="font-medium">{inc.drug_name} \u2192 {inc.dispensed_drug}</span></div>}
                    {inc.dispensed_strength && <div><span className="text-gray-500">Strength:</span> <span className="font-medium">{inc.prescribed_strength} \u2192 {inc.dispensed_strength}</span></div>}
                    {inc.dispensed_formulation && <div><span className="text-gray-500">Formulation:</span> <span className="font-medium">{inc.correct_formulation} \u2192 {inc.dispensed_formulation}</span></div>}
                    {inc.time_of_day && <div><span className="text-gray-500">Time:</span> <span className="font-medium">{inc.time_of_day}</span></div>}
                    {inc.factors.length > 0 && <div className="col-span-2"><span className="text-gray-500">Factors:</span> <span className="font-medium">{inc.factors.join(', ')}</span></div>}
                    {inc.notes && <div className="col-span-2 text-xs text-gray-500 italic">{inc.notes}</div>}
                  </div>

                  {/* AI recommendation */}
                  {rec && (
                    <div className="bg-[#F0FAF5] border border-[#C8E6D8] rounded-lg p-3">
                      <p className="text-[11px] font-semibold text-[#085041] uppercase tracking-wider mb-1">AI Recommendation</p>
                      <p className="text-sm text-gray-800 leading-relaxed">{rec.ai_text}</p>
                      {rec.manager_outcome === 'modified' && rec.manager_text && (
                        <div className="mt-2 pt-2 border-t border-[#C8E6D8]">
                          <p className="text-[11px] font-semibold text-[#3C3489]">Your version:</p>
                          <p className="text-sm text-gray-800">{rec.manager_text}</p>
                        </div>
                      )}
                      {rec.private_note && (
                        <div className="mt-2 pt-2 border-t border-[#C8E6D8]">
                          <p className="text-[11px] text-gray-500"><MessageSquare size={10} className="inline mr-1" />Private note: {rec.private_note}</p>
                        </div>
                      )}
                      <p className="text-[9px] text-gray-400 mt-2 italic">Advisory only \u2014 the pharmacist-in-charge makes all decisions.</p>
                    </div>
                  )}

                  {/* Action buttons \u2014 show on all non-voided */}
                  {inc.status !== 'voided' && rec && !showMod && !showNote && (
                    <div>
                      {pending && <p className="text-xs text-gray-500 mb-2">Choose an action for this incident:</p>}
                      <div className="flex gap-2 flex-wrap">
                        <button className="btn-teal text-xs" disabled={busy} onClick={() => doAction(rec, 'accepted')}>
                          <CheckCircle2 size={14} /> Accept
                        </button>
                        <button className="btn text-xs bg-[#EEEDFE] text-[#3C3489] hover:bg-[#E0DEFE]" onClick={() => { setShowMod(true); setModText(rec.manager_text || rec.ai_text); }}>
                          <Edit3 size={14} /> Modify
                        </button>
                        <button className="btn-grey text-xs" disabled={busy} onClick={() => doAction(rec, 'no_action')}>No action</button>
                        <button className="btn text-xs bg-red-50 text-red-700 hover:bg-red-100" onClick={() => setVoidId(inc.id)}>
                          <XCircle size={14} /> Void
                        </button>
                        <button className="btn-outline text-xs" onClick={() => { setShowNote(true); setNoteText(rec.private_note || ''); }}>
                          <MessageSquare size={14} /> Note
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
                        <button className="btn text-xs bg-[#7F77DD] text-white" disabled={busy || !modText.trim()}
                          onClick={() => doAction(rec, 'modified', modText)}>Save modification</button>
                        <button className="text-xs text-gray-500 hover:underline" onClick={() => setShowMod(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Note inline */}
                  {showNote && activeId === inc.id && rec && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Private note \u2014 only visible here, not in reports:</p>
                      <textarea className="input-field text-sm" rows={2} value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus />
                      <div className="flex gap-2">
                        <button className="btn-outline text-xs" disabled={busy || !noteText.trim()}
                          onClick={() => { doAction(rec, rec.manager_outcome || 'accepted', undefined, noteText); setShowNote(false); }}>Save note</button>
                        <button className="text-xs text-gray-500 hover:underline" onClick={() => setShowNote(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Voided */}
                  {inc.status === 'voided' && (
                    <div className="flex items-center gap-2 text-xs text-red-600">
                      <XCircle size={14} /> This incident has been voided
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {incidents.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">No incidents for this period.</div>
        )}
      </div>

      {/* Past reports link */}
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
            <p className="text-sm text-gray-500 mb-3">This cannot be undone. The incident will be excluded from reports but remain in the system.</p>
            <textarea className="input-field" rows={3} placeholder="Reason (required)" value={voidReason} onChange={e => setVoidReason(e.target.value)} autoFocus />
            <div className="flex gap-3 mt-4 justify-end">
              <button className="btn-grey text-sm" onClick={() => { setVoidId(null); setVoidReason(''); }}>Cancel</button>
              <button className="btn-red text-sm" disabled={busy || !voidReason.trim()} onClick={doVoid}>Void incident</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
