import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

// First-login landing page reached via the "set your password"
// link in the approval email. Consumes the one-time token,
// stores the password, and logs the user in immediately so they
// land on the home screen ready to record a near miss.
export function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();
  const { login } = useAuth();

  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (pwd.length < 8) { setErr('Password must be at least 8 characters'); return; }
    if (pwd !== confirm) { setErr('Passwords don\'t match'); return; }
    if (!token) { setErr('Setup link is missing its token. Contact hello@nearmisspro.co.nz.'); return; }
    setLoading(true);
    try {
      const res = await api.setInitialPassword(token, pwd);
      if (res.token) {
        api.setToken(res.token);
        login('staff', res.pharmacyName, res.pharmacyId);
        nav('/app');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-gray-100">
        <div className="mb-8"><Logo size="lg" /></div>
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <AlertTriangle size={22} className="text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Setup link missing</h2>
          <p className="text-sm text-gray-600">This setup link is missing its security token. Email <a href="mailto:hello@nearmisspro.co.nz" className="text-[#0F6E56] hover:underline">hello@nearmisspro.co.nz</a> and we'll send a fresh one.</p>
          <Link to="/" className="text-sm text-[#0F6E56] hover:underline inline-block pt-2">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-gray-100">
      <div className="mb-8"><Logo size="lg" /></div>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <div className="w-12 h-12 rounded-full bg-[#E1F5EE] flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 size={22} className="text-[#0F6E56]" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">Welcome to NearMissPro</h2>
        <p className="text-sm text-gray-500 mb-4 text-center">Set a password for your team to use on the dispensing computer.</p>
        {err && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{err}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="setup-pwd" className="block text-sm font-medium text-gray-700 mb-1">Pharmacy password</label>
            <input id="setup-pwd" type="password" value={pwd} onChange={e => setPwd(e.target.value)} className="input-field" placeholder="At least 8 characters" autoFocus required />
          </div>
          <div>
            <label htmlFor="setup-confirm" className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input id="setup-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input-field" placeholder="Type it again" required />
          </div>
          <button type="submit" disabled={loading || pwd.length < 8 || pwd !== confirm} className="btn-teal w-full">
            {loading ? 'Setting up…' : 'Set password and start'}
          </button>
        </form>
        <p className="text-[11px] text-gray-400 text-center pt-3">
          All your staff will use this password to log in. You can change it any time from Settings.
        </p>
      </div>
    </div>
  );
}
