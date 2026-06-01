import { NavLink, useNavigate } from 'react-router-dom';
import NotificationCenter from './NotificationCenter';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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
  Sun,
  Moon,
  ClipboardCheck,
  Plug,
} from 'lucide-react';

type NavItem = { to: string; label: string; icon: LucideIcon };
type NavGroup = { section: string | null; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    section: null,
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Coverage',
    items: [
      { to: '/matrix',         label: 'ATT&CK Matrix',   icon: LayoutGrid },
      { to: '/detections',     label: 'Detections',      icon: ShieldAlert },
      { to: '/defense',        label: 'Defense Mapping', icon: Shield },
      { to: '/gaps',           label: 'Gap Analysis',    icon: AlertTriangle },
      { to: '/prioritization', label: 'Priority Queue',  icon: ListOrdered },
      { to: '/compliance',     label: 'Compliance',      icon: ClipboardCheck },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { to: '/threats',      label: 'Threat Groups', icon: Users },
      { to: '/data-sources', label: 'Data Sources',  icon: Database },
      { to: '/taxii',        label: 'TAXII Ingest',  icon: ArrowLeftRight },
    ],
  },
  {
    section: 'Detection Eng.',
    items: [
      { to: '/sigma',        label: 'SIGMA Library',       icon: FileCode2 },
      { to: '/atomic',       label: 'Atomic Tests',        icon: FlaskConical },
      { to: '/exercises',    label: 'Exercises',           icon: Target },
      { to: '/tools',        label: 'Tools & Capabilities', icon: Wrench },
      { to: '/integrations', label: 'Integrations',        icon: Plug },
    ],
  },
  {
    section: 'System',
    items: [
      { to: '/reports',  label: 'Reports & Exports', icon: BarChart3 },
      { to: '/settings', label: 'Settings',          icon: Settings },
      { to: '/api',      label: 'API Playground',    icon: Zap },
    ],
  },
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
  const { theme, toggle, density, setDensity } = useTheme();
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
    <aside className="w-56 flex-shrink-0 bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col relative print:hidden">
      {/* Top gradient accent strip */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 opacity-80" />

      <div className="px-4 py-5 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <ShieldLogo />
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white leading-tight tracking-tight">MitreMap</div>
            <div className="text-xs text-gray-500 dark:text-slate-400 leading-tight">Detection Coverage</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {NAV.map(({ section, items }) => (
          <div key={section ?? '__top'} className="mb-1">
            {section && (
              <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-600 select-none">
                {section}
              </div>
            )}
            <div className="space-y-0.5">
              {items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 relative ${
                      isActive
                        ? 'bg-blue-500/10 text-blue-300 font-medium border-l-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.18)] pl-[10px]'
                        : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-100/70 dark:hover:bg-slate-800/70 border-l-2 border-transparent pl-[10px]'
                    }`
                  }
                >
                  <Icon size={15} className="flex-shrink-0 transition-all duration-150" />
                  <span className="flex-1">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
        {user ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs text-gray-700 dark:text-slate-300 font-medium truncate">{user.name ?? user.email}</div>
              <div className="text-xs text-gray-400 dark:text-slate-500 truncate">{user.role}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:text-slate-300 transition-colors p-1"
            >
              ⏻
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="w-full text-left text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:text-slate-300 transition-colors flex items-center gap-2 px-1 py-0.5"
          >
            <span>→</span>
            <span>Sign in</span>
          </button>
        )}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400 dark:text-slate-500">{version} · D3FEND v1</div>
          <div className="flex items-center gap-1">
            <NotificationCenter />
            <button
              onClick={toggle}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:text-slate-300 transition-colors p-1 rounded"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400 dark:text-slate-500">Row density</div>
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-slate-800 rounded border border-gray-300 dark:border-slate-700 overflow-hidden">
            {(['compact', 'comfortable', 'spacious'] as const).map((d, i) => (
              <button
                key={d}
                onClick={() => setDensity(d)}
                title={d.charAt(0).toUpperCase() + d.slice(1)}
                className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors ${density === d ? 'bg-blue-600/30 text-blue-400' : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:text-slate-300'} ${i > 0 ? 'border-l border-gray-300 dark:border-slate-700' : ''}`}
              >
                {d === 'compact' ? 'S' : d === 'comfortable' ? 'M' : 'L'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
