import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { to: '/matrix', label: 'ATT&CK Matrix', icon: '⊞' },
  { to: '/detections', label: 'Detections', icon: '◉' },
  { to: '/tools', label: 'Tools & Capabilities', icon: '⚙' },
  { to: '/defense', label: 'Defense Mapping', icon: '⛨' },
  { to: '/gaps', label: 'Gap Analysis', icon: '△' },
  { to: '/threats', label: 'Threat Groups', icon: '◈' },
  { to: '/reports', label: 'Reports & Exports', icon: '▦' },
  { to: '/settings', label: 'Settings', icon: '⚛' },
  { to: '/api', label: 'API Playground', icon: '⚡' },
];

export default function Sidebar() {
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
        {NAV.map(({ to, label, icon }) => (
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
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-slate-800">
        <div className="text-xs text-slate-500">MITRE ATT&CK v14 · D3FEND v1</div>
      </div>
    </aside>
  );
}
