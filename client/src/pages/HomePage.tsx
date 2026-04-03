import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Logo } from '../components/Logo';
import { ClipboardPlus, Shield, Lock } from 'lucide-react';

export function HomePage() {
  const { pharmacyName, pinEnabled, upgradeToManager } = useAuth();
  const [count, setCount] = useState(0);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const nav = useNavigate();

  useEffect(() => { api.getMonthlyCount().then(r => setCount(r.count)).catch(() => {}); }, []);

  const handleManager = async () => {
    try {
      const res = await api.managerAccess();
      if (res.requiresPin) { setShowPin(true); return; }
      if (res.token) { upgradeToManager(res.token); nav('/dashboard'); }
    } catch { /* ignore */ }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setPinError('');
    try {
      const res = await api.verifyPin(pin);
      upgradeToManager(res.token);
      nav('/dashboard');
    } catch { setPinError('Invalid PIN'); }
  };

  if (showPin) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
        <Lock size={40} className="text-[#0F6E56] mb-4" />
        <h2 className="text-xl font-bold mb-4">Manager PIN</h2>
        {pinError && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded-lg text-sm">{pinError}</div>}
        <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-4">
          <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="input-field text-center text-3xl tracking-[0.5em] font-mono" autoFocus placeholder="••••" />
          <button type="submit" disabled={pin.length < 4} className="btn-teal w-full">Verify</button>
          <button type="button" onClick={() => { setShowPin(false); setPin(''); }} className="btn-outline w-full">Cancel</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <Logo size="lg" />
      <p className="text-gray-500 mt-2 mb-1">{pharmacyName}</p>
      <p className="text-sm text-gray-400 mb-8">{count} incident{count !== 1 ? 's' : ''} this month</p>

      <button onClick={() => nav('/record')} className="btn-teal text-lg px-8 py-4 rounded-2xl flex items-center gap-3 min-h-[56px] shadow-lg hover:shadow-xl transition-shadow">
        <ClipboardPlus size={24} /> Record a near miss
      </button>

      <button onClick={handleManager} className="mt-6 flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F6E56] transition-colors">
        <Shield size={16} /> Manager {pinEnabled ? '(PIN required)' : ''}
      </button>
    </div>
  );
}
