import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ShieldIcon } from '../components/Logo';
import { usePatternMap, findPattern } from '../lib/usePatternMap';
import { PeriodComparison } from '../components/PeriodComparison';
import { FactorPanel } from '../components/FactorPanel';
import { summarizeIncident, narrateIncidentContext } from '../lib/incidentSummary';
import { checkHighRisk } from '../lib/highRiskDrugs';
import { normalizeDrugName } from '../lib/normalize';
import { Printer, Save, Plus, Loader2, ArrowLeft, CheckCircle2, RotateCcw, AlertTriangle, Trash2 } from 'lucide-react';

interface Incident {
  id: string; error_types: string[]; drug_name?: string; dispensed_drug?: string;
  prescribed_strength?: string; dispensed_strength?: string; correct_formulation?: string; dispensed_formulation?: string;
  prescribed_quantity?: number; dispensed_quantity?: number;
  where_caught?: string; time_of_day?: string; factors: string[]; notes?: string;
  submitted_at: string; occurred_at?: string; status: string;
  recommendations?: { ai_text: string; manager_outcome?: string; manager_text?: string; private_note?: string }[];
}
interface Report {
  id: string; period_start: string; period_end: string; generated_by: string; generated_at: string; locked: boolean;
  previous_period_summary?: string; period_summary?: string; agenda_items: { text: string; edited: boolean }[];
  pattern_alerts?: { drug: string; errorType: string; count: number }[];
  trend_data?: { weekStart: string; count: number }[];
  last_meeting_review?: string;
  next_review_date?: string;
}
interface AckRow { name: string; role: string; initials: string; date: string; }

