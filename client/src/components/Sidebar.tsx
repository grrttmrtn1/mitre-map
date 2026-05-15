import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  LayoutGrid,
  ShieldAlert,
  Wrench,
  Shield,
  AlertTriangle,
  ListOrdered,
  Users,
  Database,
  FlaskConical,
  Target,
  FileCode2,
  ArrowLeftRight,
  BarChart3,
  Settings,
  Zap,
} from 'lucide-react';

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/dashboard',    label: 'Dashboard',         icon: LayoutDashboard },
  { to: '/matrix',       label: 'ATT&CK Matrix',     icon: LayoutGrid },
  { to: '/detections',   label: 'Detections',        icon: ShieldAlert },
  { to: '/tools',        label: 'Tools & Capabilities', icon: Wrench },
  { to: '/defense',      label: 'Defense Mapping',   icon: Shield },
  { to: '/gaps',         label: 'Gap Analysis',      icon: AlertTriangle },
  { to: '/prioritization', label: 'Priority Queue',  icon: ListOrdered },
  { to: '/threats',      label: 'Threat Groups',     icon: Users },
  { to: '/data-sources', label: 'Data Sources',      icon: Database },
  { to: '/atomic',       label: 'Atomic Tests',      icon: FlaskConical },
  { to: '/exercises',    label: 'Exercises',         icon: Target },
  { to: '/sigma',        label: 'SIGMA Library',     icon: FileCode2 },
  { to: '/taxii',        label: 'TAXII Ingest',      icon: ArrowLeftRight },
  { to: '/reports',      label: 'Reports & Exports', icon: BarChart3 },
  { to: '/settings',     label: 'Settings',          icon: Settings },
  { to: '/api',          label: 'API Playground',    icon: Zap },
];

function ShieldLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shield-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="circuit-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#67e8f9" />
        </linearGradient>
      </defs>
      {/* Shield body */}
      <path d="M14 2L4 6.5V13.5C4 19.2 8.4 24.5 14 26C19.6 24.5 24 19.2 24 13.5V6.5L14 2Z"
        fill="url(#shield-grad)" opacity="0.9" />
      <path d="M14 2L4 6.5V13.5C4 19.2 8.4 24.5 14 26C19.6 24.5 24 19.2 24 13.5V6.5L14 2Z"
        stroke="url(#circuit-grad)" strokeWidth="0.75" fill="none" opacity="0.6" />
      {/* Circuit trace lines */}
      <line x1="14" y1="9" x2="14" y2="11" stroke="url(#circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <line x1="14" y1="11" x2="10" y2="13" stroke="url(#circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <line x1="14" y1="11" x2="18" y2="13" stroke="url(#circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <line x1="10" y1="13" x2="10" y2="17" stroke="url(#circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <line x1="18" y1="13" x2="18" y2="17" stroke="url(#circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <line x1="10" y1="17" x2="14" y2="19" stroke="url(#circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <line x1="18" y1="17" x2="14" y2="19" stroke="url(#circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      {/* Node dots */}
      <circle cx="14" cy="9" r="1.25" fill="white" opacity="0.9" />
      <circle cx="10" cy="13" r="1" fill="white" opacity="0.7" />
      <circle cx="18" cy="13" r="1" fill="white" opacity="0.7" />
      <circle cx="10" cy="17" r="1" fill="white" opacity="0.7" />
      <circle cx="18" cy="17" r="1" fill="white" opacity="0.7" />
      <circle cx="14" cy="19" r="1.25" fill="white" opacity="0.9" />
    </svg>
  );
}

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
    <aside className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col relative">
      {/* Top gradient accent strip */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 opacity-80" />

      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <ShieldLogo />
          <div>
            <div className="text-sm font-semibold text-white leading-tight tracking-tight">MitreMap</div>
            <div className="text-xs text-slate-400 leading-tight">Detection Coverage</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 relative ${
                isActive
                  ? 'bg-blue-500/10 text-blue-300 font-medium border-l-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.18)] pl-[10px]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border-l-2 border-transparent pl-[10px]'
              }`
            }
          >
            <Icon size={15} className={`flex-shrink-0 transition-all duration-150`} />
            <span className="flex-1">{label}</span>
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
