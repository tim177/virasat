"use client";

import { useEffect, useRef, useState } from "react";

import { AlertCircleIcon } from "@/components/ui/icons";
import { en } from "@/lib/i18n/en";

// Cloudflare Turnstile: a privacy-friendly "are you human?" check on the login forms. Only
// rendered when TURNSTILE_SITE_KEY is set (lib/login-config.ts); the script loads only here.

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      size?: "normal" | "flexible" | "compact";
      theme?: "light" | "dark" | "auto";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile missing"));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * The Turnstile widget. Calls `onToken` with a fresh token (or null when it expires). Change
 * `resetKey` after each use: a token works only once.
 */
export function Turnstile({
  siteKey,
  action,
  resetKey,
  onToken,
}: {
  siteKey: string;
  action: string;
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        widgetRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          action,
          size: "flexible",
          theme: "light",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (widgetRef.current) window.turnstile?.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [siteKey, action]);

  useEffect(() => {
    if (resetKey === 0 || !widgetRef.current) return;
    window.turnstile?.reset(widgetRef.current);
    onTokenRef.current(null);
  }, [resetKey]);

  if (failed) {
    return (
      <p role="alert" className="flex items-start gap-2 text-body-sm text-error">
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
        {en.login.turnstileUnavailable}
      </p>
    );
  }
  // Reserve the widget's height so the form doesn't jump when it appears.
  return <div ref={containerRef} className="min-h-[65px]" data-testid="turnstile" />;
}
