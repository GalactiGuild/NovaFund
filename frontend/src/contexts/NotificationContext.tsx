"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Notification, NotificationPreferences } from "@/types/notifications";
import { loadPreferences, savePreferences } from "@/lib/notification-preferences";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  connectionStatus: ConnectionStatus;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  preferences: NotificationPreferences;
  setPreferences: (prefs: NotificationPreferences) => void;
  /** Trigger a live notification (e.g. for push/toast) - last received */
  lastReceived: Notification | null;
  clearLastReceived: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const MAX_BACKOFF_MS = 30000;
const INITIAL_RECONNECT_MS = 1000;

function getStreamUrl(): string {
  if (typeof window === "undefined") return "";
  const base = window.location.origin;
  return `${base}/api/notifications/stream`;
}

function getHistoryUrl(): string {
  if (typeof window === "undefined") return "";
  const base = window.location.origin;
  return `${base}/api/notifications/history`;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [preferences, setPreferencesState] = useState<NotificationPreferences>(
    loadPreferences
  );
  const [lastReceived, setLastReceived] = useState<Notification | null>(null);
  const backoffRef = useRef(INITIAL_RECONNECT_MS);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = useCallback(async () => {
    const url = getHistoryUrl();
    if (!url) return;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as Notification[];
        setNotifications((prev) => {
          const byId = new Map(prev.map((n) => [n.id, n]));
          data.forEach((n) => byId.set(n.id, { ...n, read: byId.get(n.id)?.read ?? n.read }));
          return Array.from(byId.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }
    } catch {
      // Offline or error; keep existing state
    }
  }, []);

  const connect = useCallback(() => {
    const url = getStreamUrl();
    if (!url) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionStatus("connecting");
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnectionStatus("connected");
      backoffRef.current = INITIAL_RECONNECT_MS;
    };

    es.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data) as Notification;
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notification.id)) return prev;
          return [notification, ...prev].slice(0, 200);
        });
        setLastReceived(notification);
      } catch {
        // ignore malformed
      }
    };

    es.onerror = () => {
      setConnectionStatus("disconnected");
      es.close();
      eventSourceRef.current = null;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        backoffRef.current = Math.min(
          MAX_BACKOFF_MS,
          backoffRef.current * 1.5
        );
        connect();
      }, backoffRef.current);
    };
  }, []);

  useEffect(() => {
    fetchHistory();
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect, fetchHistory]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const setPreferences = useCallback((prefs: NotificationPreferences) => {
    setPreferencesState(prefs);
    savePreferences(prefs);
  }, []);

  const clearLastReceived = useCallback(() => setLastReceived(null), []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    connectionStatus,
    markAsRead,
    markAllAsRead,
    preferences,
    setPreferences,
    lastReceived,
    clearLastReceived,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
