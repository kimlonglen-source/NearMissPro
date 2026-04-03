import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ShieldIcon } from '../components/Logo';

interface AgendaItem { text: string; edited?: boolean }
interface Rec { id: string; ai_text: string; manager_outcome: string | null; manager_text?: string }
interface Incident {
  id: string; error_types: string[]; drug_name: string; dispensed_drug?: string;
  prescribed_strength?: string; dispensed_strength?: string; correct_formulation?: string;
  dispensed_formulation?: string; where_caught: string; time_of_day: string;
  factors: string[]; notes?: string; submitted_at: string; recommendations: Rec[];
}
interface Report {
  id: string; pharmacy_name: string; period_start: string; period_end: string;
  generated_by: string; generated_at: string; previous_period_summary: string;
  period_summary: string; agenda_items: AgendaItem[]; locked: boolean;
  total_incidents: number; vs_last_period: number; actions_taken: number; peak_risk_time: string;
  is_first_report?: boolean;
}
interface AckRow { name: string; role: string; initials: string; date: string }

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { pharmacyName } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [editing, setEditing] = useState(false);
  const [prevSummary, setPrevSummary] = useState('');
  const [periodSummary, setPeriodSummary] = useState('');
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());
  const [ackRows, setAckRows] = useState<AckRow[]>([]);

  useEffect(() => {
    if (!id) return;
    api.getReport(id).then((r: any) => {
      setReport(r); setPrevSummary(r.previous_period_summary || '');
      setPeriodSummary(r.period_summary || '');
      setAgenda(r.agenda_items || []);
      const picRow: AckRow = { name: r.generated_by, role: 'PIC', initials: '', date: '' };
      setAckRows([picRow, ...Array.from({ length: 5 }, () => ({ name: '', role: '', initials: '', date: '' }))]);
      api.getIncidents({ from: r.period_start, to: r.period_end }).then((d: any) => setIncidents(d.incidents || []));
    });
  }, [id]);

  const markEdited = (field: string) => setEditedFields(prev => new Set(prev).add(field));

  const saveEdits = async () => {
    if (!id) return;
    await api.updateReport(id, { previous_period_summary: prevSummary, period_summary: periodSummary, agenda_items: agenda });
    setEditing(false);
  };

  const handleEmail = () => { if (id) { api.emailReport(id); console.log('Email PDF triggered for report', id); } };
  const handlePrint = () => window.print();

  const addAckRow = () => setAckRows(r => [...r, { name: '', role: '', initials: '', date: '' }]);
  const updateAck = (i: number, field: keyof AckRow, val: string) =>
    setAckRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const editBorder = 'border-2 border-[#1D9E75]';
  const Badge = () => <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-medium no-print">Edited by manager</span>;

  if (!report) return <div className="flex justify-center items-center h-64 text-gray-500">Loading report...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview bar */}
      <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <button onClick={() => { setEditing(!editing); if (editing) saveEdits(); }}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          {editing ? 'Save edits' : 'Edit summary & agenda'}
        </button>
        <button onClick={handleEmail} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">Email PDF</button>
        <button onClick={handlePrint} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">Print report</button>
      </div>

      <div className="max-w-4xl mx-auto p-8 bg-white shadow-sm my-6 print:shadow-none print:my-0 print:p-6">
        {/* 1. Header */}
        <div className="pb-4 mb-6 border-b-2 border-[#0F6E56]">
          <div className="flex items-center gap-3 mb-1">
            <ShieldIcon size={40} />
            <div>
              <h1 className="text-xl font-bold text-[#0F6E56]">NearMiss <span className="text-gray-900">Pro</span></h1>
              <p className="text-xs text-gray-500">Pharmacy Near-Miss Incident Report</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-3 text-sm text-gray-700">
            <p><span className="font-medium">Pharmacy:</span> {report.pharmacy_name || pharmacyName}</p>
            <p><span className="font-medium">Period:</span> {fmtDate(report.period_start)} — {fmtDate(report.period_end)}</p>
            <p><span className="font-medium">PIC:</span> {report.generated_by}</p>
            <p><span className="font-medium">Generated:</span> {fmtDate(report.generated_at)}</p>
          </div>
        </div>

        {/* 2. Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Incidents', value: report.total_incidents },
            { label: 'vs Last Period', value: `${report.vs_last_period >= 0 ? '+' : ''}${report.vs_last_period}` },
            { label: 'Actions Taken', value: report.actions_taken },
            { label: 'Peak Risk Time', value: report.peak_risk_time },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-[#0F6E56]">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 3. Previous period improvements */}
        {!report.is_first_report && (
          <div className={`mb-6 rounded-lg p-4 bg-[#F0FAF5] border ${editing ? editBorder : 'border-[#9FE1CB]'}`}>
            <h2 className="text-sm font-semibold text-[#0F6E56] mb-2">
              Improvements from Previous Period
              {editedFields.has('prev') && <Badge />}
            </h2>
            {editing ? (
              <textarea value={prevSummary} onChange={e => { setPrevSummary(e.target.value); markEdited('prev'); }}
                className="w-full p-2 rounded border border-[#9FE1CB] bg-white text-sm min-h-[80px]" />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{prevSummary || 'No previous period summary.'}</p>
            )}
          </div>
        )}

        {/* 4. Incident log */}
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Incident Log</h2>
        <div className="space-y-4 mb-6">
          {incidents.map(inc => (
            <div key={inc.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#E8F5F0] text-[#0F6E56]">{inc.error_types?.join(', ')}</span>
                {inc.drug_name && <span className="px-2 py-0.5 text-xs rounded bg-amber-50 text-amber-700 border border-amber-200">{inc.drug_name}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-3">
                {inc.dispensed_drug && <p><span className="font-medium">Dispensed:</span> {inc.dispensed_drug}</p>}
                {inc.prescribed_strength && <p><span className="font-medium">Prescribed:</span> {inc.prescribed_strength}</p>}
                {inc.dispensed_strength && <p><span className="font-medium">Dispensed strength:</span> {inc.dispensed_strength}</p>}
                <p><span className="font-medium">Caught at:</span> {inc.where_caught}</p>
                <p><span className="font-medium">Time:</span> {inc.time_of_day}</p>
                {inc.factors?.length > 0 && <p><span className="font-medium">Factors:</span> {inc.factors.join(', ')}</p>}
              </div>
              {inc.notes && <p className="text-xs text-gray-500 mb-2 italic">{inc.notes}</p>}
              {inc.recommendations?.map(rec => (
                <div key={rec.id} className="mt-2 p-2 rounded bg-gray-50 text-xs">
                  <p className="text-gray-700"><span className="font-medium">AI Recommendation:</span> {rec.ai_text}</p>
                  {rec.manager_outcome === 'modified' && rec.manager_text && (
                    <p className="text-purple-700 mt-1"><span className="font-medium">Manager modified:</span> {rec.manager_text}</p>
                  )}
                  {rec.manager_outcome && rec.manager_outcome !== 'modified' && (
                    <p className="text-gray-500 mt-1 capitalize"><span className="font-medium">Outcome:</span> {rec.manager_outcome.replace('_', ' ')}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
          {incidents.length === 0 && <p className="text-sm text-gray-400 italic">No incidents in this period.</p>}
        </div>

        {/* 5. Period summary */}
        <div className={`mb-6 rounded-lg p-4 bg-[#F8FAF8] border ${editing ? editBorder : 'border-[#C8E6D8]'}`}>
          <h2 className="text-sm font-semibold text-gray-800 mb-2">
            Period Summary
            {editedFields.has('summary') && <Badge />}
          </h2>
          {editing ? (
            <textarea value={periodSummary} onChange={e => { setPeriodSummary(e.target.value); markEdited('summary'); }}
              className="w-full p-2 rounded border border-[#C8E6D8] bg-white text-sm min-h-[80px]" />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{periodSummary || 'No summary provided.'}</p>
          )}
        </div>

        {/* 6. Staff meeting agenda */}
        <div className={`mb-6 rounded-lg p-4 bg-[#F8FAF8] border ${editing ? editBorder : 'border-[#C8E6D8]'}`}>
          <h2 className="text-sm font-semibold text-gray-800 mb-2">
            Staff Meeting Agenda
            {editedFields.has('agenda') && <Badge />}
          </h2>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
            {agenda.map((item, i) => (
              <li key={i}>
                {editing ? (
                  <input value={item.text} onChange={e => {
                    const next = [...agenda]; next[i] = { ...next[i], text: e.target.value, edited: true }; setAgenda(next); markEdited('agenda');
                  }} className="ml-1 px-2 py-0.5 border border-[#C8E6D8] rounded text-sm w-[85%]" />
                ) : (
                  <span>{item.text}{item.edited && <span className="ml-1 text-xs text-purple-600">(edited)</span>}</span>
                )}
              </li>
            ))}
          </ol>
          {editing && (
            <button onClick={() => { setAgenda(a => [...a, { text: '', edited: true }]); markEdited('agenda'); }}
              className="mt-2 text-xs text-[#0F6E56] hover:underline">+ Add item</button>
          )}
        </div>

        {/* 7. Staff acknowledgement */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">Staff Acknowledgement</h2>
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>{['Staff Name', 'Role', 'Initials', 'Date'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {ackRows.map((row, i) => (
                <tr key={i} className="border-t border-gray-100">
                  {(['name', 'role', 'initials', 'date'] as (keyof AckRow)[]).map(f => (
                    <td key={f} className="px-3 py-1.5">
                      <input value={row[f]} onChange={e => updateAck(i, f, e.target.value)}
                        className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#0F6E56] rounded px-1" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addAckRow} className="mt-2 text-xs text-[#0F6E56] hover:underline no-print">+ Add row</button>
        </div>

        {/* 8. PIC signature */}
        <div className="mb-8 flex items-end gap-12">
          <div>
            <p className="text-xs text-gray-500 mb-1">Pharmacist-in-Charge</p>
            <p className="text-sm font-medium text-gray-800">{report.generated_by}</p>
          </div>
          <div className="flex-1 border-b border-gray-300 mb-0.5" />
          <div>
            <p className="text-xs text-gray-500 mb-1">Date</p>
            <div className="w-32 border-b border-gray-300">&nbsp;</div>
          </div>
        </div>

        {/* 9. Footer */}
        <div className="border-t border-gray-200 pt-3 text-center text-xs text-gray-400">
          <p>{report.pharmacy_name || pharmacyName} — {fmtDate(report.period_start)} to {fmtDate(report.period_end)}</p>
          <p className="mt-1 italic">Recommendations generated by AI. All clinical decisions reviewed and approved by the Pharmacist-in-Charge.</p>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
