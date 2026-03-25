"use client";

import React, { useEffect } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { NotificationToast } from "./NotificationToast";
import { showPushIfAllowed } from "@/lib/push-notification";

export function LiveNotificationToast() {
  const { lastReceived, clearLastReceived, preferences } = useNotifications();

  useEffect(() => {
    if (!lastReceived) return;
    if (preferences.pushEnabled && typeof document !== "undefined" && document.hidden) {
      showPushIfAllowed(lastReceived.title, { body: lastReceived.message });
    }
  }, [lastReceived?.id, lastReceived?.title, lastReceived?.message, preferences.pushEnabled]);

  useEffect(() => {
    if (!lastReceived || !preferences.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
      return () => {
        void ctx.close();
      };
    } catch {
      // Ignore if AudioContext not supported
    }
  }, [lastReceived?.id, preferences.soundEnabled]);

  if (!lastReceived) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] max-w-sm animate-fade-in">
      <NotificationToast
        notification={lastReceived}
        onDismiss={clearLastReceived}
      />
    </div>
  );
}
