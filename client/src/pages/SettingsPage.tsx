import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Key, Building2, FileText, ChevronDown, ChevronRight } from 'lucide-react';

type Tab = 'password' | 'pharmacy' | 'audit';
type PharmacySize = 'sole' | 'pharmacist_plus_tech' | 'multi';

const SIZE_LABELS: Record<PharmacySize, { title: string; help: string }> = {
  sole: { title: 'Sole pharmacist', help: 'Just one pharmacist on duty (no second checker).' },
  pharmacist_plus_tech: { title: 'Pharmacist + tech', help: 'One pharmacist with one or more technicians.' },
  multi: { title: 'Two or more pharmacists', help: 'Two or more pharmacists rostered together.' },
};

// Plain-English label for the action column. Falls back to the raw
// underscore_separated action so new actions still show something readable.
function auditActionLabel(action: string): string {
  switch (action) {
    case 'recommendation_accepted': return 'Recommendation accepted';
    case 'recommendation_modified': return 'Recommendation modified';
    case 'recommendation_no_action': return 'Recommendation marked no action';
    case 'bulk_accept': return 'Bulk-accepted recommendations';
    case 'incident_voided': return 'Incident voided';
    case 'incident_restored': return 'Incident restored';
    case 'incident_edited': return 'Incident edited';
    case 'phi_suspected': return 'Possible patient identifier in notes';
    case 'report_generated': return 'Report generated';
    case 'password_changed': return 'Password changed';
    case 'pharmacy_created': return 'Pharmacy created';
    default: return action.replace(/_/g, ' ');
  }
}

// Per-action detail rows for the expanded view. Returns [label, value]
// pairs in the order to render. Skips fields we don't want surfaced
// (like raw IDs without a way to navigate to them).
function auditDetailRows(action: string, details: Record<string, unknown> | null): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (!details) return out;
  const get = (k: string) => {
    const v = details[k];
    return v === null || v === undefined ? '' : String(v);
  };
  if (action.startsWith('recommendation_')) {
    if (get('modified_text')) out.push({ label: 'Modified text', value: get('modified_text') });
    if (get('recommendation_id')) out.push({ label: 'Recommendation ID', value: get('recommendation_id') });
  } else if (action === 'bulk_accept') {
    if (get('count')) out.push({ label: 'Count', value: `${get('count')} recommendations` });
  } else if (action === 'incident_voided' || action === 'incident_edited') {
    if (get('reason')) out.push({ label: 'Reason', value: get('reason') });
    if (get('incident_id')) out.push({ label: 'Incident ID', value: get('incident_id') });
  } else if (action === 'incident_restored') {
    if (get('incident_id')) out.push({ label: 'Incident ID', value: get('incident_id') });
  } else if (action === 'phi_suspected') {
    if (get('incident_id')) out.push({ label: 'Incident ID', value: get('incident_id') });
    const fields = details.fields;
    if (fields && typeof fields === 'object') {
      out.push({ label: 'Fields flagged', value: Object.keys(fields as Record<string, unknown>).join(', ') });
    }
  } else if (action === 'report_generated') {
    if (get('period')) out.push({ label: 'Period', value: get('period') });
    if (get('report_id')) out.push({ label: 'Report ID', value: get('report_id') });
  } else if (action === 'pharmacy_created') {
    if (get('name')) out.push({ label: 'Pharmacy name', value: get('name') });
  }
  return out;
}

