import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

type Tab = 'overview' | 'other' | 'pharmacies' | 'audit';
type Health = { totalPharmacies: number; activePharmacies: number; inactivePharmacies: number; incidentsThisMonth: number; incidentsLastMonth: number; otherEntriesPending: number };
type OtherEntry = { id: string; category: string; text: string; review_outcome: string | null; created_at: string; pharmacy_id: string };
type Pharmacy = { id: string; name: string; subscription_status: string; created_at: string; incidentsThisMonth: number; lastActive: string | null };
type AuditEntry = { id: string; action: string; actor: string; target: string; detail: string; created_at: string };

const TABS: { key: Tab; label: string; subtitle: string }[] = [
  { key: 'overview', label: 'Overview', subtitle: 'How NearMissPro is doing across all your pharmacies.' },
  { key: 'other', label: 'Suggestions', subtitle: 'Things staff typed into "Other" boxes — patterns to fold into the app.' },
  { key: 'pharmacies', label: 'Pharmacies', subtitle: 'Every pharmacy account: status, activity, onboarding, suspend/reinstate.' },
  { key: 'audit', label: 'Audit log', subtitle: 'Every action across every pharmacy — proof for inspectors.' },
];

const CHECKLIST = ['Account created', 'Manager first login', 'PWA installed', 'First near miss submitted', 'First review completed'];

function daysSince(date: string | null) {
  if (!date) return Infinity;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function statusPill(s: string) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800', trial: 'bg-blue-100 text-blue-800',
    inactive: 'bg-red-100 text-red-800', suspended: 'bg-red-100 text-red-800',
  };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[s] || 'bg-gray-100 text-gray-600'}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>;
}

