import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AuthCallbackPage from './pages/AuthCallbackPage.jsx';
import AppShell from './components/navigation/AppShell.jsx';
import DashboardShell from './components/navigation/DashboardShell.jsx';
import NewHomePage from './pages/app/NewHomePage.jsx';
import HomePage from './pages/app/HomePage.jsx';
import FinancePage from './pages/app/FinancePage.jsx';
import TripPage from './pages/app/TripPage.jsx';
import RecoveryPage from './pages/app/RecoveryPage.jsx';
import GroupPage from './pages/app/GroupPage.jsx';
import DocumentsPage from './pages/app/DocumentsPage.jsx';
import DeadlinesPage from './pages/app/DeadlinesPage.jsx';
import AssistantPage from './pages/app/AssistantPage.jsx';
import WeatherTwinPage from './pages/app/WeatherTwinPage.jsx';
import CreateTripPage from './pages/app/CreateTripPage.jsx';
import TripTimelinePage from './pages/app/TripTimelinePage.jsx';
import EditJourneyPage from './pages/app/EditJourneyPage.jsx';
import RecoveryPlansPage from './pages/app/RecoveryPlansPage.jsx';
import RecoveryComparePage from './pages/app/RecoveryComparePage.jsx';
import RecoveryConfirmApplyPage from './pages/app/RecoveryConfirmApplyPage.jsx';
import TripInviteResponsePage from './pages/TripInviteResponsePage.jsx';
import ProfilePage from './pages/app/ProfilePage.jsx';
import FirstTimeCheckPage from './pages/onboarding/FirstTimeCheckPage.jsx';
import TravelReadyWelcomePage from './pages/onboarding/TravelReadyWelcomePage.jsx';
import TravelProfileSetupPage from './pages/onboarding/TravelProfileSetupPage.jsx';
import SOSModal from './components/emergency/SOSModal.jsx';
import { useTrip } from './context/TripContext.jsx';
import { useAuth } from './context/AuthContext.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export default function App() {
  const { state, dispatch } = useTrip();
  const { user } = useAuth();
  const [sosOpen, setSosOpen] = useState(false);

  // Listen for SOS open event from bottom nav
  useEffect(() => {
    const handler = () => setSosOpen(true);
    window.addEventListener('tripsync:sos-open', handler);
    return () => window.removeEventListener('tripsync:sos-open', handler);
  }, []);

  // Auto-open SOS when requested via reducer
  useEffect(() => {
    if (state.sos?.gpsStatus === 'searching') {
      setSosOpen(true);
    }
  }, [state.sos?.gpsStatus]);

  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing user={user} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/landing" element={<Landing user={user} />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/invite/:token" element={<TripInviteResponsePage />} />

        {/* ── TOP-NAV ROUTES (full-width, top-nav, NO sidebar) ── */}
        <Route
          path="/app"
          index
          element={
            <DashboardShell>
              <NewHomePage />
            </DashboardShell>
          }
        />
        <Route
          path="/app/profile"
          element={
            <DashboardShell>
              <ProfilePage />
            </DashboardShell>
          }
        />
        <Route
          path="/app/trip"
          element={
            <DashboardShell>
              <TripPage />
            </DashboardShell>
          }
        />
        <Route
          path="/app/trip/:tripId/timeline"
          element={
            <DashboardShell>
              <TripTimelinePage />
            </DashboardShell>
          }
        />
        <Route
          path="/app/trip/:tripId/edit"
          element={
            <DashboardShell>
              <EditJourneyPage />
            </DashboardShell>
          }
        />
        <Route
          path="/app/trip/:tripId/recovery"
          element={
            <DashboardShell>
              <RecoveryPlansPage />
            </DashboardShell>
          }
        />
        <Route
          path="/app/trip/:tripId/recovery/compare"
          element={
            <DashboardShell>
              <RecoveryComparePage />
            </DashboardShell>
          }
        />
        <Route
          path="/app/trip/:tripId/recovery/confirm"
          element={
            <DashboardShell>
              <RecoveryConfirmApplyPage />
            </DashboardShell>
          }
        />
        <Route
          path="/app/recovery"
          element={
            <DashboardShell>
              <RecoveryPlansPage />
            </DashboardShell>
          }
        />
        <Route
          path="/app/recovery/compare"
          element={
            <DashboardShell>
              <RecoveryComparePage />
            </DashboardShell>
          }
        />
        <Route
          path="/app/recovery/confirm"
          element={
            <DashboardShell>
              <RecoveryConfirmApplyPage />
            </DashboardShell>
          }
        />

        <Route
          path="/app/twin"
          element={
            <DashboardShell>
              <WeatherTwinPage />
            </DashboardShell>
          }
        />

        {/* ── All other /app/* sub-routes keep AppShell ── */}
        <Route path="/app" element={<AppShell user={user} />}>
          <Route path="create-trip" element={<CreateTripPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="recovery-demo" element={<RecoveryPage />} />
          <Route path="twin" element={<WeatherTwinPage />} />
          <Route path="group" element={<GroupPage />} />
          <Route path="groups" element={<Navigate to="/app/group" replace />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="deadlines" element={<DeadlinesPage />} />
          <Route path="assistant" element={<AssistantPage />} />
        </Route>

        {/* First-Time Onboarding Flow */}
        <Route path="/profile/check" element={<FirstTimeCheckPage />} />
        <Route path="/profile/welcome" element={<TravelReadyWelcomePage />} />
        <Route path="/profile/setup" element={<TravelProfileSetupPage />} />
        <Route path="/profile" element={<Navigate to="/app/profile" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SOSModal open={sosOpen} onClose={() => setSosOpen(false)} />
    </>
  );
}