// Group incidents that share the same (drug, error types) pattern so
// repeats render as ONE card with the occurrences listed inside it.
// Groups keep the position of their first occurrence so the report
// still reads roughly newest-first. Incidents with no drug name only
// group when their error types match exactly (e.g. two "Bag missing
// an item" entries).
function groupIncidents(incidents: Incident[]): Incident[][] {
  const keyOf = (inc: Incident) =>
    `${normalizeDrugName(inc.drug_name)}|||${[...(inc.error_types || [])].sort().join('+')}`;
  const order: string[] = [];
  const byKey = new Map<string, Incident[]>();
  for (const inc of incidents) {
    const key = keyOf(inc);
    if (!byKey.has(key)) { byKey.set(key, []); order.push(key); }
    byKey.get(key)!.push(inc);
  }
  return order.map(k => byKey.get(k)!);
}

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
  const [picName, setPicName] = useState('');
  const [picEdited, setPicEdited] = useState(false);
  const [ackRows, setAckRows] = useState<AckRow[]>([]);
  const [nextReviewDate, setNextReviewDate] = useState('');
  const [nextReviewDateEdited, setNextReviewDateEdited] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getReport(id).then((r: unknown) => {
        const rpt = r as Report;
        setReport(rpt);
        setPrevSummary(rpt.previous_period_summary || '');
        setPeriodSummary(rpt.period_summary || '');
        setAgenda(rpt.agenda_items || []);
        setPicName(rpt.generated_by || '');
        setNextReviewDate(rpt.next_review_date || '');
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
        generated_by: picName,
        next_review_date: nextReviewDate || null,
      });
      // Clear the "edited" flags so the Save button disappears, and refresh
      // local state so a second edit-then-save cycle starts clean.
      setPrevEdited(false); setSummaryEdited(false); setAgendaEdited(false); setPicEdited(false);
      setNextReviewDateEdited(false);
      setReport({ ...report, previous_period_summary: prevSummary, period_summary: periodSummary, agenda_items: agenda, generated_by: picName, next_review_date: nextReviewDate });
      setSaveState('saved');
      setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState(s => (s === 'error' ? 'idle' : s)), 4000);
    }
  };

  // Auto-save on blur — manager doesn't have to remember to click Save.
  // Only fires when something has actually changed; the Save button stays
  // as a visible fallback (and shows the saved/error state).
  const autoSaveOnBlur = () => {
    if (prevEdited || summaryEdited || agendaEdited || picEdited || nextReviewDateEdited) saveEdits();
  };

  const toggleCompleted = async () => {
    if (!report) return;
    const next = !report.locked;
    await api.updateReport(report.id, { locked: next });
    setReport({ ...report, locked: next });
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');
  const handleDelete = async () => {
    if (!report) return;
    setDeleteBusy(true); setDeleteErr('');
    try {
      await api.deleteReport(report.id);
      nav('/reports');
    } catch (err) {
      setDeleteErr(err instanceof Error ? err.message : 'Could not delete — try again.');
      setDeleteBusy(false);
    }
  };

  // Pattern lookup for the report's date range. Used to swap each
  // incident card's recommendation for the pattern action when that
  // pair has been actioned, so the report tells the same story as
  // the dashboard banner and the WHAT WORKED comparison.
  const { map: patternMap } = usePatternMap(report?.period_start, report?.period_end);

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
            <CheckCircle2 size={12} /> Signed off
          </span>
        ) : (
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-[#FAEEDA] text-[#633806]">
            Draft
          </span>
        )}
        <button onClick={toggleCompleted}
          className={`btn text-sm ${report.locked ? 'bg-gray-50 text-gray-700 border border-gray-200' : 'bg-[#0F6E56] text-white'}`}>
          {report.locked ? <><RotateCcw size={14} /> Unlock to edit</> : <><CheckCircle2 size={14} /> Sign off report</>}
        </button>
        <button onClick={() => window.print()} className="btn text-sm bg-gray-50 text-gray-700 border border-gray-200">
          <Printer size={14} /> Print report
        </button>
        {!report.locked && (
          <button onClick={() => { setShowDeleteModal(true); setDeleteErr(''); }}
            className="btn text-sm bg-white text-red-600 border border-red-200 hover:bg-red-50"
            title="Permanently delete this draft so you can start fresh">
            <Trash2 size={14} /> Delete draft
          </button>
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-3">
            <h3 className="text-lg font-bold text-red-700">Delete this draft report?</h3>
            <p className="text-sm text-gray-600">The report's summary, agenda, and any edits will be permanently removed. <strong>Your near misses are not deleted</strong> — only the report. You can generate a fresh one for the same period any time from the Dashboard.</p>
            {deleteErr && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{deleteErr}</div>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowDeleteModal(false); setDeleteErr(''); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleteBusy}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {deleteBusy ? 'Deleting…' : 'Delete draft'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <p className="flex items-center gap-1 justify-end">
              <span>Reviewed by:</span>
              {!report.locked ? (
                <>
                  <input
                    value={picName}
                    onChange={e => { setPicName(e.target.value); setPicEdited(true); }}
                    onBlur={autoSaveOnBlur}
                    placeholder="Pharmacist-in-charge"
                    className="no-print text-sm bg-transparent border-b border-gray-300 focus:border-[#0F6E56] focus:outline-none px-1 text-gray-900 text-right w-44"
                  />
                  <span className="hidden print:inline">{picName || '—'}</span>
                </>
              ) : (
                <span>{picName || '—'}</span>
              )}
            </p>
            <p>{fmtDate(report.period_start)} — {fmtDate(report.period_end)}</p>
            <p>Generated: {fmtDate(report.generated_at)}</p>
          </div>
        </div>
        <div className="h-[2px] bg-[#0F6E56] mb-6" />

        {/* Period summary — labelled so the reader knows what this
            opening paragraph is. Heading uses the same teal small-caps
            style as every other section so the rhythm down the page
            stays consistent. */}
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#0F6E56] border-b border-[#0F6E56] pb-1 mb-4">Period summary</h2>
        <div className="mb-2">
          {!report.locked ? (
            <>
              {/* Editable view on screen — auto-grows with content so
                  the full text is always visible (was rows={6}, which
                  cut off long summaries). */}
              <textarea value={periodSummary} onChange={e => { setPeriodSummary(e.target.value); setSummaryEdited(true); }}
                onBlur={autoSaveOnBlur}
                rows={Math.max(6, Math.ceil(periodSummary.length / 90))}
                className="no-print w-full p-3 rounded-lg border border-gray-200 text-[15px] bg-white leading-relaxed text-gray-800" />
              {/* Print fallback — paragraph so the FULL summary prints,
                  not just the textarea's visible rows. */}
              <p className="hidden print:block text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap">{periodSummary || 'No summary generated.'}</p>
            </>
          ) : (
            <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap">{periodSummary || 'No summary generated.'}</p>
          )}
          {summaryEdited && <div className="mt-1"><EditBadge /></div>}
        </div>

        <p className="text-xs text-gray-500 mb-8">
          {activeIncidents.length} near miss{activeIncidents.length === 1 ? '' : 'es'}
          {' · '}{actionsCount} action{actionsCount === 1 ? '' : 's'} taken
          {' · '}{activeIncidents.filter(i => i.recommendations?.[0]?.manager_outcome).length} of {activeIncidents.length} reviewed
          {peakTime !== '-' && <> · peak time {peakTime}</>}
        </p>

        {/* What worked — wins lead so the meeting opens positively. */}
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#0F6E56] border-b border-[#0F6E56] pb-1 mb-4 mt-6">What worked</h2>
        <PeriodComparison from={report.period_start} to={report.period_end} maxRows={3} />

        {/* The "Manager's notes on last meeting's actions" box used to
            live here. Removed — the comparison panel above plus logged
            pattern actions already document what was agreed and whether
            it worked, from real data. The last_meeting_review DB column
            stays (harmless) in case a real pharmacy asks for it back. */}
        {/* "Notes from last meeting" only shows when the manager has
            typed something. We deliberately suppress the auto-generated
            comparison narrative here (phrases like "X more near misses
            than last period…", "Resolved:", "Improving:") because that
            text duplicates the "Did our actions work?" panel above and
            was the single biggest source of wall-of-text on this page. */}
        {prevSummary && !/(more|fewer|same total|resolved:|improving:|needs attention:)/i.test(prevSummary) && (
          <div className="mb-8">
            <p className="text-[11px] font-semibold uppercase text-gray-500 mb-1.5">
              Notes from last meeting
              {prevEdited && <EditBadge />}
            </p>
            {!report.locked ? (
              <>
                <textarea value={prevSummary} onChange={e => { setPrevSummary(e.target.value); setPrevEdited(true); }}
                  onBlur={autoSaveOnBlur}
                  rows={Math.max(3, Math.ceil(prevSummary.length / 90))}
                  className="no-print w-full p-3 rounded-lg border border-gray-200 text-sm bg-white leading-relaxed" />
                <p className="hidden print:block text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{prevSummary}</p>
              </>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{prevSummary}</p>
            )}
          </div>
        )}

        {/* "What to look at" (pattern alerts) used to sit here but was
            removed — it duplicated the "Needs attention" rows in the
            panel above almost word for word (same patterns, same
            counts), and the prevention-action prompt it carried is
            already agenda item 3. */}

        {/* Near misses this period — every item shows two things in the
            same fixed shape: WHAT HAPPENED and WHAT WE'RE DOING. That's
            the whole point of the meeting: staff hear each event and
            hear the change. Repeats of the same (drug, error) pattern
            collapse into one entry with dated occurrence lines, so
            nobody reads the same story four times. Kept compact:
            divider lines between entries instead of boxed cards. */}
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#0F6E56] border-b border-[#0F6E56] pb-1 mb-4 mt-6">Near misses this period — and what we're doing about each</h2>
        {activeIncidents.length === 0 ? (
          <p className="text-sm text-gray-400 mb-6">No active incidents in this period.</p>
        ) : (
          <div className="divide-y divide-gray-200 mb-6">
            {groupIncidents(activeIncidents).map(group => {
              const first = group[0];
              const rec = first.recommendations?.[0];
              const outcome = rec?.manager_outcome;
              const highRiskInfo = checkHighRisk(first.drug_name) || checkHighRisk(first.dispensed_drug);
              const isHighRisk = !!highRiskInfo;
              const pattern = findPattern(patternMap, first.drug_name || null, first.error_types);
              const usePatternAction = !!pattern && !!pattern.latestAction;
              const isGroup = group.length > 1;

              // The one action line every entry gets. Priority: the
              // manager's logged pattern action > the manager's own
              // wording > the accepted AI suggestion > explicit "no
              // change" > "not yet reviewed".
              const actionText = usePatternAction ? pattern!.latestAction!.note
                : outcome === 'modified' && rec?.manager_text ? rec.manager_text
                : outcome === 'accepted' && rec ? rec.ai_text
                : null;

              return (
                <div key={first.id} className="py-3">
                  <div className="flex items-start gap-2">
                    <p className={`flex-1 text-sm leading-snug ${isHighRisk ? 'font-bold text-[#791F1F]' : 'font-semibold text-gray-900'}`}>
                      {summarizeIncident(first)}
                    </p>
                    {isGroup && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FDF8EB] text-[#633806] border border-[#BA7517]/40 whitespace-nowrap">
                        × {group.length}
                      </span>
                    )}
                    {isHighRisk && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#FCEBEB] text-[#791F1F] whitespace-nowrap">
                        ⚠ High-risk
                      </span>
                    )}
                  </div>

                  {isGroup ? (
                    <ul className="text-xs text-gray-600 leading-snug mt-1 space-y-0.5">
                      {group.map(inc => (
                        <li key={inc.id}>
                          • {narrateIncidentContext(inc)}
                          {inc.notes && <span className="italic text-gray-500"> "{inc.notes}"</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-600 leading-snug mt-1">
                      {narrateIncidentContext(first)}
                      {first.notes && <span className="italic text-gray-500"> "{first.notes}"</span>}
                    </p>
                  )}

                  <p className="text-sm leading-snug mt-1.5">
                    {actionText ? (
                      <>
                        <span className="font-semibold text-[#085041]">What we're doing: </span>
                        <span className="text-gray-800">{actionText}</span>
                        {isGroup && <span className="text-xs text-gray-500"> (covers all {group.length})</span>}
                      </>
                    ) : outcome === 'no_action' ? (
                      <>
                        <span className="font-semibold text-gray-600">Decision: </span>
                        <span className="text-gray-700">no change needed — reviewed by the pharmacist-in-charge.</span>
                      </>
                    ) : (
                      <span className="text-gray-400 italic">Not yet reviewed.</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* What we'll do — agenda. Numbered list, no boxes around each
            row — those made the page feel like a form. */}
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#0F6E56] border-b border-[#0F6E56] pb-1 mb-4 mt-6">
          What we'll do
          {agendaEdited && <EditBadge />}
        </h2>
        {/* Flex layout instead of <ol> + <li> so the number stays
            aligned with the FIRST line of each agenda item even when
            the textarea wraps to multiple rows. Was: numbers floated
            to the bottom of the box because <li> let the textarea
            push everything down. */}
        <div className="space-y-3 mb-6">
          {agenda.map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="text-sm font-medium text-gray-500 pt-2 select-none">{i + 1}.</span>
              <div className="flex-1">
                {!report.locked ? (
                  <>
                    <textarea value={item.text}
                      className="no-print w-full text-sm leading-relaxed p-2 rounded-lg border border-gray-200 bg-white resize-none"
                      rows={Math.max(2, Math.ceil(item.text.length / 90))}
                      onChange={e => {
                        const next = [...agenda]; next[i] = { text: e.target.value, edited: true };
                        setAgenda(next); setAgendaEdited(true);
                      }}
                      onBlur={autoSaveOnBlur} />
                    <p className="hidden print:block text-sm leading-relaxed">{item.text}</p>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed">{item.text}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {!report.locked && (
          <button onClick={() => { setAgenda([...agenda, { text: '', edited: true }]); setAgendaEdited(true); }}
            className="btn-outline text-xs mb-6 no-print"><Plus size={12} /> Add item</button>
        )}

        {/* ─── 6. SIGN-OFF ───────────────────────────────────── */}
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#0F6E56] border-b border-[#0F6E56] pb-1 mb-4 mt-6">Sign-off</h2>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Staff acknowledgement</h3>
        <p className="text-xs text-gray-500 mb-1">I confirm I have attended the near miss review meeting and have read and understood the incidents and actions in this report.</p>
        <p className="text-xs text-gray-400 italic mb-3 no-print">Print this report and have each staff member sign in pen at the meeting.</p>
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
                <td className="border border-gray-200 px-3 py-2">{row.name || ' '}</td>
                <td className="border border-gray-200 px-3 py-2">{row.role || ' '}</td>
                <td className="border border-gray-200 px-3 py-2">{' '}</td>
                <td className="border border-gray-200 px-3 py-2">{' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!report.locked && (
          <button onClick={() => setAckRows([...ackRows, { name: '', role: '', initials: '', date: '' }])}
            className="btn-outline text-xs mb-6 no-print"><Plus size={12} /> Add row</button>
        )}

        {/* Next review date — inspectors look for documented cadence. */}
        <div className="mt-6 mb-2">
          <p className="text-[11px] font-semibold uppercase text-gray-500 mb-1.5">
            Next review meeting
            {nextReviewDateEdited && <EditBadge />}
          </p>
          {!report.locked ? (
            <>
              <input
                type="date"
                value={nextReviewDate}
                onChange={e => { setNextReviewDate(e.target.value); setNextReviewDateEdited(true); }}
                onBlur={autoSaveOnBlur}
                className="no-print text-sm px-2 py-1 rounded border border-gray-300"
              />
              <p className="hidden print:block text-sm text-gray-700">{nextReviewDate ? fmtDate(nextReviewDate) : '________________'}</p>
            </>
          ) : (
            <p className="text-sm text-gray-700">{nextReviewDate ? fmtDate(nextReviewDate) : '—'}</p>
          )}
        </div>

        {/* 8. PIC Signature */}
        <div className="grid grid-cols-2 gap-12 mt-8 mb-8">
          <div>
            <div className="border-b border-gray-400 mb-2 h-12" />
            {!report.locked ? (
              <>
                <input
                  value={picName}
                  onChange={e => { setPicName(e.target.value); setPicEdited(true); }}
                  onBlur={autoSaveOnBlur}
                  placeholder="Type the pharmacist-in-charge's name"
                  className="no-print text-sm font-medium w-full bg-transparent focus:outline-none focus:bg-gray-50 px-1 py-0.5 rounded border border-dashed border-gray-300"
                />
                <p className="hidden print:block text-sm font-medium">{picName || ' '}</p>
              </>
            ) : (
              <div className="text-sm font-medium">{picName || ' '}</div>
            )}
            <div className="text-xs text-gray-500 mt-0.5">Pharmacist-in-charge</div>
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


