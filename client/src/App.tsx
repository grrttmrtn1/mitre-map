import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthError } from './api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ToastContainer from './components/ToastContainer';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AttackMatrix from './pages/AttackMatrix';
import Detections from './pages/Detections';
import Tools from './pages/Tools';
import DefenseMapping from './pages/DefenseMapping';
import GapAnalysis from './pages/GapAnalysis';
import ThreatGroups from './pages/ThreatGroups';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ApiPlayground from './pages/ApiPlayground';
import LoginPage from './pages/LoginPage';
import DataSources from './pages/DataSources';
import AtomicTests from './pages/AtomicTests';
import Exercises from './pages/Exercises';
import TaxiiIngest from './pages/TaxiiIngest';
import SigmaLibrary from './pages/SigmaLibrary';

function AuthBanner({ onDismiss }: { onDismiss: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-xs text-amber-300 flex-shrink-0">
      <span className="font-semibold">Authentication required</span>
      <span className="text-amber-500">—</span>
      <span className="text-amber-400/80">Configure your credentials to use the app.</span>
      <button
        onClick={() => { navigate('/login'); onDismiss(); }}
        className="ml-auto px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium transition-colors"
      >
        Sign in
      </button>
      <button onClick={onDismiss} className="text-amber-600 hover:text-amber-400 px-1">✕</button>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="h-full animate-fadein">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/matrix" element={<AttackMatrix />} />
        <Route path="/detections" element={<Detections />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/defense" element={<DefenseMapping />} />
        <Route path="/gaps" element={<GapAnalysis />} />
        <Route path="/threats" element={<ThreatGroups />} />
        <Route path="/data-sources" element={<DataSources />} />
        <Route path="/atomic" element={<AtomicTests />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/taxii" element={<TaxiiIngest />} />
        <Route path="/sigma" element={<SigmaLibrary />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/api" element={<ApiPlayground />} />
      </Routes>
    </div>
  );
}

function AppShell() {
  const [authError, setAuthError] = useState(false);
  const { loading, user, isBootstrapMode } = useAuth();

  useEffect(() => {
    onAuthError(() => setAuthError(true));
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={
        !user && !isBootstrapMode && localStorage.getItem('mitremap_api_key') === null ? (
          <Navigate to="/login" replace />
        ) : (
          <div className="flex h-screen overflow-hidden bg-slate-950">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              {authError && <AuthBanner onDismiss={() => setAuthError(false)} />}
              <main className="flex-1 overflow-hidden">
                <AnimatedRoutes />
              </main>
            </div>
          </div>
        )
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell />
        <ToastContainer />
      </ToastProvider>
    </AuthProvider>
  );
}
