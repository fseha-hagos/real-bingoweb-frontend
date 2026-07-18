"use client";

import React, { useEffect, useState } from "react";
import { am } from "../constants/amharic";
import { apiClient } from "../lib/api";

type AccessState = "loading" | "granted" | "denied";

const BOT_USERNAME = (
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "winner_bingo_bot"
).replace(/^@/, "");

const WAIT_FOR_WEBAPP_MS = 12000;
const VERIFY_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function waitForTelegramWebApp(maxMs = WAIT_FOR_WEBAPP_MS): Promise<Window["Telegram"]["WebApp"] | null> {
  return new Promise((resolve) => {
    const getWebApp = () => window.Telegram?.WebApp ?? null;

    const tryResolve = () => {
      const webApp = getWebApp();
      if (webApp) {
        try {
          webApp.ready();
        } catch {
          // ignore SDK readiness errors
        }
      }
      if (webApp?.initData) {
        resolve(webApp);
        return true;
      }
      return false;
    };

    if (tryResolve()) return;

    const started = Date.now();
    const interval = window.setInterval(() => {
      if (tryResolve()) {
        window.clearInterval(interval);
        return;
      }

      if (Date.now() - started >= maxMs) {
        window.clearInterval(interval);
        resolve(getWebApp());
      }
    }, 100);
  });
}

async function verifyTelegramAccess(initData: string): Promise<"granted" | "denied" | "unavailable"> {
  try {
    const res = await withTimeout(
      apiClient.verifyTelegramUser(initData),
      VERIFY_TIMEOUT_MS,
      "telegram verify"
    );

    if (!res.success || !res.data) {
      const error = (res.error || "").toLowerCase();
      const explicitAuthFail =
        error.includes("401") ||
        error.includes("403") ||
        error.includes("unauthorized") ||
        error.includes("forbidden") ||
        error.includes("invalid");

      // Network/proxy/cold-start failures shouldn't block Telegram users from opening the app
      return explicitAuthFail ? "denied" : "unavailable";
    }

    const payload = res.data as {
      ok?: boolean;
      success?: boolean;
      data?: { ok?: boolean };
    };
    const isOk = payload.ok === true || payload.data?.ok === true || payload.success === true;
    return isOk ? "granted" : "denied";
  } catch {
    // AbortController / fetch hang in some Telegram WebViews → treat as unavailable
    return "unavailable";
  }
}

export default function TelegramOnlyGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [access, setAccess] = useState<AccessState>("loading");

  useEffect(() => {
    let cancelled = false;

    const authenticate = async () => {
      try {
        const webApp = await waitForTelegramWebApp();

        if (!webApp?.initData) {
          if (!cancelled) setAccess("denied");
          return;
        }

        try {
          webApp.ready();
          webApp.expand();
          webApp.setBackgroundColor("#051622");
        } catch {
          // SDK helpers can throw in some clients; initData is enough for the gate
        }

        const result = await verifyTelegramAccess(webApp.initData);

        if (cancelled) return;

        // Gate purpose: Telegram-only. If backend is cold/unreachable but we have
        // real Telegram initData, let the app open — GameProvider still verifies the user.
        if (result === "granted" || result === "unavailable") {
          setAccess("granted");
        } else {
          setAccess("denied");
        }
      } catch (err) {
        console.error("TelegramOnlyGate failed:", err);
        if (!cancelled) setAccess("denied");
      }
    };

    authenticate();

    return () => {
      cancelled = true;
    };
  }, []);

  if (access === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#051622] text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-300">{am.openingTelegram}</p>
        </div>
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#051622] text-white px-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-3">{am.telegramOnly}</h1>
          <p className="text-gray-300 mb-6">{am.telegramOnlyMessage}</p>
          <a
            href={`https://t.me/${BOT_USERNAME}`}
            className="inline-block bg-[#2AABEE] hover:bg-[#229ED9] text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            {am.openInTelegram}
          </a>
          <p className="text-gray-500 text-sm mt-4">@{BOT_USERNAME}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
