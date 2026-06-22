import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ShieldIcon } from '../components/Logo';
import { ClipboardPlus, LayoutDashboard } from 'lucide-react';

export function HomePage() {
  const { pharmacyName, upgradeToManager } = useAuth();
  const [count, setCount] = useState(0);
  const nav = useNavigate();

  useEffect(() => { api.getMonthlyCount().then(r => setCount(r.count)).catch(() => {}); }, []);

  const handleManager = async () => {
    try {
      const res = await api.managerAccess();
      if (res.token) { upgradeToManager(res.token); nav('/dashboard'); }
    } catch { /* ignore */ }
  };

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

      <button onClick={() => nav('/record')}
        className="w-full max-w-xs bg-[#0F6E56] text-white text-lg font-semibold py-5 rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:bg-[#0B5A46] hover:shadow-xl transition-all">
        <ClipboardPlus size={24} /> Record a near miss
      </button>
      <p className="text-xs text-gray-400 mt-2 max-w-xs text-center">Takes under 60 seconds. Your report is anonymous.</p>

      <button onClick={handleManager}
        className="mt-6 w-full max-w-xs bg-white text-gray-700 text-sm font-medium py-3 rounded-xl border border-gray-300 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
        <LayoutDashboard size={16} /> Manager dashboard
      </button>
      <p className="text-xs text-gray-400 mt-1">Review incidents and generate reports</p>
    </div>
  );
}
