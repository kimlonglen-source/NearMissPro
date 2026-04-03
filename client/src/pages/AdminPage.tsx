import { useState, useEffect } from 'react';
import { api } from '../lib/api';

type Tab = 'overview' | 'other' | 'pharmacies' | 'audit';
type Health = { totalPharmacies: number; activePharmacies: number; inactivePharmacies: number; incidentsThisMonth: number; incidentsLastMonth: number; otherEntriesPending: number };
type OtherEntry = { id: string; category: string; text: string; review_outcome: string | null; created_at: string; pharmacy_id: string };
type Pharmacy = { id: string; name: string; subscription_status: string; created_at: string; incidentsThisMonth: number; lastActive: string | null };
type AuditEntry = { id: string; action: string; actor: string; target: string; detail: string; created_at: string };

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' }, { key: 'other', label: 'Other Entries' },
  { key: 'pharmacies', label: 'Pharmacies' }, { key: 'audit', label: 'Audit Log' },
];

const CHECKLIST = ['Account created', 'Manager first login', 'PWA installed', 'First incident submitted', 'First review completed'];

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

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [health, setHealth] = useState<Health | null>(null);
  const [others, setOthers] = useState<OtherEntry[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
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

  // Group other entries by normalized text
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

  // Onboarding checklist mock logic (derive from available data)
  const checklistFor = (p: Pharmacy) => [
    true, // Account created — always true if row exists
    !!p.lastActive, // Manager first login
    daysSince(p.created_at) >= 1 && !!p.lastActive, // PWA installed (heuristic)
    p.incidentsThisMonth > 0, // First incident
    p.incidentsThisMonth > 0 && !!p.lastActive, // First review (heuristic)
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Founder Admin Panel</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#0F6E56] text-[#0F6E56]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && health && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="Active Pharmacies" value={health.activePharmacies} />
          <Card label="Incidents This Month" value={health.incidentsThisMonth} />
          <Card label="Reporting Trend" value={`${trend >= 0 ? '+' : ''}${trend}%`} sub="vs last month" />
          <Card label="Inactive 30+ Days" value={health.inactivePharmacies} alert={health.inactivePharmacies > 0} />
        </div>
      )}

      {/* Other Entries */}
      {tab === 'other' && (
        <div className="space-y-3">
          {groupedList.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No pending entries.</p>}
          {groupedList.map(g => (
            <div key={g.text} className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{g.text}</span>
                  {g.pharmacyIds.size >= 3 && (
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{g.pharmacyIds.size} pharmacies</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">Category: {g.category} | {g.ids.length} occurrence{g.ids.length > 1 ? 's' : ''} from {g.pharmacyIds.size} pharmacy{g.pharmacyIds.size > 1 ? 'ies' : ''}</span>
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
          <div className="flex justify-end mb-4">
            <button className="btn-teal" onClick={() => setShowCreate(!showCreate)}>Create Pharmacy</button>
          </div>

          {showCreate && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4 space-y-3">
              <h3 className="text-sm font-bold">New Pharmacy</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input className="input-field" placeholder="Pharmacy name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input className="input-field" placeholder="Password *" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                <input className="input-field" placeholder="Manager email *" value={form.managerEmail} onChange={e => setForm({ ...form, managerEmail: e.target.value })} />
                <input className="input-field" placeholder="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                <input className="input-field" placeholder="Licence number" value={form.licenceNumber} onChange={e => setForm({ ...form, licenceNumber: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <button className="btn-grey text-xs" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn-teal text-xs" disabled={busy || !form.name || !form.password || !form.managerEmail} onClick={handleCreatePharmacy}>Create</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-4">Pharmacy</th><th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Last Active</th><th className="py-2 pr-4">Incidents</th>
                <th className="py-2 pr-4">Onboarding</th><th className="py-2">Actions</th>
              </tr></thead>
              <tbody>
                {pharmacies.map(p => {
                  const inactive30 = daysSince(p.lastActive) >= 30;
                  const checks = checklistFor(p);
                  return (
                    <tr key={p.id} className={`border-b ${inactive30 ? 'border-l-4 border-l-red-500' : ''}`}>
                      <td className="py-3 pr-4 font-medium">{p.name}</td>
                      <td className="py-3 pr-4">{statusPill(p.subscription_status)}</td>
                      <td className="py-3 pr-4 text-gray-600">{p.lastActive ? new Date(p.lastActive).toLocaleDateString() : 'Never'}</td>
                      <td className="py-3 pr-4">{p.incidentsThisMonth}</td>
                      <td className="py-3 pr-4">
                        <button className="text-xs text-[#0F6E56] underline" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                          {checks.filter(Boolean).length}/{CHECKLIST.length}
                        </button>
                        {expanded === p.id && (
                          <ul className="mt-2 space-y-1">
                            {CHECKLIST.map((item, i) => (
                              <li key={item} className="flex items-center gap-1.5 text-xs">
                                <span className={checks[i] ? 'text-green-600' : 'text-gray-300'}>{checks[i] ? '\u2713' : '\u25CB'}</span>
                                <span className={checks[i] ? 'text-gray-700' : 'text-gray-400'}>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-3">
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
        </div>
      )}

      {/* Audit Log */}
      {tab === 'audit' && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-4">Timestamp</th><th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Actor</th><th className="py-2 pr-4">Target</th><th className="py-2">Detail</th>
              </tr></thead>
              <tbody>
                {audit.map(e => (
                  <tr key={e.id} className="border-b">
                    <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4 font-medium">{e.action}</td>
                    <td className="py-2 pr-4">{e.actor}</td>
                    <td className="py-2 pr-4">{e.target}</td>
                    <td className="py-2 text-gray-600 truncate max-w-xs">{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

function Card({ label, value, sub, alert }: { label: string; value: string | number; sub?: string; alert?: boolean }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border p-4 ${alert ? 'border-red-400' : 'border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
