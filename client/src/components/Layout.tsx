import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldIcon } from './Logo';
import { LogOut, ClipboardPlus, LayoutDashboard, Settings, Shield } from 'lucide-react';

export function Layout() {
  const { role, pharmacyName, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();

  const items = [
    ...(role === 'staff' || role === 'manager' ? [{ to: '/', icon: ClipboardPlus, label: 'Home' }] : []),
    ...(role === 'manager' ? [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ] : []),
    ...(role === 'founder' ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between sticky top-0 z-50 no-print">
        <Link to="/" className="flex items-center gap-2">
          <ShieldIcon size={28} />
          <div className="leading-tight">
            <div className="text-sm font-bold">
              <span className="text-[#0F6E56]">NearMiss</span>
              <span className="text-[#1A1A1A]"> Pro</span>
            </div>
            {pharmacyName && <div className="text-[11px] text-gray-500">{pharmacyName}</div>}
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          {items.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${loc.pathname === to ? 'bg-[#0F6E56] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Icon size={16} /><span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
          <button onClick={() => { logout(); nav('/login'); }} className="ml-2 p-2 text-gray-400 hover:text-gray-600" title="Logout" aria-label="Logout">
            <LogOut size={16} />
          </button>
        </nav>
      </header>
      <main className="flex-1"><Outlet /></main>
    </div>
  );
}
