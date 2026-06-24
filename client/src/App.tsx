import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OfflineIndicator } from './components/OfflineIndicator';
import { InstallPrompt } from './components/InstallPrompt';
import { LandingPage } from './pages/LandingPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyDevicePage } from './pages/VerifyDevicePage';
import { SignupPage } from './pages/SignupPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { FounderLoginPage } from './pages/FounderLoginPage';
import { HomePage } from './pages/HomePage';
import { RecordPage } from './pages/RecordPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReportPage } from './pages/ReportPage';
import { ReportsListPage } from './pages/ReportsListPage';
import { VoidedIncidentsPage } from './pages/VoidedIncidentsPage';
import { AdminPage } from './pages/AdminPage';
import { SettingsPage } from './pages/SettingsPage';

// Scroll the window to the top whenever the route path changes.
// React Router preserves scroll position by default, which means
// clicking Terms / Privacy from the footer (a long page) would
// land the user partway down the new page. This puts them at the
// top — except for in-page anchor jumps (#trial, #pricing), which
// we let the browser handle natively by checking for a hash.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);
  return null;
}

function HomeRedirect() {
  const { role } = useAuth();
  if (role === 'founder') return <Navigate to="/admin" replace />;
  if (role) return <Navigate to="/app" replace />;
  return <Navigate to="/" replace />;
}

// "/" — landing page for visitors, in-app home for logged-in users.
// Keeps the marketing site and the app on the same domain
// (nearmisspro.co.nz) so a pharmacist who logs in lands straight on
// the app, while a Stripe reviewer or Pharmacy Council member visiting
// the same URL sees what the product is.
function RootRoute() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role === 'founder') return <Navigate to="/admin" replace />;
  if (role) return <Navigate to="/app" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <>
    <ScrollToTop />
    <OfflineIndicator />
    <InstallPrompt />
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/setup-password" element={<SetPasswordPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-device" element={<VerifyDevicePage />} />
      <Route path="/founder" element={<FounderLoginPage />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/app" element={<ProtectedRoute allow={['staff', 'manager']}><HomePage /></ProtectedRoute>} />
        <Route path="/record" element={<ProtectedRoute allow={['staff', 'manager']}><RecordPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute allow={['manager']}><DashboardPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allow={['manager']}><ReportsListPage /></ProtectedRoute>} />
        <Route path="/reports/:id" element={<ProtectedRoute allow={['manager']}><ReportPage /></ProtectedRoute>} />
        <Route path="/voided" element={<ProtectedRoute allow={['manager']}><VoidedIncidentsPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allow={['manager']}><SettingsPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allow={['founder']}><AdminPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
    </>
  );
}
