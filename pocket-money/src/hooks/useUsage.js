import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "../lib/api";

const FLUSH_EVERY_MS = 60 * 1000;

// Child device: counts seconds while the app is visible and sends them to
// the server every minute, and whenever the app goes to the background.
export function useScreenTimeTracker(active) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    let visibleSince = document.visibilityState === "visible" ? Date.now() : null;
    let pending = 0;

    const collect = () => {
      if (visibleSince !== null) {
        pending += (Date.now() - visibleSince) / 1000;
        visibleSince = Date.now();
      }
    };
    const flush = () => {
      collect();
      const whole = Math.floor(pending);
      if (whole >= 5) {
        pending -= whole;
        api.recordChildUsage(whole).catch(() => {});
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        visibleSince = Date.now();
      } else {
        flush();
        visibleSince = null;
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    const timer = setInterval(flush, FLUSH_EVERY_MS);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [active]);
}

// Parent: { [childId]: { today, week, days: [{ day, seconds }] } } in seconds.
export function useScreenTime(days = 7) {
  return useQuery({
    queryKey: ["childUsage", days],
    queryFn: () => api.listChildUsage(days),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    select: (rows) => {
      const today = new Date().toISOString().slice(0, 10);
      const out = {};
      for (const r of rows) {
        const o = (out[r.child_id] ||= { today: 0, week: 0, days: [] });
        o.week += r.seconds;
        if (r.day === today) o.today += r.seconds;
        o.days.push({ day: r.day, seconds: r.seconds });
      }
      return out;
    },
  });
}

export function formatDuration(seconds = 0) {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
