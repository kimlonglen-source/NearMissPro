import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Download } from 'lucide-react';

export function InstallPrompt() {
  const loc = useLocation();
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  // Don't compete for attention during a near-miss submission — the Record page
  // has a sticky Submit at the same corner. Hiding here also prevents first-time
  // users seeing an install prompt mid-flow.
  const onRecord = loc.pathname === '/record';

  useEffect(() => {
    if (localStorage.getItem('nmp_install_dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Show after 30 seconds
    const timer = setTimeout(() => {
      if (deferredPrompt || !localStorage.getItem('nmp_install_dismissed')) setShow(true);
    }, 30000);

    return () => { window.removeEventListener('beforeinstallprompt', handler); clearTimeout(timer); };
  }, [deferredPrompt]);

  const handleInstall = async () => {
    if (deferredPrompt && 'prompt' in deferredPrompt) {
      (deferredPrompt as any).prompt();
    }
    setShow(false);
    localStorage.setItem('nmp_install_dismissed', '1');
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('nmp_install_dismissed', '1');
  };

  if (!show || onRecord) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 max-w-xs no-print">
      <button onClick={handleDismiss} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"><X size={16} /></button>
      <p className="text-sm font-medium text-gray-900 mb-2 pr-6">Install NearMissPro to your desktop for the best dispensary experience</p>
      <div className="flex gap-2">
        <button onClick={handleInstall} className="btn-teal text-xs"><Download size={12} /> Install</button>
        <button onClick={handleDismiss} className="btn-grey text-xs">Maybe later</button>
      </div>
    </div>
  );
}
