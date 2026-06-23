import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Mail } from 'lucide-react';

export function LoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // When the server responds needsVerification=true (new device), we
  // switch into a "check email" state. The user stays on the login
  // page, but the form is replaced with instructions. After someone
  // approves via the email link, the user clicks "Try logging in
  // again" which flips back to the form.
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const nav = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.staffLogin(name, password);
      if (res.needsVerification) {
        setAwaitingApproval(true);
        return;
      }
      if (res.token && res.pharmacyName && res.pharmacyId) {
        api.setToken(res.token);
        login('staff', res.pharmacyName, res.pharmacyId);
        nav('/app');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-gray-100">
      <div className="mb-8"><Logo size="lg" /></div>
      <p className="text-gray-500 mb-8 text-center text-sm">Near miss recording &amp; reporting for NZ pharmacies</p>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        {awaitingApproval ? (
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#E1F5EE] flex items-center justify-center mx-auto">
              <Mail size={22} className="text-[#0F6E56]" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Approve this device</h2>
            <p className="text-sm text-gray-600 leading-snug">
              This is a new device, so for security we've emailed the pharmacy email asking someone to approve it. Open the inbox and click the green button in the email.
            </p>
            <p className="text-xs text-gray-400 leading-snug pt-2">
              Once approved, click <strong>Try logging in again</strong> below. This device will be remembered — you won't need approval next time.
            </p>
            <button onClick={() => { setAwaitingApproval(false); setError(''); }} className="btn-teal w-full mt-2">
              Try logging in again
            </button>
            <p className="text-[11px] text-gray-400 leading-snug pt-1">
              The approval link expires in 60 minutes.
            </p>
          </div>
        ) : (
          <>
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
              <Link to="/forgot-password" className="text-sm text-[#0F6E56] hover:underline">Forgot password?</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
