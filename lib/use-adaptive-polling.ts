"use client";

import { useEffect, useRef } from "react";

const delays = [5000, 10000, 15000, 30000];

export function useAdaptivePolling(active: boolean, poll: () => Promise<void>) {
  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    if (!active) return;
    let canceled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const schedule = (delay = delays[Math.min(attempt, delays.length - 1)]) => {
      if (!canceled) timer = setTimeout(run, delay);
    };
    const run = async () => {
      if (canceled) return;
      if (document.hidden) {
        schedule(delays[delays.length - 1]);
        return;
      }
      try {
        await pollRef.current();
      } catch {
        // Status refresh failures are transient; the next scheduled poll retries.
      } finally {
        attempt += 1;
        schedule();
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden || canceled) return;
      if (timer) clearTimeout(timer);
      attempt = 0;
      void run();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule();
    return () => {
      canceled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active]);
}
