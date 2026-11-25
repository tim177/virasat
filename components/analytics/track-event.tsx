"use client";

import { useEffect } from "react";

import { track, type AnalyticsEvent, type AnalyticsProperties } from "@/lib/analytics";

/** Sends one analytics event when it appears on screen (e.g. view_item on a product page). */
export function TrackEvent({
  event,
  properties = {},
}: {
  event: AnalyticsEvent;
  properties?: AnalyticsProperties;
}) {
  const key = JSON.stringify(properties);
  useEffect(() => {
    track(event, JSON.parse(key) as AnalyticsProperties);
  }, [event, key]);
  return null;
}
