import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { lazy, Suspense } from 'react';
import { Menu } from 'lucide-react';
import { api, getStoredApiKey, onAuthError, setBootstrapToken } from './api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/ToastContainer';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const AttackMatrix = lazy(() => import('./pages/AttackMatrix'));
const Detections = lazy(() => import('./pages/Detections'));
const Tools = lazy(() => import('./pages/Tools'));
const DefenseMapping = lazy(() => import('./pages/DefenseMapping'));
const GapAnalysis = lazy(() => import('./pages/GapAnalysis'));
const ThreatGroups = lazy(() => import('./pages/ThreatGroups'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const ApiPlayground = lazy(() => import('./pages/ApiPlayground'));
const DataSources = lazy(() => import('./pages/DataSources'));
const AtomicTests = lazy(() => import('./pages/AtomicTests'));
const Exercises = lazy(() => import('./pages/Exercises'));
const TaxiiIngest = lazy(() => import('./pages/TaxiiIngest'));
const SigmaLibrary = lazy(() => import('./pages/SigmaLibrary'));
const Prioritization = lazy(() => import('./pages/Prioritization'));
const Compliance = lazy(() => import('./pages/Compliance'));
const Integrations = lazy(() => import('./pages/Integrations'));

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

function BootstrapBanner({ tokenConfigured }: { tokenConfigured: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', token: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      setBootstrapToken(form.token);
      await api.createUser({ email: form.email, name: 'Administrator', password: form.password, role: 'admin' });
      setBootstrapToken(null);
      window.location.assign('/login');
    } catch (e) {
      setBootstrapToken(null);
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally { setSaving(false); }
  };
  return (
    <div role="alert" className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
      <div className="flex flex-wrap items-center gap-2">
      <strong>Setup required.</strong>
      <span>No user or API key exists. Ordinary mutations are locked.</span>
      <span>{tokenConfigured ? 'Use the configured bootstrap token to create the first credential.' : 'Configure ADMIN_EMAIL/ADMIN_PASSWORD or BOOTSTRAP_TOKEN on the server.'}</span>
      {tokenConfigured && <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="ml-auto rounded bg-amber-500/20 px-2.5 py-1 font-medium hover:bg-amber-500/30">Create administrator</button>}
      </div>
      {open && <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-2 border-t border-amber-500/20 pt-3 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <label><span className="sr-only">Administrator email</span><input required type="email" autoComplete="email" placeholder="Administrator email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full rounded border border-amber-500/30 bg-white px-2 py-1.5 text-gray-900 dark:bg-slate-900 dark:text-white" /></label>
        <label><span className="sr-only">Administrator password</span><input required minLength={12} type="password" autoComplete="new-password" placeholder="Password (12+ characters)" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full rounded border border-amber-500/30 bg-white px-2 py-1.5 text-gray-900 dark:bg-slate-900 dark:text-white" /></label>
        <label><span className="sr-only">Bootstrap token</span><input required type="password" autoComplete="off" placeholder="Bootstrap token" value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))} className="w-full rounded border border-amber-500/30 bg-white px-2 py-1.5 text-gray-900 dark:bg-slate-900 dark:text-white" /></label>
        <button disabled={saving} className="rounded bg-amber-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create'}</button>
        {error && <p className="sm:col-span-3 lg:col-span-4 text-red-600 dark:text-red-300">{error}</p>}
      </form>}
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="h-full animate-fadein">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-slate-400" role="status">Loading view…</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/matrix" element={<AttackMatrix />} />
        <Route path="/detections" element={<Detections />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/defense" element={<DefenseMapping />} />
        <Route path="/gaps" element={<GapAnalysis />} />
        <Route path="/prioritization" element={<Prioritization />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/threats" element={<ThreatGroups />} />
        <Route path="/data-sources" element={<DataSources />} />
        <Route path="/atomic" element={<AtomicTests />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/taxii" element={<TaxiiIngest />} />
        <Route path="/sigma" element={<SigmaLibrary />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/api" element={<ApiPlayground />} />
      </Routes>
      </Suspense>
    </div>
  );
}

function AppShell() {
  const [authError, setAuthError] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const { loading, user, isBootstrapMode, bootstrapTokenConfigured } = useAuth();

  useEffect(() => {
    onAuthError(() => setAuthError(true));
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-slate-950 text-gray-500 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={
        !user && !isBootstrapMode && getStoredApiKey() === null ? (
          <Navigate to="/login" replace />
        ) : (
          <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-950 print:block print:h-auto">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded focus:bg-blue-600 focus:px-3 focus:py-2 focus:text-white">Skip to main content</a>
            <Sidebar open={navigationOpen} onClose={() => setNavigationOpen(false)} />
            <div className="flex-1 flex flex-col overflow-hidden print:block print:h-auto">
              <div className="flex h-12 items-center border-b border-gray-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 md:hidden print:hidden">
                <button aria-label="Open navigation" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800">
                  <Menu size={20} />
                </button>
                <span className="ml-2 text-sm font-semibold text-gray-900 dark:text-white">MitreMap</span>
              </div>
              {authError && <AuthBanner onDismiss={() => setAuthError(false)} />}
              {isBootstrapMode && <BootstrapBanner tokenConfigured={bootstrapTokenConfigured} />}
              <main id="main-content" tabIndex={-1} className="flex-1 overflow-hidden outline-none print:overflow-visible print:h-auto">
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
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
            <AppShell />
            <CommandPalette />
            <ToastContainer />
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
