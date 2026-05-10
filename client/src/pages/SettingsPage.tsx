import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Lock, Key, Shield, Building2, FileText } from 'lucide-react';

type Tab = 'security' | 'password' | 'pharmacy' | 'audit';
type PharmacySize = 'sole' | 'pharmacist_plus_tech' | 'multi';

const SIZE_LABELS: Record<PharmacySize, { title: string; help: string }> = {
  sole: { title: 'Sole pharmacist', help: 'Just one pharmacist on duty (no second checker).' },
  pharmacist_plus_tech: { title: 'Pharmacist + tech', help: 'One pharmacist with one or more technicians.' },
  multi: { title: 'Two or more pharmacists', help: 'Two or more pharmacists rostered together.' },
};

export function SettingsPage() {
  const { pharmacyName } = useAuth();
  const [tab, setTab] = useState<Tab>('security');

  // PIN
  const [pinAction, setPinAction] = useState<'' | 'enable' | 'disable' | 'change'>('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [pinErr, setPinErr] = useState('');

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

  const handleEnablePin = async () => {
    if (pin.length < 4 || pin !== confirmPin) { setPinErr('PINs must match and be 4-6 digits'); return; }
    try {
      await api.enablePin(pin);
      setPinMsg('PIN enabled'); setPinAction(''); setPin(''); setConfirmPin('');
    } catch { setPinErr('Failed to enable PIN'); }
  };

  const handleDisablePin = async () => {
    try {
      await api.disablePin(currentPin);
      setPinMsg('PIN disabled'); setPinAction(''); setCurrentPin('');
    } catch { setPinErr('Invalid PIN'); }
  };

  const handleChangePin = async () => {
    if (newPin.length < 4) { setPinErr('New PIN must be 4-6 digits'); return; }
    try {
      await api.changePin(currentPin, newPin);
      setPinMsg('PIN changed'); setPinAction(''); setCurrentPin(''); setNewPin('');
    } catch { setPinErr('Invalid current PIN'); }
  };

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
        <button onClick={() => setTab('security')} className={`btn text-sm ${tab === 'security' ? 'btn-teal' : 'btn-grey'}`}><Lock size={14} /> Security</button>
        <button onClick={() => setTab('password')} className={`btn text-sm ${tab === 'password' ? 'btn-teal' : 'btn-grey'}`}><Key size={14} /> Password</button>
        <button onClick={() => setTab('pharmacy')} className={`btn text-sm ${tab === 'pharmacy' ? 'btn-teal' : 'btn-grey'}`}><Building2 size={14} /> Pharmacy</button>
        <button onClick={() => setTab('audit')} className={`btn text-sm ${tab === 'audit' ? 'btn-teal' : 'btn-grey'}`}><FileText size={14} /> Audit</button>
      </div>

      {tab === 'security' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Shield size={18} /> Manager PIN</h3>
          <p className="text-sm text-gray-500">Optional PIN to protect manager access on shared devices.</p>
          {pinMsg && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{pinMsg}</div>}
          {pinErr && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{pinErr}</div>}

          {!pinAction && (
            <div className="flex gap-2">
              <button onClick={() => { setPinAction('enable'); setPinMsg(''); setPinErr(''); }} className="btn-teal text-sm">Enable PIN</button>
              <button onClick={() => { setPinAction('disable'); setPinMsg(''); setPinErr(''); }} className="btn-outline text-sm">Disable PIN</button>
              <button onClick={() => { setPinAction('change'); setPinMsg(''); setPinErr(''); }} className="btn-outline text-sm">Change PIN</button>
            </div>
          )}

          {pinAction === 'enable' && (
            <div className="space-y-3">
              <input type="password" inputMode="numeric" maxLength={6} placeholder="Enter PIN (4-6 digits)" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="input-field" />
              <input type="password" inputMode="numeric" maxLength={6} placeholder="Confirm PIN" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="input-field" />
              <div className="flex gap-2"><button onClick={handleEnablePin} className="btn-teal text-sm">Save</button><button onClick={() => setPinAction('')} className="btn-grey text-sm">Cancel</button></div>
            </div>
          )}
          {pinAction === 'disable' && (
            <div className="space-y-3">
              <input type="password" inputMode="numeric" maxLength={6} placeholder="Enter current PIN" value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="input-field" />
              <div className="flex gap-2"><button onClick={handleDisablePin} className="btn-red text-sm">Disable PIN</button><button onClick={() => setPinAction('')} className="btn-grey text-sm">Cancel</button></div>
            </div>
          )}
          {pinAction === 'change' && (
            <div className="space-y-3">
              <input type="password" inputMode="numeric" maxLength={6} placeholder="Current PIN" value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="input-field" />
              <input type="password" inputMode="numeric" maxLength={6} placeholder="New PIN" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="input-field" />
              <div className="flex gap-2"><button onClick={handleChangePin} className="btn-teal text-sm">Change</button><button onClick={() => setPinAction('')} className="btn-grey text-sm">Cancel</button></div>
            </div>
          )}
        </div>
      )}

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
                const reason = (e.details && typeof e.details === 'object' && 'reason' in e.details) ? String((e.details as Record<string, unknown>).reason || '') : '';
                return (
                  <div key={e.id} className="px-2 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900">{e.action.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{e.performed_by || 'system'}</div>
                    {reason && <div className="text-xs text-gray-700 mt-1 italic">"{reason}"</div>}
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
