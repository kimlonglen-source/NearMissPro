import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { summarizeIncident } from '../lib/incidentSummary';
import { ArrowLeft, XCircle, Loader2, RotateCcw } from 'lucide-react';

interface Rec { manager_outcome: string | null; }
interface Incident {
  id: string;
  error_types: string[];
  drug_name?: string;
  dispensed_drug?: string;
  prescribed_strength?: string;
  dispensed_strength?: string;
  correct_formulation?: string;
  dispensed_formulation?: string;
  prescribed_quantity?: number;
  dispensed_quantity?: number;
  notes?: string;
  submitted_at: string;
  occurred_at?: string;
  status: string;
  edit_reason?: string;
  edited_at?: string;
  recommendations?: Rec[];
}

/**
 * Voided incidents page — audit & recovery view.
 *
 * Voided incidents are never deleted; they stay in the database with
 * status='voided' and the reason typed at void time. This page shows
 * every voided incident across all time so a manager can:
 *   * See what was voided and why (audit transparency)
 *   * Restore one if voided by mistake (recovery)
 *
 * Both the original void and any restore are written to audit_log,
 * so the trail stays complete for inspection.
 */
export function VoidedIncidentsPage() {
  const nav = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // Fetch only voided incidents — list endpoint accepts a status filter.
      const r = await api.getIncidents({ status: 'voided' });
      // Sort newest first by void timestamp where available, otherwise submitted.
      const list = (r.incidents as unknown as Incident[]).sort((a, b) => {
        const aT = new Date(a.edited_at || a.submitted_at).getTime();
        const bT = new Date(b.edited_at || b.submitted_at).getTime();
        return bT - aT;
      });
      setIncidents(list);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const onRestore = async (id: string) => {
    setBusyId(id);
    try { await api.restoreIncident(id); await load(); }
    finally { setBusyId(null); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <button onClick={() => nav('/dashboard')}
        className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-3">
        <ArrowLeft size={14} /> Back to dashboard
      </button>

      <div className="flex items-center gap-2 mb-1">
        <XCircle size={22} className="text-[#791F1F]" />
        <h1 className="text-xl font-bold text-gray-900">Voided incidents</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        Voided incidents are not deleted — they stay on file with the reason and a full audit-log entry. Tap <span className="font-semibold">Restore</span> if one was voided by mistake; both the void and the restore are captured for audit.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-12 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading voided incidents…
        </div>
      )}

      {!loading && incidents.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <XCircle size={28} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No voided incidents.</p>
          <p className="text-xs mt-1">If you void a near miss from the dashboard, it'll show up here so you can restore it if needed.</p>
        </div>
      )}

      {!loading && incidents.length > 0 && (
        <div className="space-y-2">
          {incidents.map(inc => (
            <div key={inc.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-snug">
                    {summarizeIncident(inc)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Logged {fmtDate(inc.occurred_at || inc.submitted_at)}
                    {inc.edited_at && <> · Voided {fmtDate(inc.edited_at)}</>}
                  </p>
                  {inc.edit_reason && (
                    <p className="text-xs text-gray-600 italic mt-2 pl-2 border-l-2 border-gray-200">
                      Reason: {inc.edit_reason}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRestore(inc.id)}
                  disabled={busyId === inc.id}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white text-[#0F6E56] border border-[#0F6E56] hover:bg-[#F0FAF5] disabled:opacity-50 inline-flex items-center gap-1.5 flex-shrink-0">
                  {busyId === inc.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
