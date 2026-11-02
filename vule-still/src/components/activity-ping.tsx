"use client";
import { useEffect } from "react";

const MIN_INTERVAL_MS = 5 * 60 * 1000;
let lastPing = 0;

export function ActivityPing() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastPing < MIN_INTERVAL_MS) return;
      lastPing = Date.now();
      void fetch("/api/account-activity", { method: "POST", credentials: "same-origin", cache: "no-store" });
    };
    // Mounted content represents a visible navigation; prefetch does not mount.
    ping();
    document.addEventListener("visibilitychange", ping);
    document.addEventListener("pointerdown", ping);
    document.addEventListener("keydown", ping);
    return () => {
      document.removeEventListener("visibilitychange", ping);
      document.removeEventListener("pointerdown", ping);
      document.removeEventListener("keydown", ping);
    };
  }, []);
  return null;
}
