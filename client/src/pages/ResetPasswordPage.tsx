import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { api } from '../lib/api';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

// Landing page for the reset link in the email. Reads ?token=xxx
// from the URL, lets the user set a new password, then bounces them
// to the login page.
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();

  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (pwd.length < 8) { setErr('Password must be at least 8 characters'); return; }
    if (pwd !== confirm) { setErr('Passwords don\'t match'); return; }
    if (!token) { setErr('Reset link is missing its token. Request a new email.'); return; }
    setLoading(true);
    try {
      await api.resetPassword(token, pwd);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Reset failed — request a new link.');
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
          <h2 className="text-lg font-bold text-gray-900">Reset link missing</h2>
          <p className="text-sm text-gray-600">This reset link is missing its security token. Request a new one.</p>
          <Link to="/forgot-password" className="text-sm text-[#0F6E56] hover:underline inline-block pt-2">Request a new reset link</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-gray-100">
        <div className="mb-8"><Logo size="lg" /></div>
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#E1F5EE] flex items-center justify-center mx-auto">
            <CheckCircle2 size={22} className="text-[#0F6E56]" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Password updated</h2>
          <p className="text-sm text-gray-600">Use your new password to log in.</p>
          <button onClick={() => nav('/login')} className="btn-teal w-full mt-2">Go to login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-gray-100">
      <div className="mb-8"><Logo size="lg" /></div>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Set new password</h2>
        <p className="text-sm text-gray-500 mb-4">Pick something at least 8 characters long.</p>
        {err && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{err}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} className="input-field" placeholder="New password (min 8 characters)" autoFocus required />
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input-field" placeholder="Confirm new password" required />
          <button type="submit" disabled={loading || pwd.length < 8 || pwd !== confirm} className="btn-teal w-full">
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <Link to="/forgot-password" className="text-xs text-gray-500 hover:text-gray-700">
            Link expired? Request a new one →
          </Link>
        </div>
      </div>
    </div>
  );
}
