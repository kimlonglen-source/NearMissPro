import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export function FounderLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.founderLogin(email, password, mfaCode || undefined);
      if (res.requiresMfa) { setNeedsMfa(true); setLoading(false); return; }
      api.setToken(res.token!);
      login('founder');
      nav('/admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-gray-100">
      <div className="mb-8"><Logo size="lg" /></div>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Founder Login</h2>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          {!needsMfa ? (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" autoFocus required />
              </div>
              <div>
                <label htmlFor="pwd" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input id="pwd" type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" required />
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="mfa" className="block text-sm font-medium text-gray-700 mb-1">MFA Code</label>
              <input id="mfa" type="text" inputMode="numeric" maxLength={6} value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-field text-center text-2xl tracking-[0.4em] font-mono" autoFocus required />
              <p className="text-xs text-gray-400 mt-1">Enter 6-digit code from your authenticator</p>
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-teal w-full">{loading ? 'Verifying...' : needsMfa ? 'Verify' : 'Login'}</button>
        </form>
        <div className="mt-4 text-center"><a href="/login" className="text-xs text-gray-400 hover:text-gray-600">← Pharmacy login</a></div>
      </div>
    </div>
  );
}