export function SettingsPage() {
  const { pharmacyName } = useAuth();
  const [tab, setTab] = useState<Tab>('password');

  // Password
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  // Pharmacy size
  const [size, setSize] = useState<PharmacySize | null>(null);
  const [sizeMsg, setSizeMsg] = useState('');
  const [sizeLoading, setSizeLoading] = useState(false);

  // Audit log
  const [auditEntries, setAuditEntries] = useState<{ id: string; action: string; performed_by: string | null; details: Record<string, unknown> | null; created_at: string }[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState<Record<string, boolean>>({});
  const auditLimit = 50;

  useEffect(() => {
    api.getMe().then(me => setSize((me.pharmacySize as PharmacySize | null) || null)).catch(() => {});
  }, []);

  const loadAudit = useCallback(async (page: number) => {
    setAuditLoading(true);
    try {
      const res = await api.getMyAuditLog(page);
      setAuditEntries(res.entries);
      setAuditTotal(res.total);
      setAuditPage(page);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'audit' && auditEntries.length === 0) loadAudit(1);
  }, [tab, auditEntries.length, loadAudit]);

  const handleChangePassword = async () => {
    if (newPwd.length < 8) { setPwdErr('Password must be at least 8 characters'); return; }
    try {
      await api.changePassword(currentPwd, newPwd);
      setPwdMsg('Password changed — all devices will need to re-login'); setCurrentPwd(''); setNewPwd('');
    } catch { setPwdErr('Current password incorrect'); }
  };

  const handleSetSize = async (next: PharmacySize) => {
    setSizeLoading(true); setSizeMsg('');
    try {
      const res = await api.setPharmacySize(next);
      setSize((res.pharmacySize as PharmacySize | null) || next);
      setSizeMsg('Saved');
    } catch {
      setSizeMsg('Failed to save');
    } finally {
      setSizeLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(auditTotal / auditLimit));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">{pharmacyName}</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setTab('password')} className={`btn text-sm ${tab === 'password' ? 'btn-teal' : 'btn-grey'}`}><Key size={14} /> Password</button>
        <button onClick={() => setTab('pharmacy')} className={`btn text-sm ${tab === 'pharmacy' ? 'btn-teal' : 'btn-grey'}`}><Building2 size={14} /> Pharmacy</button>
        <button onClick={() => setTab('audit')} className={`btn text-sm ${tab === 'audit' ? 'btn-teal' : 'btn-grey'}`}><FileText size={14} /> Audit</button>
      </div>

      {tab === 'password' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold">Change pharmacy password</h3>
          {pwdMsg && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{pwdMsg}</div>}
          {pwdErr && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{pwdErr}</div>}
          <input type="password" placeholder="Current password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} className="input-field" />
          <input type="password" placeholder="New password (min 8 characters)" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="input-field" />
          <button onClick={handleChangePassword} disabled={!currentPwd || newPwd.length < 8} className="btn-teal text-sm">Change password</button>
        </div>
      )}

      {tab === 'pharmacy' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold">Pharmacy size</h3>
          <p className="text-sm text-gray-500">This shapes the AI's advice — a sole pharmacist won't be told to "have a second pharmacist check".</p>
          {sizeMsg && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{sizeMsg}</div>}
          <div className="space-y-2">
            {(Object.keys(SIZE_LABELS) as PharmacySize[]).map(key => {
              const selected = size === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSetSize(key)}
                  disabled={sizeLoading}
                  className={`w-full text-left p-4 rounded-lg border transition ${selected ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="font-medium text-gray-900">{SIZE_LABELS[key].title}</div>
                  <div className="text-sm text-gray-500">{SIZE_LABELS[key].help}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Audit log</h3>
            <span className="text-xs text-gray-500">{auditTotal} entries</span>
          </div>
          <p className="text-sm text-gray-500">Every void, restore, and recommendation decision — with timestamp and reason. This is what an inspector will ask for.</p>
          {auditLoading && <div className="text-sm text-gray-500">Loading…</div>}
          {!auditLoading && auditEntries.length === 0 && (
            <div className="text-sm text-gray-500 italic">No audit entries yet.</div>
          )}
          {!auditLoading && auditEntries.length > 0 && (
            <div className="divide-y divide-gray-100 -mx-2">
              {auditEntries.map(e => {
                const rows = auditDetailRows(e.action, e.details);
                const hasDetails = rows.length > 0;
                const expanded = !!auditExpanded[e.id];
                return (
                  <div key={e.id} className="px-2 py-3 text-sm">
                    <button
                      onClick={() => hasDetails && setAuditExpanded(s => ({ ...s, [e.id]: !s[e.id] }))}
                      className={`w-full text-left ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
                      disabled={!hasDetails}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-900 flex items-center gap-1">
                          {hasDetails && (expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />)}
                          {auditActionLabel(e.action)}
                        </span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 ml-[18px]">{e.performed_by || 'system'}</div>
                    </button>
                    {expanded && hasDetails && (
                      <div className="mt-2 ml-[18px] p-3 bg-gray-50 rounded-lg space-y-1.5">
                        {rows.map((r, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="text-gray-500">{r.label}: </span>
                            <span className="text-gray-800 break-all">{r.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button onClick={() => loadAudit(Math.max(1, auditPage - 1))} disabled={auditPage <= 1 || auditLoading} className="btn-grey text-xs">Previous</button>
              <span className="text-xs text-gray-500">Page {auditPage} of {totalPages}</span>
              <button onClick={() => loadAudit(Math.min(totalPages, auditPage + 1))} disabled={auditPage >= totalPages || auditLoading} className="btn-grey text-xs">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
