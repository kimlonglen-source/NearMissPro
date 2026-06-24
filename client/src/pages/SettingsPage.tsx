import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Building2, FileText, ChevronDown, ChevronRight } from 'lucide-react';

type Tab = 'pharmacy' | 'audit';
type PharmacySize = 'sole' | 'pharmacist_plus_tech' | 'multi';

const SIZE_LABELS: Record<PharmacySize, { title: string; help: string }> = {
  sole: { title: 'Sole pharmacist', help: 'Just one pharmacist on duty (no second checker).' },
  pharmacist_plus_tech: { title: 'Pharmacist + tech', help: 'One pharmacist with one or more technicians.' },
  multi: { title: 'Two or more pharmacists', help: 'Two or more pharmacists rostered together.' },
};

// Plain-English label for the action column. Every action emitted
// anywhere in the server is mapped here so the audit log reads as
// English, not codespeak. Anything unmapped falls through to the
// raw underscore_separated form so a new action type still shows
// something readable until it's added here.
function auditActionLabel(action: string): string {
  switch (action) {
    // Recommendations
    case 'recommendation_accepted': return 'Recommendation accepted';
    case 'recommendation_modified': return 'Recommendation modified';
    case 'recommendation_no_action': return 'Recommendation marked no action';
    case 'bulk_accept': return 'Bulk-accepted recommendations';
    // Incidents
    case 'incident_voided': return 'Near miss voided';
    case 'incident_restored': return 'Near miss restored';
    case 'incident_edited': return 'Near miss edited';
    case 'phi_suspected': return 'Possible patient information in notes';
    // Reports
    case 'report_generated': return 'Report generated';
    case 'report_signed_off': return 'Report signed off';
    case 'report_unlocked': return 'Report unlocked for amendment';
    case 'report_amended': return 'Report amended after sign-off';
    // Passwords / authentication
    case 'password_changed': return 'Pharmacy password changed';
    case 'password_reset_requested': return 'Password reset requested';
    case 'pharmacy_password_reset': return 'Pharmacy password reset via email link';
    case 'founder_password_reset': return 'Password reset by founder (support)';
    case 'founder_login': return 'Founder logged in';
    // Devices
    case 'device_verification_requested': return 'New device tried to log in';
    case 'device_approved': return 'New device approved';
    // Pharmacy profile
    case 'pharmacy_created': return 'Pharmacy account created';
    case 'pharmacy_email_updated': return 'Pharmacy email changed';
    case 'pharmacy_active': return 'Pharmacy reinstated';
    case 'pharmacy_suspended': return 'Pharmacy suspended';
    case 'pharmacy_trial': return 'Pharmacy set to trial';
    // Other entries (founder review)
    case 'other_entry_added': return '"Other" entry added to taxonomy';
    case 'other_entry_dismissed': return '"Other" entry dismissed';
    default: return action.replace(/_/g, ' ');
  }
}

// Friendly labels for the editable report fields. Used when an audit
// entry lists "fields_changed" so the inspector sees real names, not
// snake_case database columns.
function reportFieldLabel(field: string): string {
  switch (field) {
    case 'period_summary': return 'Period summary';
    case 'previous_period_summary': return 'Last period notes';
    case 'agenda_items': return 'Meeting agenda';
    case 'generated_by': return 'Pharmacist-in-charge';
    default: return field.replace(/_/g, ' ');
  }
}

