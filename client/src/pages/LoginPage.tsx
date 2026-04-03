import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ShieldCheck, Users, Crown } from 'lucide-react';

type LoginMode = 'select' | 'staff' | 'manager' | 'founder';

export function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('select');
  const [pharmacyCode, setPharmacyCode] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.staffLogin(pharmacyCode);
      api.setToken(res.token);
      login('staff', res.pharmacyName);
      navigate('/record');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleManagerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.managerLogin(pharmacyCode, pin);
      api.setToken(res.token);
      login('manager', res.pharmacyName);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFounderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.founderLogin(email, password, mfaCode || undefined);
      if (res.requiresMfa) {
        setNeedsMfa(true);
        setLoading(false);
        return;
      }
      api.setToken(res.token);
      login('founder');
      navigate('/admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'select') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-gray-100">
        <div className="mb-8">
          <Logo size="lg" />
        </div>
        <p className="text-gray-500 mb-8 text-center">
          Near miss recording &amp; reporting for NZ pharmacies
        </p>

        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => setMode('staff')}
            className="w-full flex items-center gap-4 px-6 py-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-brand-teal transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-brand-teal/10 flex items-center justify-center group-hover:bg-brand-teal/20 transition-colors">
              <Users size={24} className="text-brand-teal" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900">Staff</div>
              <div className="text-sm text-gray-500">Record a near miss</div>
            </div>
          </button>

          <button
            onClick={() => setMode('manager')}
            className="w-full flex items-center gap-4 px-6 py-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-brand-teal transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <ShieldCheck size={24} className="text-amber-600" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900">Manager</div>
              <div className="text-sm text-gray-500">Review &amp; reports</div>
            </div>
          </button>

          <button
            onClick={() => setMode('founder')}
            className="w-full flex items-center gap-4 px-6 py-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-brand-teal transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
              <Crown size={24} className="text-purple-600" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900">Founder</div>
              <div className="text-sm text-gray-500">Admin panel</div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-gray-100">
      <div className="mb-6">
        <Logo size="md" />
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <button
          onClick={() => { setMode('select'); setError(''); setNeedsMfa(false); }}
          className="text-sm text-gray-500 hover:text-brand-teal mb-4 flex items-center gap-1"
        >
          \u2190 Back
        </button>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
        )}

        {mode === 'staff' && (
          <form onSubmit={handleStaffLogin} className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Staff Login</h2>
            <p className="text-sm text-gray-500">Enter your pharmacy code</p>
            <input
              type="text"
              placeholder="e.g. PHARM001"
              value={pharmacyCode}
              onChange={(e) => setPharmacyCode(e.target.value.toUpperCase())}
              className="input-field text-center text-lg tracking-widest font-mono"
              autoFocus
              required
            />
            <button type="submit" disabled={loading || !pharmacyCode} className="btn-primary w-full">
              {loading ? 'Logging in...' : 'Enter'}
            </button>
          </form>
        )}

        {mode === 'manager' && (
          <form onSubmit={handleManagerLogin} className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Manager Login</h2>
            <p className="text-sm text-gray-500">Pharmacy code + PIN</p>
            <input
              type="text"
              placeholder="Pharmacy code"
              value={pharmacyCode}
              onChange={(e) => setPharmacyCode(e.target.value.toUpperCase())}
              className="input-field text-center tracking-widest font-mono"
              autoFocus
              required
            />
            <input
              type="password"
              placeholder="Manager PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="input-field text-center text-2xl tracking-[0.5em] font-mono"
              maxLength={8}
              inputMode="numeric"
              required
            />
            <button type="submit" disabled={loading || !pharmacyCode || !pin} className="btn-primary w-full">
              {loading ? 'Logging in...' : 'Enter'}
            </button>
          </form>
        )}

        {mode === 'founder' && (
          <form onSubmit={handleFounderLogin} className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Founder Login</h2>
            {!needsMfa ? (
              <>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  autoFocus
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  required
                />
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">Enter your 6-digit authenticator code</p>
                <input
                  type="text"
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-field text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                  required
                />
              </>
            )}
            <button
              type="submit"
              disabled={loading || (!needsMfa && (!email || !password)) || (needsMfa && mfaCode.length < 6)}
              className="btn-primary w-full"
            >
              {loading ? 'Logging in...' : needsMfa ? 'Verify' : 'Login'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
