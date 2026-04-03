import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

type Role = 'staff' | 'manager' | 'founder' | null;

interface Auth {
  role: Role;
  pharmacyName: string | null;
  pharmacyId: string | null;
  loading: boolean;
  pinEnabled: boolean;
  login: (role: Role, pharmacyName?: string, pharmacyId?: string, pinEnabled?: boolean) => void;
  upgradeToManager: (token: string) => void;
  logout: () => void;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [pharmacyName, setPharmacyName] = useState<string | null>(null);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    const r = localStorage.getItem('nmp_role') as Role;
    const n = localStorage.getItem('nmp_pharmacy');
    const id = localStorage.getItem('nmp_pharmacy_id');
    const pin = localStorage.getItem('nmp_pin_enabled') === 'true';
    if (token && r) { setRole(r); setPharmacyName(n); setPharmacyId(id); setPinEnabled(pin); }
    setLoading(false);
  }, []);

  const login = (r: Role, name?: string, id?: string, pin?: boolean) => {
    setRole(r); setPharmacyName(name || null); setPharmacyId(id || null); setPinEnabled(pin || false);
    if (r) localStorage.setItem('nmp_role', r);
    if (name) localStorage.setItem('nmp_pharmacy', name);
    if (id) localStorage.setItem('nmp_pharmacy_id', id);
    localStorage.setItem('nmp_pin_enabled', String(pin || false));
  };

  const upgradeToManager = (token: string) => {
    api.setToken(token);
    setRole('manager');
    localStorage.setItem('nmp_role', 'manager');
  };

  const logout = () => {
    api.setToken(null); setRole(null); setPharmacyName(null); setPharmacyId(null);
    ['nmp_role', 'nmp_pharmacy', 'nmp_pharmacy_id', 'nmp_pin_enabled'].forEach(k => localStorage.removeItem(k));
  };

  return <Ctx.Provider value={{ role, pharmacyName, pharmacyId, loading, pinEnabled, login, upgradeToManager, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