// Per-action detail rows for the expanded view. Returns [label,
// value] pairs in the order to render. `to` makes the value into a
// clickable React Router link — used so an inspector can click
// straight from an audit entry to the report it refers to.
interface AuditDetailRow { label: string; value: string; to?: string }
function auditDetailRows(action: string, details: Record<string, unknown> | null): AuditDetailRow[] {
  const out: AuditDetailRow[] = [];
  if (!details) return out;
  const get = (k: string) => {
    const v = details[k];
    return v === null || v === undefined ? '' : String(v);
  };
  const truncate = (s: string, n = 200) => s.length > n ? `${s.slice(0, n).trim()}…` : s;

  // Recommendations
  if (action.startsWith('recommendation_')) {
    if (get('modified_text')) out.push({ label: 'Modified text', value: get('modified_text') });
    if (get('recommendation_id')) out.push({ label: 'Recommendation ID', value: get('recommendation_id') });
  } else if (action === 'bulk_accept') {
    if (get('count')) out.push({ label: 'Count', value: `${get('count')} recommendations` });
  }
  // Incidents
  else if (action === 'incident_voided' || action === 'incident_edited') {
    if (get('reason')) out.push({ label: 'Reason', value: get('reason') });
    if (get('incident_id')) out.push({ label: 'Near miss ID', value: get('incident_id') });
  } else if (action === 'incident_restored') {
    if (get('incident_id')) out.push({ label: 'Near miss ID', value: get('incident_id') });
  } else if (action === 'phi_suspected') {
    if (get('incident_id')) out.push({ label: 'Near miss ID', value: get('incident_id') });
    const fields = details.fields;
    if (fields && typeof fields === 'object') {
      out.push({ label: 'Fields flagged', value: Object.keys(fields as Record<string, unknown>).join(', ') });
    }
  }
  // Reports
  else if (action === 'report_generated') {
    if (get('period')) out.push({ label: 'Period', value: get('period') });
    if (get('report_id')) out.push({ label: 'View report', value: 'Open this report →', to: `/reports/${get('report_id')}` });
  } else if (action === 'report_signed_off' || action === 'report_unlocked' || action === 'report_amended') {
    if (get('report_period')) out.push({ label: 'Period', value: get('report_period') });
    if (action === 'report_amended') {
      const fieldsChanged = details.fields_changed;
      if (Array.isArray(fieldsChanged) && fieldsChanged.length > 0) {
        out.push({ label: 'Fields changed', value: fieldsChanged.map(f => reportFieldLabel(String(f))).join(', ') });
      }
      // Show before/after for any text fields. Arrays (agenda_items)
      // are noted by name only — the diff is too dense to render
      // sensibly inline.
      const changes = details.changes;
      if (changes && typeof changes === 'object') {
        for (const [field, diff] of Object.entries(changes as Record<string, { old: unknown; new: unknown }>)) {
          if (typeof diff.old === 'string' && typeof diff.new === 'string') {
            out.push({ label: `${reportFieldLabel(field)} — before`, value: truncate(diff.old || '(empty)') });
            out.push({ label: `${reportFieldLabel(field)} — after`, value: truncate(diff.new || '(empty)') });
          }
        }
      }
    }
    if (get('report_id')) out.push({ label: 'View report', value: 'Open this report →', to: `/reports/${get('report_id')}` });
  }
  // Pharmacy profile
  else if (action === 'pharmacy_created') {
    if (get('name')) out.push({ label: 'Pharmacy name', value: get('name') });
  } else if (action === 'pharmacy_email_updated') {
    if (get('old')) out.push({ label: 'Previous email', value: get('old') });
    if (get('new')) out.push({ label: 'New email', value: get('new') });
  }
  // Devices
  else if (action === 'device_verification_requested' || action === 'device_approved') {
    if (get('device_label')) out.push({ label: 'Device', value: get('device_label') });
  }
  return out;
}

