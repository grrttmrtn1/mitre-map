import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api } from '../api';
import type { Notification } from '../types';

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [], unreadCount: 0,
  markRead: async () => {}, markAllRead: async () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch { /* not authed yet or server down — silently skip */ }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const markRead = async (id: number) => {
    await api.markNotificationRead(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount: notifications.length, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
