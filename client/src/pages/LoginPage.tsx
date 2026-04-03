import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export function LoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.staffLogin(name, password);
      api.setToken(res.token);
      login('staff', res.pharmacyName, res.pharmacyId, res.pinEnabled);
      nav('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-gray-100">
      <div className="mb-8"><Logo size="lg" /></div>
      <p className="text-gray-500 mb-8 text-center text-sm">Near miss recording &amp; reporting for NZ pharmacies</p>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Pharmacy Login</h2>
        <p className="text-sm text-gray-500 mb-4">Enter your pharmacy name and password</p>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Pharmacy name</label>
            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="e.g. Riverdale Pharmacy" autoFocus required />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" required />
          </div>
          <button type="submit" disabled={loading || !name || !password} className="btn-teal w-full">{loading ? 'Logging in...' : 'Login'}</button>
        </form>
        <div className="mt-4 text-center">
          <a href="/founder" className="text-xs text-gray-400 hover:text-gray-600">Founder login →</a>
        </div>
      </div>
    </div>
  );
}