// Plain-English label for the audit action column. Mirrors the manager
// Settings → Audit log so the same vocabulary is used everywhere a
// regulator might read.
function auditActionLabel(action: string): string {
  switch (action) {
    case 'recommendation_accepted': return 'Recommendation accepted';
    case 'recommendation_modified': return 'Recommendation modified';
    case 'recommendation_no_action': return 'Recommendation marked no action';
    case 'bulk_accept': return 'Bulk-accepted recommendations';
    case 'incident_voided': return 'Near miss voided';
    case 'incident_restored': return 'Near miss restored';
    case 'incident_edited': return 'Near miss edited';
    case 'phi_suspected': return 'Possible patient identifier in notes';
    case 'report_generated': return 'Report generated';
    case 'pin_enabled': return 'Manager PIN enabled';
    case 'pin_disabled': return 'Manager PIN disabled';
    case 'pin_changed': return 'Manager PIN changed';
    case 'password_changed': return 'Password changed';
    case 'pharmacy_created': return 'Pharmacy created';
    case 'founder_login': return 'Founder logged in';
    default: return action.replace(/_/g, ' ');
  }
}

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [health, setHealth] = useState<Health | null>(null);
  const [others, setOthers] = useState<OtherEntry[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditExpanded, setAuditExpanded] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', password: '', managerEmail: '', address: '', licenceNumber: '' });
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadHealth = () => api.getAdminHealth().then(d => setHealth(d as unknown as Health));
  const loadOthers = () => api.getOtherEntries().then(d => setOthers(d as unknown as OtherEntry[]));
  const loadPharmacies = () => api.getPharmacyStats().then(d => setPharmacies(d as unknown as Pharmacy[]));
  const loadAudit = (p = 1) => api.getAuditLog(p).then(d => { setAudit(d.entries as unknown as AuditEntry[]); setAuditTotal(d.total); });

  useEffect(() => { loadHealth(); }, []);
  useEffect(() => { if (tab === 'other') loadOthers(); }, [tab]);
  useEffect(() => { if (tab === 'pharmacies') loadPharmacies(); }, [tab]);
  useEffect(() => { if (tab === 'audit') loadAudit(auditPage); }, [tab, auditPage]);

  const trend = health && health.incidentsLastMonth > 0
    ? Math.round(((health.incidentsThisMonth - health.incidentsLastMonth) / health.incidentsLastMonth) * 100) : 0;

  const grouped = others.filter(e => !e.review_outcome).reduce<Record<string, { text: string; ids: string[]; pharmacyIds: Set<string>; category: string }>>((acc, e) => {
    const key = e.text.trim().toLowerCase();
    if (!acc[key]) acc[key] = { text: e.text, ids: [e.id], pharmacyIds: new Set([e.pharmacy_id]), category: e.category };
    else { acc[key].ids.push(e.id); acc[key].pharmacyIds.add(e.pharmacy_id); }
    return acc;
  }, {});
  const groupedList = Object.values(grouped).sort((a, b) => b.ids.length - a.ids.length);

  const handleAction = async (ids: string[], outcome: 'added' | 'dismissed') => {
    setBusy(true);
    try {
      await Promise.all(ids.map(id => api.actionOtherEntry(id, outcome)));
      await loadOthers();
    } finally { setBusy(false); }
  };

  const handleCreatePharmacy = async () => {
    if (!form.name || !form.password || !form.managerEmail) return;
    setBusy(true);
    try {
      await api.createPharmacy({ name: form.name, password: form.password, managerEmail: form.managerEmail,
        ...(form.address ? { address: form.address } : {}), ...(form.licenceNumber ? { licenceNumber: form.licenceNumber } : {}),
      });
      setForm({ name: '', password: '', managerEmail: '', address: '', licenceNumber: '' });
      setShowCreate(false); await loadPharmacies();
    } finally { setBusy(false); }
  };

  const handleStatus = async (id: string, status: 'active' | 'suspended') => {
    setBusy(true);
    try { await api.updatePharmacyStatus(id, status); await loadPharmacies(); } finally { setBusy(false); }
  };

  const checklistFor = (p: Pharmacy) => [
    true,
    !!p.lastActive,
    daysSince(p.created_at) >= 1 && !!p.lastActive,
    p.incidentsThisMonth > 0,
    p.incidentsThisMonth > 0 && !!p.lastActive,
  ];

  const tabMeta = TABS.find(t => t.key === tab)!;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-1">Founder panel</h1>
      <p className="text-sm text-gray-500 mb-6">Your view across every pharmacy using NearMissPro.</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#0F6E56] text-[#0F6E56]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-500 mb-6">{tabMeta.subtitle}</p>

      {/* Overview */}
      {tab === 'overview' && (
        <>
          {!health && <p className="text-sm text-gray-400">Loading…</p>}
          {health && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card label="Active pharmacies" value={health.activePharmacies} sub={`${health.totalPharmacies} total`} hint="Pharmacies whose subscription is currently active." />
              <Card label="Near misses this month" value={health.incidentsThisMonth} hint="Total across every pharmacy this calendar month." />
              <Card label="Reporting trend" value={`${trend >= 0 ? '+' : ''}${trend}%`} sub="vs last month" hint="Change in total near misses month-on-month. A drop can mean fewer errors — OR under-reporting." />
              <Card label="Inactive 30+ days" value={health.inactivePharmacies} alert={health.inactivePharmacies > 0} hint="Pharmacies that haven't used the app in over a month. Worth a check-in call." />
            </div>
          )}
        </>
      )}

      {/* Suggestions (was: Other Entries) */}
      {tab === 'other' && (
        <div className="space-y-3">
          {groupedList.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">No suggestions pending.</p>
              <p className="text-xs text-gray-400 mt-1">When staff type their own description into an "Other" box, it'll show up here for you to add to the official list — or dismiss.</p>
            </div>
          )}
          {groupedList.map(g => (
            <div key={g.text} className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{g.text}</span>
                  {g.pharmacyIds.size >= 3 && (
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{g.pharmacyIds.size} pharmacies</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{g.category} · {g.ids.length} time{g.ids.length > 1 ? 's' : ''} from {g.pharmacyIds.size} pharmacy{g.pharmacyIds.size > 1 ? 'ies' : ''}</span>
              </div>
              <button className="btn-teal text-xs" disabled={busy} onClick={() => handleAction(g.ids, 'added')}>Add to list</button>
              <button className="btn-grey text-xs" disabled={busy} onClick={() => handleAction(g.ids, 'dismissed')}>Dismiss</button>
            </div>
          ))}
        </div>
      )}

      {/* Pharmacies */}
      {tab === 'pharmacies' && (
        <div>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <p className="text-xs text-gray-500 max-w-2xl flex items-start gap-1.5">
              <Info size={14} className="text-gray-400 mt-[2px] flex-shrink-0" />
              <span>Pharmacies don't sign themselves up — you create their account here, then share the password with their manager. Suspending blocks login without deleting data; reinstate brings them back.</span>
            </p>
            <button className="btn-teal" onClick={() => setShowCreate(!showCreate)}>{showCreate ? 'Cancel' : '+ Add pharmacy'}</button>
          </div>

          {showCreate && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4 space-y-3">
              <h3 className="text-sm font-bold">New pharmacy</h3>
              <p className="text-xs text-gray-500">All staff will use this one password to log into the app. The manager email is for your records — there's no automated email sent yet.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input className="input-field" placeholder="Pharmacy name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input className="input-field" placeholder="Pharmacy password *" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                <input className="input-field" placeholder="Manager email *" value={form.managerEmail} onChange={e => setForm({ ...form, managerEmail: e.target.value })} />
                <input className="input-field" placeholder="Address (optional)" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                <input className="input-field" placeholder="Licence number (optional)" value={form.licenceNumber} onChange={e => setForm({ ...form, licenceNumber: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <button className="btn-grey text-xs" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn-teal text-xs" disabled={busy || !form.name || !form.password || !form.managerEmail} onClick={handleCreatePharmacy}>Create pharmacy</button>
              </div>
            </div>
          )}

          {pharmacies.length === 0 && !showCreate && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">No pharmacies yet.</p>
              <p className="text-xs text-gray-400 mt-1">Click "Add pharmacy" above to create your first account.</p>
            </div>
          )}

          {pharmacies.length > 0 && (
            <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                  <th className="py-2 px-4">Pharmacy</th><th className="py-2 px-4">Status</th>
                  <th className="py-2 px-4">Last active</th><th className="py-2 px-4">Near misses this month</th>
                  <th className="py-2 px-4">Setup progress</th><th className="py-2 px-4">Actions</th>
                </tr></thead>
                <tbody>
                  {pharmacies.map(p => {
                    const inactive30 = daysSince(p.lastActive) >= 30;
                    const checks = checklistFor(p);
                    return (
                      <tr key={p.id} className={`border-b ${inactive30 ? 'border-l-4 border-l-red-500' : ''}`}>
                        <td className="py-3 px-4 font-medium">{p.name}</td>
                        <td className="py-3 px-4">{statusPill(p.subscription_status)}</td>
                        <td className="py-3 px-4 text-gray-600">{p.lastActive ? new Date(p.lastActive).toLocaleDateString() : 'Never'}</td>
                        <td className="py-3 px-4">{p.incidentsThisMonth}</td>
                        <td className="py-3 px-4">
                          <button className="text-xs text-[#0F6E56] underline" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                            {checks.filter(Boolean).length}/{CHECKLIST.length} done
                          </button>
                          {expanded === p.id && (
                            <ul className="mt-2 space-y-1">
                              {CHECKLIST.map((item, i) => (
                                <li key={item} className="flex items-center gap-1.5 text-xs">
                                  <span className={checks[i] ? 'text-green-600' : 'text-gray-300'}>{checks[i] ? '✓' : '○'}</span>
                                  <span className={checks[i] ? 'text-gray-700' : 'text-gray-400'}>{item}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {p.subscription_status === 'suspended'
                            ? <button className="btn-teal text-xs" disabled={busy} onClick={() => handleStatus(p.id, 'active')}>Reinstate</button>
                            : <button className="btn-red text-xs" disabled={busy} onClick={() => handleStatus(p.id, 'suspended')}>Suspend</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Audit Log */}
      {tab === 'audit' && (
        <div>
          {audit.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">No audit entries yet.</p>
              <p className="text-xs text-gray-400 mt-1">Every action — voids, restores, recommendations, founder logins — will appear here as people use the app.</p>
            </div>
          )}
          {audit.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {audit.map(e => {
                const expanded = !!auditExpanded[e.id];
                const hasDetail = !!e.detail && e.detail.trim().length > 0;
                return (
                  <div key={e.id} className="px-4 py-3 text-sm">
                    <button
                      onClick={() => hasDetail && setAuditExpanded(s => ({ ...s, [e.id]: !s[e.id] }))}
                      className={`w-full text-left ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
                      disabled={!hasDetail}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="font-medium text-gray-900 flex items-center gap-1">
                          {hasDetail && (expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />)}
                          {auditActionLabel(e.action)}
                        </span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 ml-[18px]">
                        {e.actor || 'system'}{e.target ? ` · ${e.target}` : ''}
                      </div>
                    </button>
                    {expanded && hasDetail && (
                      <div className="mt-2 ml-[18px] p-3 bg-gray-50 rounded-lg text-xs text-gray-700 break-all">
                        {e.detail}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {auditTotal > 50 && (
            <div className="flex justify-center gap-2 mt-4">
              <button className="btn-outline text-xs" disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)}>Previous</button>
              <span className="text-sm text-gray-500 py-1">Page {auditPage}</span>
              <button className="btn-outline text-xs" disabled={audit.length < 50} onClick={() => setAuditPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ label, value, sub, alert, hint }: { label: string; value: string | number; sub?: string; alert?: boolean; hint?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border p-4 ${alert ? 'border-red-400' : 'border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {hint && <p className="text-[11px] text-gray-400 mt-2 leading-snug">{hint}</p>}
    </div>
  );
}
