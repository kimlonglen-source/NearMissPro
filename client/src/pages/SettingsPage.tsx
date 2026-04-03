import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Settings, Lock, Key, Shield } from 'lucide-react';

export function SettingsPage() {
  const { pharmacyName } = useAuth();
  const [tab, setTab] = useState<'security' | 'password'>('security');

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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">{pharmacyName}</p>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('security')} className={`btn text-sm ${tab === 'security' ? 'btn-teal' : 'btn-grey'}`}><Lock size={14} /> Security</button>
        <button onClick={() => setTab('password')} className={`btn text-sm ${tab === 'password' ? 'btn-teal' : 'btn-grey'}`}><Key size={14} /> Password</button>
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
    </div>
  );
}
