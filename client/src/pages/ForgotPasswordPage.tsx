import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { api } from '../lib/api';
import { Mail } from 'lucide-react';

// Reached from the login page via "Forgot password?". The success
// message is deliberately vague ("if a pharmacy by that name
// exists...") so an attacker can't enumerate registered pharmacy
// names by watching response messages.
export function ForgotPasswordPage() {
  const [pharmacyName, setPharmacyName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pharmacyName.trim() || loading) return;
    setLoading(true);
    try {
      await api.forgotPassword(pharmacyName.trim());
    } catch { /* swallowed — server always 200s to prevent enumeration */ }
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-gray-100">
      <div className="mb-8"><Logo size="lg" /></div>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        {submitted ? (
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#E1F5EE] flex items-center justify-center mx-auto">
              <Mail size={22} className="text-[#0F6E56]" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Check the dispensary email</h2>
            <p className="text-sm text-gray-600 leading-snug">
              If a pharmacy by that name exists, we've sent a reset link to the dispensary email on file. The link expires in 60 minutes.
            </p>
            <p className="text-xs text-gray-400 leading-snug pt-2">
              Didn't get an email? Check spam, or confirm the pharmacy name is spelled the same as when you registered.
            </p>
            <Link to="/login" className="text-sm text-[#0F6E56] hover:underline inline-block pt-2">← Back to login</Link>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Reset password</h2>
            <p className="text-sm text-gray-500 mb-4">
              We'll email a reset link to the dispensary email on file.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="pharmacyName" className="block text-sm font-medium text-gray-700 mb-1">Pharmacy name</label>
                <input id="pharmacyName" type="text" value={pharmacyName} onChange={e => setPharmacyName(e.target.value)} className="input-field" placeholder="e.g. Riverdale Pharmacy" autoFocus required />
              </div>
              <button type="submit" disabled={loading || !pharmacyName.trim()} className="btn-teal w-full">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <div className="mt-4 text-center">
              <Link to="/login" className="text-xs text-gray-500 hover:text-gray-700">← Back to login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
