import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { api } from '../lib/api';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

// Landing page for the device-approval link in the email. Token is
// in ?token=xxx. We POST it to /auth/verify-device which promotes
// the pending device into trusted_devices. The user (usually
// whoever owns the pharmacy email — manager, pharmacy owner) sees a
// success page; the person at the dispensing computer who triggered
// the request can then go back to the login screen and sign in.
export function VerifyDevicePage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');
  const [message, setMessage] = useState('');
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState('err');
      setMessage('This approval link is missing its security token. Have the person try logging in again to generate a fresh one.');
      return;
    }
    api.verifyDevice(token)
      .then(r => { setState('ok'); setDeviceLabel(r.deviceLabel); })
      .catch(err => {
        setState('err');
        setMessage(err instanceof Error ? err.message : 'Approval failed. Try the link again, or have the person re-attempt the login to generate a new one.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-gray-100">
      <div className="mb-8"><Logo size="lg" /></div>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 text-center space-y-3">
        {state === 'loading' && (
          <>
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
              <Loader2 size={22} className="text-gray-500 animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Approving device…</h2>
          </>
        )}
        {state === 'ok' && (
          <>
            <div className="w-12 h-12 rounded-full bg-[#E1F5EE] flex items-center justify-center mx-auto">
              <CheckCircle2 size={22} className="text-[#0F6E56]" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Device approved</h2>
            <p className="text-sm text-gray-600 leading-snug">
              {deviceLabel
                ? <>The device <strong>{deviceLabel}</strong> can now log in.</>
                : 'The device can now log in.'}
            </p>
            <p className="text-xs text-gray-400 leading-snug pt-2">
              The person trying to log in just needs to click "Try logging in again" on their screen and enter the password.
            </p>
            <Link to="/login" className="btn-teal w-full mt-2 inline-block">Go to login</Link>
          </>
        )}
        {state === 'err' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <AlertTriangle size={22} className="text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Couldn't approve</h2>
            <p className="text-sm text-gray-600 leading-snug">{message}</p>
            <Link to="/login" className="text-sm text-[#0F6E56] hover:underline inline-block pt-2">Back to login</Link>
          </>
        )}
      </div>
    </div>
  );
}
