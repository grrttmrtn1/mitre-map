import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { api } from '../api';

const NAV: { to: string; label: string; icon: string; beta?: boolean }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { to: '/matrix', label: 'ATT&CK Matrix', icon: '⊞' },
  { to: '/detections', label: 'Detections', icon: '◉' },
  { to: '/tools', label: 'Tools & Capabilities', icon: '⚙' },
  { to: '/defense', label: 'Defense Mapping', icon: '⛨' },
  { to: '/gaps', label: 'Gap Analysis', icon: '△' },
  { to: '/threats', label: 'Threat Groups', icon: '◈' },
  { to: '/data-sources', label: 'Data Sources', icon: '◫' },
  { to: '/atomic', label: 'Atomic Tests', icon: '⚗' },
  { to: '/exercises', label: 'Exercises', icon: '⚔' },
  { to: '/taxii', label: 'TAXII Ingest', icon: '⇌', beta: true },
  { to: '/reports', label: 'Reports & Exports', icon: '▦' },
  { to: '/settings', label: 'Settings', icon: '⚛' },
  { to: '/api', label: 'API Playground', icon: '⚡' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [version, setVersion] = useState('ATT&CK v14');

  useEffect(() => {
    api.getAttackVersion().then(v => setVersion(`ATT&CK ${v.version}`)).catch(() => {});
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-xs font-bold text-white">M</div>
          <div>
            <div className="text-sm font-semibold text-white leading-tight">MitreMap</div>
            <div className="text-xs text-slate-400 leading-tight">Detection Coverage</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon, beta }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <span className="text-base w-4 text-center leading-none">{icon}</span>
            <span className="flex-1">{label}</span>
            {beta && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 leading-none">
                beta
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-slate-800 space-y-2">
        {user ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs text-slate-300 font-medium truncate">{user.name ?? user.email}</div>
              <div className="text-xs text-slate-500 truncate">{user.role}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            >
              ⏻
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="w-full text-left text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-2 px-1 py-0.5"
          >
            <span>→</span>
            <span>Sign in</span>
          </button>
        )}
        <div className="text-xs text-slate-500">{version} · D3FEND v1</div>
      </div>
    </aside>
  );
}
