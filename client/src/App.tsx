import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthError } from './api';
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

function AuthBanner({ onDismiss }: { onDismiss: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-xs text-amber-300 flex-shrink-0">
      <span className="font-semibold">Authentication required</span>
      <span className="text-amber-500">—</span>
      <span className="text-amber-400/80">API key enforcement is active. Configure your key to use the app.</span>
      <button
        onClick={() => { navigate('/settings'); onDismiss(); }}
        className="ml-auto px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium transition-colors"
      >
        Go to Settings
      </button>
      <button onClick={onDismiss} className="text-amber-600 hover:text-amber-400 px-1">✕</button>
    </div>
  );
}

export default function App() {
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    onAuthError(() => setAuthError(true));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {authError && <AuthBanner onDismiss={() => setAuthError(false)} />}
        <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/matrix" element={<AttackMatrix />} />
          <Route path="/detections" element={<Detections />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/defense" element={<DefenseMapping />} />
          <Route path="/gaps" element={<GapAnalysis />} />
          <Route path="/threats" element={<ThreatGroups />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/api" element={<ApiPlayground />} />
        </Routes>
      </main>
      </div>
    </div>
  );
}
