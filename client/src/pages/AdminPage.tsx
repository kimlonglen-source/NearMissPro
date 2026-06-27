import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Info } from 'lucide-react';

type Tab = 'overview' | 'other' | 'pharmacies';
type Health = { totalPharmacies: number; activePharmacies: number; inactivePharmacies: number; incidentsThisMonth: number; incidentsLastMonth: number; otherEntriesPending: number };
type OtherEntry = { id: string; category: string; text: string; review_outcome: string | null; created_at: string; pharmacy_id: string };
type Pharmacy = {
  id: string;
  name: string;
  subscription_status: string;
  created_at: string;
  incidentsThisMonth: number;
  lastActive: string | null;
  manager_name?: string | null;
  manager_email?: string | null;
  phone?: string | null;
  address?: string | null;
  licence_number?: string | null;
  pharmacy_size?: string | null;
  applied_at?: string | null;
  approved_at?: string | null;
  signup_notes?: string | null;
  signup_source?: string | null;
};

const TABS: { key: Tab; label: string; subtitle: string }[] = [
  { key: 'overview', label: 'Overview', subtitle: 'How NearMissPro is doing across all your pharmacies.' },
  { key: 'other', label: 'Suggestions', subtitle: 'Things staff typed into "Other" boxes — patterns to fold into the app.' },
  { key: 'pharmacies', label: 'Pharmacies', subtitle: 'Every pharmacy account: status, activity, onboarding, suspend/reinstate.' },
];

const CHECKLIST = ['Account created', 'First staff login', 'PWA installed', 'First near miss submitted', 'First review completed'];

