import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OfflineIndicator } from './components/OfflineIndicator';
import { InstallPrompt } from './components/InstallPrompt';
import { LoginPage } from './pages/LoginPage';
import { FounderLoginPage } from './pages/FounderLoginPage';
import { HomePage } from './pages/HomePage';
import { RecordPage } from './pages/RecordPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReportPage } from './pages/ReportPage';
import { AdminPage } from './pages/AdminPage';
import { SettingsPage } from './pages/SettingsPage';

function HomeRedirect() {
  const { role } = useAuth();
  if (role === 'founder') return <Navigate to="/admin" replace />;
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <>
    <OfflineIndicator />
    <InstallPrompt />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/founder" element={<FounderLoginPage />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<ProtectedRoute allow={['staff', 'manager']}><HomePage /></ProtectedRoute>} />
        <Route path="/record" element={<ProtectedRoute allow={['staff', 'manager']}><RecordPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute allow={['manager']}><DashboardPage /></ProtectedRoute>} />
        <Route path="/reports/:id" element={<ProtectedRoute allow={['manager']}><ReportPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allow={['manager']}><SettingsPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allow={['founder']}><AdminPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
    </>
  );
}
