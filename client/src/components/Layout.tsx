import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import {
  ClipboardPlus,
  LayoutDashboard,
  Settings,
  LogOut,
} from 'lucide-react';

export function Layout() {
  const { role, pharmacyName, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    ...(role === 'staff' || role === 'manager'
      ? [{ to: '/record', label: 'Record', icon: ClipboardPlus }]
      : []),
    ...(role === 'manager' || role === 'founder'
      ? [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
      : []),
    ...(role === 'founder'
      ? [{ to: '/admin', label: 'Admin', icon: Settings }]
      : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link to="/" className="flex-shrink-0">
          <Logo size="sm" />
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${location.pathname === to
                  ? 'bg-brand-teal text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <Icon size={18} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {pharmacyName && (
            <span className="text-xs text-gray-500 hidden sm:block">{pharmacyName}</span>
          )}
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-brand-teal/10 text-brand-teal capitalize">
            {role}
          </span>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