function daysSince(date: string | null) {
  if (!date) return Infinity;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function statusPill(s: string) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800', trial: 'bg-blue-100 text-blue-800',
    inactive: 'bg-red-100 text-red-800', suspended: 'bg-red-100 text-red-800',
    pending_approval: 'bg-amber-100 text-amber-800', declined: 'bg-gray-200 text-gray-600',
  };
  const label = s === 'pending_approval' ? 'Pending review' : s.charAt(0).toUpperCase() + s.slice(1);
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[s] || 'bg-gray-100 text-gray-600'}`}>{label}</span>;
}

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [health, setHealth] = useState<Health | null>(null);
  const [others, setOthers] = useState<OtherEntry[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Per-pharmacy temp password shown once after a founder-mediated
  // reset — keyed by pharmacy id so each row can hold its own.
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});

  const loadHealth = () => api.getAdminHealth().then(d => setHealth(d as unknown as Health));
  const loadOthers = () => api.getOtherEntries().then(d => setOthers(d as unknown as OtherEntry[]));
  const loadPharmacies = () => api.getPharmacyStats().then(d => setPharmacies(d as unknown as Pharmacy[]));

  useEffect(() => { loadHealth(); }, []);
  useEffect(() => { if (tab === 'other') loadOthers(); }, [tab]);
  useEffect(() => { if (tab === 'pharmacies') loadPharmacies(); }, [tab]);

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

  const handleStatus = async (id: string, status: 'active' | 'suspended') => {
    setBusy(true);
    try { await api.updatePharmacyStatus(id, status); await loadPharmacies(); } finally { setBusy(false); }
  };

  const handleResetPassword = async (id: string, name: string) => {
    if (!window.confirm(`Reset the pharmacy password for "${name}"?\n\nThe current password will stop working immediately. A temporary password will appear on screen — copy it and send it to the pharmacy through a channel you trust (text, phone). They can change it themselves from Settings after they log in.`)) return;
    setBusy(true);
    try {
      const res = await api.founderResetPharmacyPassword(id);
      setTempPasswords(prev => ({ ...prev, [id]: res.temporaryPassword }));
    } catch {
      window.alert('Reset failed — try again.');
    } finally {
      setBusy(false);
    }
  };

  const dismissTempPassword = (id: string) => {
    setTempPasswords(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleApprove = async (id: string, name: string) => {
    if (!window.confirm(`Approve "${name}"? An email with a "set your password" link will be sent to the dispensary email.`)) return;
    setBusy(true);
    try {
      await api.approvePharmacy(id);
      await loadPharmacies();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Approval failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async (id: string, name: string, reason?: string) => {
    if (!window.confirm(`Decline "${name}"?${reason ? `\n\nReason that will be emailed:\n"${reason}"` : '\n\n(No reason will be included in the email — they\'ll just be told it wasn\'t approved.)'}\n\nThis can't be undone — to onboard them later they'd need to apply again.`)) return;
    setBusy(true);
    try {
      await api.declinePharmacy(id, reason);
      await loadPharmacies();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Decline failed.');
    } finally {
      setBusy(false);
    }
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
              <Card label="Reporting trend" value={`${trend >= 0 ? '+' : ''}${trend}%`} sub="vs last month" hint="Change in total near misses month-on-month. A drop can mean fewer near misses actually happening — OR under-reporting." />
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
          <p className="text-xs text-gray-500 mb-4 flex items-start gap-1.5">
            <Info size={14} className="text-gray-400 mt-[2px] flex-shrink-0" />
            <span>Pharmacies sign themselves up via the marketing site. New applications appear here as <strong>Pending review</strong> — approve to send them a "set your password" email, decline to email them back with a reason.</span>
          </p>

          {/* Pending review queue — surfaced separately at the top
              because it's actionable: every pending pharmacy is
              waiting on you. */}
          {pharmacies.filter(p => p.subscription_status === 'pending_approval').length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Pending review</h3>
              <div className="space-y-3">
                {pharmacies.filter(p => p.subscription_status === 'pending_approval').map(p => (
                  <PendingApplicationCard
                    key={p.id}
                    pharmacy={p}
                    busy={busy}
                    onApprove={() => handleApprove(p.id, p.name)}
                    onDecline={(reason) => handleDecline(p.id, p.name, reason)}
                  />
                ))}
              </div>
            </div>
          )}

          {pharmacies.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">No pharmacies yet.</p>
              <p className="text-xs text-gray-400 mt-1">When someone signs up via <code>/signup</code>, their application will appear here for review.</p>
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
                  {pharmacies.filter(p => p.subscription_status !== 'pending_approval').map(p => {
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
                          <div className="flex flex-col gap-1.5">
                            {p.subscription_status === 'suspended'
                              ? <button className="btn-teal text-xs" disabled={busy} onClick={() => handleStatus(p.id, 'active')}>Reinstate</button>
                              : <button className="btn-red text-xs" disabled={busy} onClick={() => handleStatus(p.id, 'suspended')}>Suspend</button>}
                            <button className="btn-grey text-xs" disabled={busy} onClick={() => handleResetPassword(p.id, p.name)}>Reset password</button>
                          </div>
                          {tempPasswords[p.id] && (
                            <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs">
                              <p className="font-semibold text-amber-900 mb-1">Temporary password — shown ONCE</p>
                              <code className="block bg-white border border-amber-200 px-2 py-1.5 rounded text-sm font-mono break-all select-all">{tempPasswords[p.id]}</code>
                              <p className="mt-1.5 text-amber-800 leading-snug">Send to the pharmacy via a channel you trust. They should change it from Settings after logging in.</p>
                              <button onClick={() => dismissTempPassword(p.id)} className="mt-1.5 text-amber-700 underline">I've copied it, dismiss</button>
                            </div>
                          )}
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

// One pending application — surfaces every detail the pharmacy
// entered, plus Approve / Decline buttons. Decline reason is
// optional but encouraged; goes straight into the rejection email.
function PendingApplicationCard({ pharmacy, busy, onApprove, onDecline }: {
  pharmacy: Pharmacy;
  busy: boolean;
  onApprove: () => void;
  onDecline: (reason?: string) => void;
}) {
  const [reason, setReason] = useState('');
  const fmt = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const sizeLabel = pharmacy.pharmacy_size === 'sole' ? 'Sole pharmacist'
    : pharmacy.pharmacy_size === 'pharmacist_plus_tech' ? 'Pharmacist + tech'
    : pharmacy.pharmacy_size === 'multi' ? 'Two or more pharmacists' : '—';
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{pharmacy.name}</h4>
          <p className="text-xs text-gray-500">Applied {fmt(pharmacy.applied_at)}</p>
        </div>
        <span className="bg-amber-200 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">Pending review</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
        <DetailRow label="Manager" value={pharmacy.manager_name || '—'} />
        <DetailRow label="Email" value={pharmacy.manager_email || '—'} />
        <DetailRow label="Phone" value={pharmacy.phone || '—'} />
        <DetailRow label="Address" value={pharmacy.address || '—'} />
        <DetailRow label="Licence" value={pharmacy.licence_number || '—'} />
        <DetailRow label="Size" value={sizeLabel} />
        {pharmacy.signup_source && <DetailRow label="Heard via" value={pharmacy.signup_source} />}
      </div>
      {pharmacy.signup_notes && (
        <div className="mb-3 p-2 bg-white border border-amber-200 rounded text-xs">
          <span className="font-medium text-gray-700">Notes:</span>{' '}
          <span className="text-gray-800 whitespace-pre-wrap">{pharmacy.signup_notes}</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <div className="flex-1">
          <label className="text-[11px] text-gray-600 block mb-1">Decline reason (optional — sent in email if you decline)</label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. We don't currently support hospital pharmacies"
            className="input-field text-sm w-full"
          />
        </div>
        <div className="flex gap-2">
          <button className="btn-teal text-xs whitespace-nowrap" disabled={busy} onClick={onApprove}>Approve</button>
          <button className="btn-grey text-xs whitespace-nowrap" disabled={busy} onClick={() => onDecline(reason.trim() || undefined)}>Decline</button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 text-xs uppercase tracking-wide font-medium w-16 flex-shrink-0">{label}</span>
      <span className="text-gray-800 break-all">{value}</span>
    </div>
  );
}
