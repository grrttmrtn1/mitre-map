import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

const TYPE_ICONS: Record<string, string> = {
  taxii_batch_ready: '📥',
  deprecated_technique: '⚠️',
  assignment_due: '📋',
  coverage_alert: '🔴',
};

const ENTITY_HREF: Record<string, (id: string | null) => string> = {
  taxii_batch: () => '/taxii',
  detection: () => '/detections',
  assignment: () => '/gaps',
};

export default function NotificationCenter() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState({ left: 0, bottom: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;

    const positionPanel = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      setPanelPosition({
        left: Math.min(rect.left, window.innerWidth - 296),
        bottom: window.innerHeight - rect.top + 8,
      });
    };

    positionPanel();
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
    };
  }, [open]);

  const handleClick = async (n: { id: number; entity_type: string | null; entity_id: string | null }) => {
    await markRead(n.id);
    setOpen(false);
    const href = n.entity_type ? ENTITY_HREF[n.entity_type]?.(n.entity_id) : null;
    if (href) navigate(href);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-1 rounded text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors"
        title="Notifications"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ left: Math.max(8, panelPosition.left), bottom: panelPosition.bottom }}
          className="fixed w-72 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-[200] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-slate-600">No new notifications</div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate">{n.title}</div>
                      {n.message && (
                        <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 line-clamp-2">{n.message}</div>
                      )}
                      <div className="text-[10px] text-gray-300 dark:text-slate-600 mt-1">
                        {new Date(n.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
