import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RecordPage } from './pages/RecordPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminPage } from './pages/AdminPage';

function HomeRedirect() {
  const { role } = useAuth();
  if (role === 'staff') return <Navigate to="/record" replace />;
  if (role === 'manager') return <Navigate to="/dashboard" replace />;
  if (role === 'founder') return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/" element={<HomeRedirect />} />

        <Route path="/record" element={
          <ProtectedRoute allowedRoles={['staff', 'manager']}>
            <RecordPage />
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['manager', 'founder']}>
            <DashboardPage />
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['founder']}>
            <AdminPage />
          </ProtectedRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
