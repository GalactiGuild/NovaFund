/** Request permission and show a browser notification when app is in background. Call when a new notification is received. */
export async function showPushIfAllowed(
  title: string,
  options?: { body?: string; tag?: string }
): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!document.hidden) return;

  try {
    const n = new Notification(title, {
      body: options?.body ?? "",
      tag: options?.tag ?? "novafund",
      icon: "/favicon.ico",
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Ignore
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}
