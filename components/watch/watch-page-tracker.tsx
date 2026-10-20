"use client";

import { useEffect } from "react";
import { trackClientEvent } from "@/lib/client-events";

export function WatchPageTracker({ dramaId, dramaSlug }: { dramaId: string; dramaSlug: string }) {
  useEffect(() => {
    trackClientEvent("page_view", { dramaId, dramaSlug });
  }, [dramaId, dramaSlug]);
  return null;
}
