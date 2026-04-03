import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

type Role = 'staff' | 'manager' | 'founder' | null;

interface AuthState {
  isAuthenticated: boolean;
  role: Role;
  pharmacyName: string | null;
  loading: boolean;
  login: (role: Role, pharmacyName?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [pharmacyName, setPharmacyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    const savedRole = localStorage.getItem('nmp_role') as Role;
    const savedPharmacy = localStorage.getItem('nmp_pharmacy');

    if (token && savedRole) {
      setRole(savedRole);
      setPharmacyName(savedPharmacy);
    }
    setLoading(false);
  }, []);

  const login = (newRole: Role, pharmacy?: string) => {
    setRole(newRole);
    setPharmacyName(pharmacy || null);
    if (newRole) localStorage.setItem('nmp_role', newRole);
    if (pharmacy) localStorage.setItem('nmp_pharmacy', pharmacy);
  };

  const logout = () => {
    api.setToken(null);
    setRole(null);
    setPharmacyName(null);
    localStorage.removeItem('nmp_role');
    localStorage.removeItem('nmp_pharmacy');
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!role,
        role,
        pharmacyName,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
