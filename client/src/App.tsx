import { Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar />
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
        </Routes>
      </main>
    </div>
  );
}
