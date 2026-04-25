import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ShieldIcon } from '../components/Logo';
import { Printer, Mail, Save, Plus, Loader2, ArrowLeft, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';

interface Incident {
  id: string; error_types: string[]; drug_name?: string; dispensed_drug?: string;
  prescribed_strength?: string; dispensed_strength?: string; correct_formulation?: string; dispensed_formulation?: string;
  where_caught?: string; time_of_day?: string; factors: string[]; notes?: string;
  submitted_at: string; occurred_at?: string; status: string;
  recommendations?: { ai_text: string; manager_outcome?: string; manager_text?: string; private_note?: string }[];
}
interface Report {
  id: string; period_start: string; period_end: string; generated_by: string; generated_at: string; locked: boolean;
  previous_period_summary?: string; period_summary?: string; agenda_items: { text: string; edited: boolean }[];
  pattern_alerts?: { drug: string; errorType: string; count: number }[];
  trend_data?: { weekStart: string; count: number }[];
}
interface AckRow { name: string; role: string; initials: string; date: string; }

export function ReportPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { pharmacyName } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [_editing] = useState(true); // Always editable
  const [prevSummary, setPrevSummary] = useState('');
  const [periodSummary, setPeriodSummary] = useState('');
  const [agenda, setAgenda] = useState<{ text: string; edited: boolean }[]>([]);
  const [prevEdited, setPrevEdited] = useState(false);
  const [summaryEdited, setSummaryEdited] = useState(false);
  const [agendaEdited, setAgendaEdited] = useState(false);
  const [ackRows, setAckRows] = useState<AckRow[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getReport(id).then((r: unknown) => {
        const rpt = r as Report;
        setReport(rpt);
        setPrevSummary(rpt.previous_period_summary || '');
        setPeriodSummary(rpt.period_summary || '');
        setAgenda(rpt.agenda_items || []);
        setAckRows([
          { name: rpt.generated_by || '', role: 'Pharmacist-in-charge', initials: '', date: '' },
          ...Array(5).fill(null).map(() => ({ name: '', role: '', initials: '', date: '' })),
        ]);
        // Load only active incidents (exclude voided)
        return api.getIncidents({ from: rpt.period_start, to: rpt.period_end, status: 'active' });
      }).then((d: { incidents: unknown[] }) => setIncidents(d.incidents as Incident[])),
    ]).finally(() => setLoading(false));
  }, [id]);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveEdits = async () => {
    if (!report || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await api.updateReport(report.id, {
        previous_period_summary: prevSummary,
        period_summary: periodSummary,
        agenda_items: agenda,
      });
      // Clear the "edited" flags so the Save button disappears, and refresh
      // local state so a second edit-then-save cycle starts clean.
      setPrevEdited(false); setSummaryEdited(false); setAgendaEdited(false);
      setReport({ ...report, previous_period_summary: prevSummary, period_summary: periodSummary, agenda_items: agenda });
      setSaveState('saved');
      setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState(s => (s === 'error' ? 'idle' : s)), 4000);
    }
  };

  const toggleCompleted = async () => {
    if (!report) return;
    const next = !report.locked;
    await api.updateReport(report.id, { locked: next });
    setReport({ ...report, locked: next });
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-[#0F6E56]" size={32} /></div>;
  if (!report) return <div className="text-center py-12 text-gray-500">Report not found</div>;

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });

  // Compute stats from loaded incidents
  const activeIncidents = incidents.filter(i => i.status === 'active');
  const actionsCount = activeIncidents.filter(i => i.recommendations?.[0]?.manager_outcome && i.recommendations[0].manager_outcome !== 'no_action').length;
  const peakTime = (() => {
    const counts: Record<string, number> = {};
    activeIncidents.forEach(i => { if (i.time_of_day) counts[i.time_of_day] = (counts[i.time_of_day] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : '-';
  })();

  const EditBadge = () => <span className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-[#EEEDFE] text-[#3C3489] font-semibold no-print">Edited by manager</span>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview bar */}
      <div className="no-print sticky top-[53px] z-40 bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => nav('/reports')} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex-1" />
        {((prevEdited || summaryEdited || agendaEdited) || saveState === 'saved' || saveState === 'error') && (
          <button
            onClick={saveEdits}
            disabled={saveState === 'saving' || saveState === 'saved'}
            className={`btn text-sm ${saveState === 'saved' ? 'bg-[#1D9E75] text-white' : saveState === 'error' ? 'bg-red-600 text-white' : 'bg-[#0F6E56] text-white'} disabled:opacity-90`}>
            {saveState === 'saving' ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : saveState === 'saved' ? <><CheckCircle2 size={14} /> Saved</>
              : saveState === 'error' ? <><AlertTriangle size={14} /> Save failed — retry</>
              : <><Save size={14} /> Save changes</>}
          </button>
        )}
        {report.locked ? (
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
            <CheckCircle2 size={12} /> Completed
          </span>
        ) : (
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-[#FAEEDA] text-[#633806]">
            Pending review
          </span>
        )}
        <button onClick={toggleCompleted}
          className={`btn text-sm ${report.locked ? 'bg-gray-50 text-gray-700 border border-gray-200' : 'bg-[#0F6E56] text-white'}`}>
          {report.locked ? <><RotateCcw size={14} /> Re-open</> : <><CheckCircle2 size={14} /> Mark completed</>}
        </button>
        <button onClick={() => { if (id) { api.emailReport(id); alert('Email logged to console'); } }}
          className="btn text-sm bg-gray-50 text-gray-700 border border-gray-200"><Mail size={14} /> Email PDF</button>
        <button onClick={() => window.print()} className="btn text-sm bg-gray-50 text-gray-700 border border-gray-200">
          <Printer size={14} /> Print report
        </button>
      </div>

      {/* Report content */}
      <div className="max-w-4xl mx-auto px-6 py-8 bg-white my-4 shadow-sm rounded-xl print:shadow-none print:my-0 print:rounded-none">

        {/* 1. Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <ShieldIcon size={36} />
            <div>
              <div className="text-lg font-bold"><span className="text-[#0F6E56]">NearMiss</span> <span className="text-[#1A1A1A]">Pro</span></div>
              <div className="text-xs text-gray-500">Near miss quality improvement report</div>
            </div>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p className="font-semibold text-gray-900">{pharmacyName}</p>
            <p>Reviewed by: {report.generated_by}</p>
            <p>{fmtDate(report.period_start)} — {fmtDate(report.period_end)}</p>
            <p>Generated: {fmtDate(report.generated_at)}</p>
          </div>
        </div>
        <div className="h-[2px] bg-[#0F6E56] mb-6" />

        {/* 2. Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total incidents', value: activeIncidents.length },
            { label: 'Actions taken', value: actionsCount },
            { label: 'Reviewed', value: activeIncidents.filter(i => i.recommendations?.[0]?.manager_outcome).length },
            { label: 'Peak risk time', value: peakTime },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
              <div className="text-lg font-bold text-gray-900">{s.value}</div>
              <div className="text-[11px] text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 2b. Pattern alerts — drug + error-type hotspots in this period */}
        {report.pattern_alerts && report.pattern_alerts.length > 0 && (
          <div className="rounded-xl p-4 mb-6 border-2 border-[#BA7517]" style={{ background: '#FDF8EB' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#BA7517]" />
              <span className="text-xs font-semibold uppercase text-gray-600">Pattern alerts</span>
            </div>
            <ul className="space-y-3">
              {report.pattern_alerts.map((p, i) => (
                <PatternAlertRow key={i} drug={p.drug} errorType={p.errorType} count={p.count} />
              ))}
            </ul>
            <p className="text-[11px] text-[#633806]/70 mt-3">Discuss a specific prevention action for each at the team meeting.</p>
          </div>
        )}

        {/* 2c. Trend chart — weekly incidents over the reporting period */}
        {report.trend_data && report.trend_data.length > 0 && (
          <ReportTrendChart data={report.trend_data} />
        )}

        {/* 3. Previous period improvements */}
        {prevSummary && (
          <div className={`rounded-xl p-4 mb-6 ${!report.locked ? 'border-2 border-[#1D9E75]' : 'border border-[#9FE1CB]'}`} style={{ background: '#F0FAF5' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#1D9E75]" />
              <span className="text-xs font-semibold uppercase text-gray-600">Last period improvements</span>
              {prevEdited && <EditBadge />}
            </div>
            {!report.locked ? (
              <textarea value={prevSummary} onChange={e => { setPrevSummary(e.target.value); setPrevEdited(true); }}
                rows={3} className="w-full p-2 rounded-lg border border-[#9FE1CB] text-sm bg-white" />
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{prevSummary}</p>
            )}
          </div>
        )}

        {/* 4. Incident log */}
        <h3 className="text-lg font-bold mb-3">Incident log</h3>
        {activeIncidents.length === 0 ? (
          <p className="text-sm text-gray-400 mb-6">No active incidents in this period.</p>
        ) : (
          <div className="space-y-3 mb-6">
            {activeIncidents.map(inc => {
              const rec = inc.recommendations?.[0];
              const outcome = rec?.manager_outcome;
              return (
                <div key={inc.id} className="border border-gray-200 rounded-xl p-4">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {inc.error_types.map(e => (
                      <span key={e} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{e}</span>
                    ))}
                    {inc.drug_name && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{inc.drug_name}</span>
                    )}
                    {/* Tick for reviewed */}
                    {outcome && (
                      <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${outcome === 'accepted' ? 'bg-[#E1F5EE] text-[#085041]' : outcome === 'modified' ? 'bg-[#EEEDFE] text-[#3C3489]' : 'bg-gray-100 text-gray-600'}`}>
                        {outcome === 'accepted' ? '\u2713 Accepted' : outcome === 'modified' ? '\u2713 Modified' : '\u2713 No action'}
                      </span>
                    )}
                  </div>

                  {/* Detail grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500 mb-3">
                    <div>Date: {fmtDate(inc.occurred_at || inc.submitted_at)}</div>
                    <div>Caught: {inc.where_caught || '-'}</div>
                    <div>Time: {inc.time_of_day || '-'}</div>
                    <div>Factors: {inc.factors.join(', ') || '-'}</div>
                  </div>

                  {/* Swap details */}
                  {inc.dispensed_drug && <p className="text-xs text-gray-600 mb-1">Drug swap: {inc.drug_name} → {inc.dispensed_drug}</p>}
                  {inc.dispensed_strength && <p className="text-xs text-gray-600 mb-1">Strength: {inc.prescribed_strength} → {inc.dispensed_strength}</p>}
                  {inc.dispensed_formulation && <p className="text-xs text-gray-600 mb-1">Formulation: {inc.correct_formulation} → {inc.dispensed_formulation}</p>}

                  {/* Recommendation */}
                  {rec && (
                    <div className="bg-gray-50 rounded-lg p-3 mt-2">
                      <div className="text-xs font-semibold text-gray-600 mb-1">
                        {outcome === 'modified' ? 'Recommendation \u2014 modified by pharmacist-in-charge' : outcome === 'accepted' ? 'Recommendation accepted' : outcome === 'no_action' ? 'No change needed' : 'Recommendation'}
                      </div>
                      {outcome === 'modified' && rec.manager_text ? (
                        <>
                          <p className="text-sm text-gray-800">{rec.manager_text}</p>
                          <p className="text-sm text-gray-400 line-through mt-1">{rec.ai_text}</p>
                          <p className="text-[10px] text-gray-400 italic mt-0.5">Modified from AI suggestion</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-800">{rec.ai_text}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Period summary */}
        <div className={`rounded-xl p-4 mb-6 ${!report.locked ? 'border-2 border-[#1D9E75]' : 'border border-[#C8E6D8]'}`} style={{ background: '#F8FAF8' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase text-gray-600">Period summary</span>
            {summaryEdited && <EditBadge />}
          </div>
          {!report.locked ? (
            <textarea value={periodSummary} onChange={e => { setPeriodSummary(e.target.value); setSummaryEdited(true); }}
              rows={4} className="w-full p-2 rounded-lg border border-[#C8E6D8] text-sm bg-white" />
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{periodSummary || 'No summary generated.'}</p>
          )}
        </div>

        {/* 6. Staff meeting agenda */}
        <h3 className="text-lg font-bold mb-3">
          Staff meeting agenda
          {agendaEdited && <EditBadge />}
        </h3>
        <ol className="list-decimal list-inside space-y-2 mb-6">
          {agenda.map((item, i) => (
            <li key={i} className="text-sm">
              {!report.locked ? (
                <input type="text" value={item.text} className="input-field inline-block w-[calc(100%-2rem)] text-sm"
                  onChange={e => {
                    const next = [...agenda]; next[i] = { text: e.target.value, edited: true };
                    setAgenda(next); setAgendaEdited(true);
                  }} />
              ) : (
                <span>{item.text}</span>
              )}
            </li>
          ))}
        </ol>
        {!report.locked && (
          <button onClick={() => { setAgenda([...agenda, { text: '', edited: true }]); setAgendaEdited(true); }}
            className="btn-outline text-xs mb-6 no-print"><Plus size={12} /> Add item</button>
        )}

        {/* 7. Staff acknowledgement table */}
        <h3 className="text-lg font-bold mb-1">Staff acknowledgement</h3>
        <p className="text-xs text-gray-500 mb-3">I confirm I have attended the near miss review meeting and have read and understood the incidents and actions in this report.</p>
        <table className="w-full border-collapse text-sm mb-4">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-3 py-2 text-left font-medium">Staff name</th>
              <th className="border border-gray-200 px-3 py-2 text-left font-medium">Role</th>
              <th className="border border-gray-200 px-3 py-2 text-left font-medium">Initials</th>
              <th className="border border-gray-200 px-3 py-2 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {ackRows.map((row, i) => (
              <tr key={i}>
                <td className="border border-gray-200 px-3 py-2">{row.name || '\u00A0'}</td>
                <td className="border border-gray-200 px-3 py-2">{row.role || '\u00A0'}</td>
                <td className="border border-gray-200 px-3 py-2">{'\u00A0'}</td>
                <td className="border border-gray-200 px-3 py-2">{'\u00A0'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!report.locked && (
          <button onClick={() => setAckRows([...ackRows, { name: '', role: '', initials: '', date: '' }])}
            className="btn-outline text-xs mb-6 no-print"><Plus size={12} /> Add row</button>
        )}

        {/* 8. PIC Signature */}
        <div className="grid grid-cols-2 gap-12 mt-8 mb-8">
          <div>
            <div className="border-b border-gray-400 mb-2 h-12" />
            <div className="text-sm font-medium">{report.generated_by}</div>
            <div className="text-xs text-gray-500">Pharmacist-in-charge</div>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-2 h-12" />
            <div className="text-sm font-medium">Date</div>
          </div>
        </div>

        {/* 9. Footer */}
        <div className="border-t pt-4 text-xs text-gray-400 text-center">
          NearMiss Pro · {pharmacyName} · {fmtDate(report.period_start)} — {fmtDate(report.period_end)}
          <br />AI recommendations are advisory only. The pharmacist-in-charge is responsible for all professional decisions.
        </div>
      </div>
    </div>
  );
}

// ── Pattern alert row — fetches its own intervention timeline ───────
// Each hotspot has a shared intervention log (pattern_interventions table).
// The row renders the list inline so the team sees "what we've tried" next
// to "how often it's happening" when reviewing the report.
function PatternAlertRow({ drug, errorType, count }: { drug: string; errorType: string; count: number }) {
  interface Intervention { id: string; note: string; created_at: string; }
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  useEffect(() => {
    let cancelled = false;
    api.listInterventions(drug, errorType)
      .then(r => { if (!cancelled) setInterventions(r.interventions); })
      .catch(() => { /* empty list is fine */ });
    return () => { cancelled = true; };
  }, [drug, errorType]);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  return (
    <li className="text-sm text-[#633806] leading-snug">
      <div>
        <span className="font-semibold">{drug}</span> with "<span className="italic">{errorType}</span>" —{' '}
        <span className="font-semibold">{count} incidents</span> this period.
      </div>
      <div className="mt-1 pl-4 text-xs">
        {interventions.length > 0 ? (
          <>
            <p className="font-semibold mb-0.5">Actions tried:</p>
            <ul className="space-y-0.5">
              {interventions.map(iv => (
                <li key={iv.id} className="leading-snug">
                  • <span className="text-[#633806]/70">{fmt(iv.created_at)} —</span> {iv.note}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="italic text-[#633806]/60">No actions logged yet.</p>
        )}
      </div>
    </li>
  );
}

// ── Report trend chart — prints cleanly to B&W on paper too ─────────
function ReportTrendChart({ data }: { data: { weekStart: string; count: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count));
  const total = data.reduce((a, b) => a + b.count, 0);
  const fmt = (s: string) => new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  return (
    <div className="rounded-xl p-4 mb-6 border border-gray-200 bg-white">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase text-gray-600">Weekly trend</span>
        <span className="text-[11px] text-gray-400">{total} incidents over {data.length} weeks</span>
      </div>
      <div className="flex items-end gap-1 h-16">
        {data.map(pt => {
          const h = pt.count === 0 ? 2 : Math.max(6, (pt.count / max) * 56);
          return (
            <div key={pt.weekStart} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                className={`w-full rounded-sm ${pt.count > 0 ? 'bg-[#0F6E56] print:bg-gray-800' : 'bg-gray-200'}`}
                style={{ height: `${h}px` }}
                title={`Week of ${fmt(pt.weekStart)}: ${pt.count}`}
              />
              {pt.count > 0 && <span className="text-[9px] text-gray-500 leading-none">{pt.count}</span>}
            </div>
          );
        })}
      </div>
      {/* Month labels — only on the first bar of each new month */}
      <div className="flex gap-1 mt-1">
        {data.map((pt, i) => {
          const d = new Date(pt.weekStart);
          const prev = i > 0 ? new Date(data[i - 1].weekStart) : null;
          const isNewMonth = !prev || d.getMonth() !== prev.getMonth();
          return (
            <div key={pt.weekStart} className="flex-1 text-[9px] text-gray-500 leading-none min-w-0">
              {isNewMonth ? d.toLocaleDateString('en-NZ', { month: 'short' }) : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