export function SettingsPage() {
  const { pharmacyName } = useAuth();
  const [tab, setTab] = useState<Tab>('pharmacy');

  // Password
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  // Pharmacy size
  const [size, setSize] = useState<PharmacySize | null>(null);
  const [sizeMsg, setSizeMsg] = useState('');
  const [sizeLoading, setSizeLoading] = useState(false);

  // Pharmacy-wide custom chips — managed here so the manager can tidy
  // typos or outdated entries without touching the record form.
  type CustomSection = 'stage' | 'error_type' | 'where_caught' | 'factor';
  const SECTION_LABELS: Record<CustomSection, string> = {
    stage: 'Where it happened (step)',
    error_type: 'What went wrong',
    where_caught: 'Where it was caught',
    factor: 'What was happening at the time',
  };
  const [customChips, setCustomChips] = useState<Record<CustomSection, { id: string; label: string }[]>>({
    stage: [], error_type: [], where_caught: [], factor: [],
  });

  // Audit log
  const [auditEntries, setAuditEntries] = useState<{ id: string; action: string; performed_by: string | null; details: Record<string, unknown> | null; created_at: string }[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState<Record<string, boolean>>({});
  const auditLimit = 50;

  // Pharmacy email — destination for password resets and product
  // emails. Editable so the pharmacy can keep it pointing at the
  // right inbox without contacting the founder.
  const [pharmacyEmail, setPharmacyEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailErr, setEmailErr] = useState('');

  useEffect(() => {
    api.getMe().then(me => {
      setSize((me.pharmacySize as PharmacySize | null) || null);
      setPharmacyEmail(me.pharmacyEmail || '');
    }).catch(() => {});
  }, []);

  const handleSaveEmail = async () => {
    setEmailErr(''); setEmailMsg('');
    if (!pharmacyEmail.trim()) { setEmailErr('Email is required'); return; }
    if (!/.+@.+\..+/.test(pharmacyEmail)) { setEmailErr('That email doesn\'t look right'); return; }
    try {
      await api.updatePharmacyEmail(pharmacyEmail.trim());
      setEmailMsg('Saved — change is in the audit log');
    } catch {
      setEmailErr('Could not save — try again');
    }
  };

  useEffect(() => {
    if (tab !== 'pharmacy') return;
    api.listCustomOptions().then(r => setCustomChips(r)).catch(() => {});
  }, [tab]);

  const deleteCustomChip = async (section: CustomSection, id: string, label: string) => {
    if (!window.confirm(`Remove "${label}" from the pharmacy's chips? Other staff won't see it any more.`)) return;
    setCustomChips(prev => ({ ...prev, [section]: prev[section].filter(c => c.id !== id) }));
    try { await api.deleteCustomOption(id); } catch { /* optimistic; reappears on reload if it failed */ }
  };

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
        <button onClick={() => setTab('pharmacy')} className={`btn text-sm ${tab === 'pharmacy' ? 'btn-teal' : 'btn-grey'}`}><Building2 size={14} /> Pharmacy</button>
        <button onClick={() => setTab('audit')} className={`btn text-sm ${tab === 'audit' ? 'btn-teal' : 'btn-grey'}`}><FileText size={14} /> Audit</button>
      </div>

      {tab === 'pharmacy' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
            <h3 className="font-semibold">Pharmacy email</h3>
            <p className="text-xs text-gray-500">Where password-reset links land. When a manager leaves, the new manager uses "Forgot password?" on the login screen — the link comes here.</p>
            {emailMsg && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{emailMsg}</div>}
            {emailErr && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{emailErr}</div>}
            <input type="email" placeholder="hello@your-pharmacy.co.nz" value={pharmacyEmail} onChange={e => { setPharmacyEmail(e.target.value); if (emailMsg) setEmailMsg(''); }} className="input-field" />
            <button onClick={handleSaveEmail} disabled={!pharmacyEmail.trim()} className="btn-teal text-sm">Save email</button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
            <h3 className="font-semibold">Change pharmacy password</h3>
            <p className="text-xs text-gray-500">Used by all staff to log in on the dispensing computer. Change it whenever someone leaves the team.</p>
            {pwdMsg && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{pwdMsg}</div>}
            {pwdErr && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{pwdErr}</div>}
            <input type="password" placeholder="Current password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} className="input-field" />
            <input type="password" placeholder="New password (min 8 characters)" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="input-field" />
            <button onClick={handleChangePassword} disabled={!currentPwd || newPwd.length < 8} className="btn-teal text-sm">Change password</button>
          </div>

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

          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold">Custom chips</h3>
            <p className="text-sm text-gray-500">Anything your team typed via "+ Other" on the recording form. Tidy typos or outdated entries here. Limit 8 per section.</p>
            {(Object.keys(SECTION_LABELS) as CustomSection[]).map(section => {
              const chips = customChips[section];
              return (
                <div key={section} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{SECTION_LABELS[section]}</span>
                    <span className="text-xs text-gray-400">{chips.length}/8</span>
                  </div>
                  {chips.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No custom chips yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map(c => (
                        <span key={c.id} className="inline-flex items-center gap-1.5 text-xs bg-gray-100 border border-dashed border-gray-300 rounded-full px-2.5 py-1 text-gray-800">
                          {c.label}
                          <button
                            onClick={() => deleteCustomChip(section, c.id, c.label)}
                            className="text-gray-400 hover:text-red-600 leading-none"
                            aria-label={`Remove ${c.label}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
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
                            {r.to ? (
                              <Link to={r.to} className="text-[#0F6E56] hover:underline font-medium">{r.value}</Link>
                            ) : (
                              <span className="text-gray-800 break-all whitespace-pre-wrap">{r.value}</span>
                            )}
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
