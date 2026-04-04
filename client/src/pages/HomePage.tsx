import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ShieldIcon } from '../components/Logo';
import { ClipboardPlus, LayoutDashboard, Lock } from 'lucide-react';

export function HomePage() {
  const { pharmacyName, pinEnabled, upgradeToManager, role } = useAuth();
  const [count, setCount] = useState(0);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const nav = useNavigate();

  useEffect(() => { api.getMonthlyCount().then(r => setCount(r.count)).catch(() => {}); }, []);

  // If already manager, redirect to dashboard
  useEffect(() => { if (role === 'manager') return; }, [role]);

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
        <h2 className="text-xl font-bold mb-2">Manager access</h2>
        <p className="text-sm text-gray-500 mb-4">Enter your PIN to continue</p>
        {pinError && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded-lg text-sm">{pinError}</div>}
        <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-4">
          <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="input-field text-center text-3xl tracking-[0.5em] font-mono" autoFocus placeholder="••••" />
          <button type="submit" disabled={pin.length < 4} className="btn-teal w-full">Verify</button>
          <button type="button" onClick={() => { setShowPin(false); setPin(''); }} className="text-sm text-gray-500 hover:text-gray-700 w-full text-center">Cancel</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <ShieldIcon size={64} />
      <div className="text-2xl font-bold mt-3 mb-1">
        <span className="text-[#0F6E56]">NearMiss</span>
        <span className="text-[#1A1A1A]"> Pro</span>
      </div>
      <p className="text-gray-500 mb-1">{pharmacyName}</p>

      {count > 0 ? (
        <div className="bg-gray-50 rounded-lg px-4 py-2 mb-6">
          <p className="text-sm text-gray-600"><span className="font-bold text-gray-900">{count}</span> near miss{count !== 1 ? 'es' : ''} recorded this month</p>
        </div>
      ) : (
        <p className="text-sm text-gray-400 mb-6">No near misses recorded this month</p>
      )}

      {/* Main action — record a near miss */}
      <button onClick={() => nav('/record')}
        className="w-full max-w-xs bg-[#0F6E56] text-white text-lg font-semibold py-5 rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:bg-[#0B5A46] hover:shadow-xl transition-all">
        <ClipboardPlus size={24} /> Record a near miss
      </button>
      <p className="text-xs text-gray-400 mt-2 max-w-xs text-center">Takes under 60 seconds. Your report is anonymous.</p>

      {/* Manager access */}
      <button onClick={handleManager}
        className="mt-6 w-full max-w-xs bg-white text-gray-700 text-sm font-medium py-3 rounded-xl border border-gray-300 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
        <LayoutDashboard size={16} /> Manager dashboard {pinEnabled && <Lock size={12} className="text-gray-400" />}
      </button>
      <p className="text-xs text-gray-400 mt-1">Review incidents and generate reports</p>
    </div>
  );
}
