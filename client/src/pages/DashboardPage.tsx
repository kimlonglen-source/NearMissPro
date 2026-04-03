import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Rec { id: string; ai_text: string; manager_outcome: string | null; manager_text?: string; private_note?: string; }
interface Incident {
  id: string; error_types: string[]; drug_name: string; dispensed_drug?: string;
  prescribed_strength?: string; dispensed_strength?: string; correct_formulation?: string;
  dispensed_formulation?: string; where_caught: string; time_of_day: string;
  factors: string[]; notes?: string; submitted_at: string; status: string;
  flagged_by_staff: boolean; flag_note?: string; recommendations: Rec[];
}

const PERIODS = [
  { label: 'This month', days: 30 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 90 days', days: 90 },
];

function dateAgo(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const BADGE: Record<string, string> = {
  pending: 'badge-pending', accepted: 'badge-accepted', modified: 'badge-modified',
  no_action: 'badge-noaction', voided: 'badge-voided',
};

function statusLabel(s: string) {
  return s === 'no_action' ? 'No action' : s.charAt(0).toUpperCase() + s.slice(1);
}

function smartSort(a: Incident, b: Incident) {
  if (a.flagged_by_staff !== b.flagged_by_staff) return a.flagged_by_staff ? -1 : 1;
  const ap = a.status === 'pending', bp = b.status === 'pending';
  if (ap !== bp) return ap ? -1 : 1;
  return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
}

export function DashboardPage() {
  const { pharmacyName } = useAuth();
  const nav = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [quickMode, setQuickMode] = useState(false);
  const [quickIdx, setQuickIdx] = useState(0);
  const [patternAlert, setPatternAlert] = useState<string | null>(null);
  const [modText, setModText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [voidModal, setVoidModal] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [res, pa] = await Promise.all([
      api.getIncidents({ from: dateAgo(period.days) }),
      api.getPatternAlert(),
    ]);
    const list = (res.incidents as unknown as Incident[]).sort(smartSort);
    setIncidents(list); setTotal(res.total); setPatternAlert(pa.alert);
  };

  useEffect(() => { load(); }, [period]);

  const pending = incidents.filter(i => i.status === 'pending');
  const reviewed = incidents.filter(i => i.status !== 'pending');
  const filtered = filter === 'pending' ? pending : filter === 'reviewed' ? reviewed : incidents;
  const reviewedCount = reviewed.length;
  const prevPeriodPct = total > 0 ? Math.round(((incidents.length - total) / total) * 100) : 0;
  const peakTime = incidents.length ? (() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => { counts[i.time_of_day] = (counts[i.time_of_day] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  })() : '-';
  const allReviewed = pending.length === 0 && incidents.length > 0;

  const doAction = async (rec: Rec, outcome: string, text?: string, note?: string) => {
    setBusy(true);
    try {
      await api.actionRecommendation(rec.id, {
        managerOutcome: outcome, managerText: text, privateNote: note,
      });
      await load(); setModText(''); setNoteText('');
    } finally { setBusy(false); }
  };

  const doVoid = async () => {
    if (!voidModal || !voidReason.trim()) return;
    setBusy(true);
    try {
      await api.voidIncident(voidModal, voidReason.trim());
      await load(); setVoidModal(null); setVoidReason('');
    } finally { setBusy(false); }
  };

  const handleReport = async () => {
    const start = dateAgo(period.days);
    const end = new Date().toISOString().slice(0, 10);
    await api.generateReport({ periodStart: start, periodEnd: end, generatedBy: pharmacyName || 'Manager' });
    nav('/reports');
  };

  // Quick review mode
  const quickList = pending;
  const quickInc = quickList[quickIdx];

  if (quickMode && quickInc) {
    const rec = quickInc.recommendations[0];
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Quick Review</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{quickIdx + 1} of {quickList.length}</span>
            <div className="w-40 h-2 bg-gray-200 rounded-full">
              <div className="h-2 bg-[#0F6E56] rounded-full" style={{ width: `${((quickIdx + 1) / quickList.length) * 100}%` }} />
            </div>
            <button className="btn-grey" onClick={() => setQuickMode(false)}>Exit</button>
          </div>
        </div>
        <IncidentDetail inc={quickInc} />
        {rec && (
          <div className="bg-gray-100 rounded-xl p-4 my-4">
            <p className="text-sm font-semibold mb-1">AI Recommendation</p>
            <p className="text-sm text-gray-700">{rec.ai_text}</p>
          </div>
        )}
        <div className="flex gap-3 mt-4 flex-wrap">
          {rec && <>
            <button className="btn-teal text-base px-8 py-4" disabled={busy} onClick={() => doAction(rec, 'accepted')}>Accept</button>
            <button className="btn-grey text-base px-8 py-4" disabled={busy} onClick={() => doAction(rec, 'no_action')}>No Action</button>
            <button className="btn-red text-base px-8 py-4" onClick={() => setVoidModal(quickInc.id)}>Void</button>
          </>}
          <button className="btn-grey text-base px-8 py-4" onClick={() => setQuickIdx(i => Math.min(i + 1, quickList.length - 1))}>Skip</button>
        </div>
        <div className="flex gap-3 mt-3">
          <button className="btn-outline" disabled={quickIdx === 0} onClick={() => setQuickIdx(i => i - 1)}>Prev</button>
          <button className="btn-outline" disabled={quickIdx >= quickList.length - 1} onClick={() => setQuickIdx(i => i + 1)}>Next</button>
        </div>
        {voidModal && <VoidModal reason={voidReason} setReason={setVoidReason} onConfirm={doVoid} onCancel={() => { setVoidModal(null); setVoidReason(''); }} busy={busy} />}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{pharmacyName || 'Dashboard'}</h1>
        <select className="input-field w-auto" value={period.days} onChange={e => setPeriod(PERIODS.find(p => p.days === +e.target.value) || PERIODS[0])}>
          {PERIODS.map(p => <option key={p.days} value={p.days}>{p.label}</option>)}
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Incidents" value={incidents.length} />
        <StatCard label="Reviewed" value={reviewedCount} />
        <StatCard label="vs Last Period" value={`${prevPeriodPct >= 0 ? '+' : ''}${prevPeriodPct}%`} />
        <StatCard label="Peak Risk Time" value={peakTime} />
      </div>

      {patternAlert && (
        <div className="bg-[#FAEEDA] border border-[#BA7517] rounded-xl px-4 py-3 mb-6 text-sm text-[#633806] font-medium">
          Pattern detected: {patternAlert}
        </div>
      )}

      <div className="flex gap-6">
        {/* Left column: incident list */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {(['all', 'pending', 'reviewed'] as const).map(f => {
              const count = f === 'all' ? incidents.length : f === 'pending' ? pending.length : reviewedCount;
              const active = filter === f;
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className={`chip ${active ? 'chip-green' : 'chip-off'}`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                </button>
              );
            })}
            {pending.length > 0 && (
              <button className="btn-outline ml-auto text-xs" onClick={() => { setQuickMode(true); setQuickIdx(0); }}>
                Quick Review
              </button>
            )}
          </div>

          <div className="space-y-3">
            {filtered.map(inc => (
              <div key={inc.id}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden cursor-pointer transition-all hover:shadow-md
                  ${inc.flagged_by_staff ? 'border-t-4 border-t-[#BA7517]' : 'border-gray-200'}`}
                onClick={() => setExpanded(expanded === inc.id ? null : inc.id)}>
                <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  {inc.flagged_by_staff && <span className="text-[#BA7517] text-xs font-bold">FLAG</span>}
                  <span className="font-semibold text-sm">{inc.error_types.join(', ')}</span>
                  <span className="bg-[#E6F1FB] text-[#0C447C] text-xs px-2 py-0.5 rounded-full font-medium">{inc.drug_name}</span>
                  <span className="text-xs text-gray-500 ml-auto">{new Date(inc.submitted_at).toLocaleDateString()} {inc.time_of_day}</span>
                  <span className="text-xs text-gray-500">Caught: {inc.where_caught}</span>
                  <span className={`badge ${BADGE[inc.status] || 'badge-pending'}`}>{statusLabel(inc.status)}</span>
                </div>

                {expanded === inc.id && (
                  <div className="border-t px-4 py-4" onClick={e => e.stopPropagation()}>
                    <IncidentDetail inc={inc} />
                    {inc.recommendations[0] && (
                      <>
                        <div className="bg-gray-100 rounded-xl p-4 my-3">
                          <p className="text-xs font-semibold text-gray-500 mb-1">AI Recommendation</p>
                          <p className="text-sm text-gray-700">{inc.recommendations[0].ai_text}</p>
                          {inc.recommendations[0].manager_outcome && (
                            <p className="text-xs text-gray-500 mt-2">
                              Outcome: <span className="font-semibold">{statusLabel(inc.recommendations[0].manager_outcome)}</span>
                              {inc.recommendations[0].manager_text && ` — ${inc.recommendations[0].manager_text}`}
                            </p>
                          )}
                        </div>
                        {inc.status === 'pending' && (
                          <ActionButtons rec={inc.recommendations[0]} incId={inc.id}
                            busy={busy} modText={modText} setModText={setModText}
                            noteText={noteText} setNoteText={setNoteText}
                            onAction={doAction} onVoid={() => setVoidModal(inc.id)} />
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No incidents found.</p>}
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="w-72 shrink-0 hidden lg:block space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-semibold mb-2">Review Progress</p>
            <p className="text-2xl font-bold text-[#0F6E56]">{reviewedCount} <span className="text-base font-normal text-gray-500">of {incidents.length} reviewed</span></p>
            <div className="w-full h-2 bg-gray-200 rounded-full mt-3">
              <div className="h-2 bg-[#0F6E56] rounded-full transition-all" style={{ width: incidents.length ? `${(reviewedCount / incidents.length) * 100}%` : '0%' }} />
            </div>
          </div>
          <button className="btn-teal w-full" disabled={!allReviewed} onClick={handleReport}>
            {allReviewed ? 'Generate Report' : `Review ${pending.length} remaining`}
          </button>
          {pending.length > 0 && (
            <button className="btn-outline w-full text-xs" onClick={() => { setQuickMode(true); setQuickIdx(0); }}>
              Quick Review Mode
            </button>
          )}
        </aside>
      </div>

      {voidModal && <VoidModal reason={voidReason} setReason={setVoidReason} onConfirm={doVoid} onCancel={() => { setVoidModal(null); setVoidReason(''); }} busy={busy} />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function IncidentDetail({ inc }: { inc: Incident }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
      <Detail label="Drug name" value={inc.drug_name} />
      {inc.dispensed_drug && <Detail label="Dispensed drug" value={inc.dispensed_drug} />}
      {inc.prescribed_strength && <Detail label="Prescribed strength" value={inc.prescribed_strength} />}
      {inc.dispensed_strength && <Detail label="Dispensed strength" value={inc.dispensed_strength} />}
      {inc.correct_formulation && <Detail label="Correct formulation" value={inc.correct_formulation} />}
      {inc.dispensed_formulation && <Detail label="Dispensed formulation" value={inc.dispensed_formulation} />}
      <Detail label="Where caught" value={inc.where_caught} />
      <Detail label="Time of day" value={inc.time_of_day} />
      {inc.factors.length > 0 && <Detail label="Factors" value={inc.factors.join(', ')} />}
      {inc.notes && <Detail label="Notes" value={inc.notes} />}
      {inc.flag_note && <Detail label="Flag note" value={inc.flag_note} />}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}:</span>{' '}
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ActionButtons({ rec, incId, busy, modText, setModText, noteText, setNoteText, onAction, onVoid }: {
  rec: Rec; incId: string; busy: boolean;
  modText: string; setModText: (v: string) => void;
  noteText: string; setNoteText: (v: string) => void;
  onAction: (rec: Rec, outcome: string, text?: string, note?: string) => void;
  onVoid: () => void;
}) {
  const [showMod, setShowMod] = useState(false);
  const [showNote, setShowNote] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button className="btn-teal" disabled={busy} onClick={() => onAction(rec, 'accepted')}>Accept</button>
        <button className="btn-purple" disabled={busy} onClick={() => setShowMod(!showMod)}>Modify</button>
        <button className="btn-grey" disabled={busy} onClick={() => onAction(rec, 'no_action')}>No Action</button>
        <button className="btn-red" disabled={busy} onClick={onVoid}>Void</button>
        <button className="btn-outline text-xs" onClick={() => setShowNote(!showNote)}>Add Note</button>
      </div>
      {showMod && (
        <div className="space-y-2">
          <textarea className="input-field bg-[#EEEDFE] text-[#3C3489]" rows={2} placeholder="Modified recommendation..."
            value={modText} onChange={e => setModText(e.target.value)} />
          <button className="btn-purple text-xs" disabled={busy || !modText.trim()}
            onClick={() => { onAction(rec, 'modified', modText); setShowMod(false); }}>Save Modification</button>
        </div>
      )}
      {showNote && (
        <div className="space-y-2">
          <textarea className="input-field" rows={2} placeholder="Private note (not included in reports)..."
            value={noteText} onChange={e => setNoteText(e.target.value)} />
          <button className="btn-outline text-xs" disabled={busy || !noteText.trim()}
            onClick={() => { onAction(rec, rec.manager_outcome || 'accepted', undefined, noteText); setShowNote(false); }}>Save Note</button>
        </div>
      )}
    </div>
  );
}

function VoidModal({ reason, setReason, onConfirm, onCancel, busy }: {
  reason: string; setReason: (v: string) => void;
  onConfirm: () => void; onCancel: () => void; busy: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-[#791F1F] mb-3">Void Incident</h3>
        <p className="text-sm text-gray-600 mb-3">This action cannot be undone. Please provide a mandatory reason.</p>
        <textarea className="input-field" rows={3} placeholder="Reason for voiding..."
          value={reason} onChange={e => setReason(e.target.value)} />
        <div className="flex gap-3 mt-4 justify-end">
          <button className="btn-grey" onClick={onCancel}>Cancel</button>
          <button className="btn-red" disabled={busy || !reason.trim()} onClick={onConfirm}>Confirm Void</button>
        </div>
      </div>
    </div>
  );
}
