import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldIcon } from './Logo';
import { LogOut, LayoutDashboard, FileText, Settings, Shield, ArrowLeft } from 'lucide-react';

export function Layout() {
  const { role, pharmacyName, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();

  // Staff sees minimal nav — just logo. Manager/Founder see full nav.
  const isStaff = role === 'staff';
  const isOnRecord = loc.pathname === '/record';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between sticky top-0 z-50 no-print">
        {/* Left: Logo or back button */}
        {isOnRecord ? (
          <button onClick={() => nav('/')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back</span>
          </button>
        ) : (
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
        )}

        {/* Right: Nav items */}
        <nav className="flex items-center gap-1">
          {/* Manager nav */}
          {role === 'manager' && !isOnRecord && (
            <>
              <NavLink to="/dashboard" icon={LayoutDashboard} label="Review" current={loc.pathname} />
              <NavLink to="/reports" icon={FileText} label="Reports" current={loc.pathname} />
              <NavLink to="/settings" icon={Settings} label="Settings" current={loc.pathname} />
            </>
          )}

          {/* Founder nav */}
          {role === 'founder' && (
            <NavLink to="/admin" icon={Shield} label="Admin" current={loc.pathname} />
          )}

          {/* Staff sees nothing except logout */}
          <button onClick={() => { logout(); nav('/login'); }} className="ml-2 p-2 text-gray-400 hover:text-gray-600" title="Logout" aria-label="Logout">
            <LogOut size={16} />
          </button>
        </nav>
      </header>
      <main className="flex-1"><Outlet /></main>
    </div>
  );
}

function NavLink({ to, icon: Icon, label, current }: { to: string; icon: React.ComponentType<any>; label: string; current: string }) {
  const active = current === to || (to !== '/' && current.startsWith(to));
  return (
    <Link to={to} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-[#0F6E56] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
      <Icon size={16} /><span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
