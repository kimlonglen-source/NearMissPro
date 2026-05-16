import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

type Role = 'staff' | 'manager' | 'founder' | null;

interface Auth {
  role: Role;
  pharmacyName: string | null;
  pharmacyId: string | null;
  loading: boolean;
  login: (role: Role, pharmacyName?: string, pharmacyId?: string) => void;
  upgradeToManager: (token: string) => void;
  logout: () => void;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [pharmacyName, setPharmacyName] = useState<string | null>(null);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    const r = localStorage.getItem('nmp_role') as Role;
    const n = localStorage.getItem('nmp_pharmacy');
    const id = localStorage.getItem('nmp_pharmacy_id');
    if (token && r) { setRole(r); setPharmacyName(n); setPharmacyId(id); }
    setLoading(false);
  }, []);

  const login = (r: Role, name?: string, id?: string) => {
    setRole(r); setPharmacyName(name || null); setPharmacyId(id || null);
    if (r) localStorage.setItem('nmp_role', r);
    if (name) localStorage.setItem('nmp_pharmacy', name);
    if (id) localStorage.setItem('nmp_pharmacy_id', id);
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

  return <Ctx.Provider value={{ role, pharmacyName, pharmacyId, loading, login, upgradeToManager, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
