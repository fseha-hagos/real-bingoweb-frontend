"use client";

/**
 * Thin Better Auth HTTP client (no better-auth npm package required).
 * Uses same-origin /api/auth/* (Next.js rewrites to the backend).
 */
const API_URL = "https://real-bingoweb-backend.onrender.com";
async function authFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<{ data: T | null; error: { message: string; status?: number } | null }> {
  try {
    const res = await fetch(`${API_URL}/api/auth${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      ...init,
    });

    const json = await res.json().catch(() => ({} as Record<string, unknown>));

    if (!res.ok) {
      const message =
        (typeof json.message === "string" && json.message) ||
        (typeof json.error === "string" && json.error) ||
        (typeof (json as { code?: string }).code === "string" &&
          String((json as { code?: string }).code)) ||
        `Request failed (${res.status})`;
      return { data: null, error: { message, status: res.status } };
    }

    // Some Better Auth errors return 200 with error payload
    if (json && typeof json === "object" && "error" in json && json.error) {
      const err = json.error as string | { message?: string };
      const message =
        typeof err === "string" ? err : err.message || "Authentication error";
      return { data: null, error: { message } };
    }

    return { data: json as T, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : "Network error",
      },
    };
  }
}

export const authClient = {
  phoneNumber: {
    sendOtp: async ({ phoneNumber }: { phoneNumber: string }) =>
      authFetch("/phone-number/send-otp", {
        method: "POST",
        body: JSON.stringify({ phoneNumber }),
      }),

    verify: async ({
      phoneNumber,
      code,
    }: {
      phoneNumber: string;
      code: string;
    }) =>
      authFetch<{
        status?: boolean;
        token?: string;
        user?: { id: string; phoneNumber?: string };
      }>("/phone-number/verify", {
        method: "POST",
        body: JSON.stringify({ phoneNumber, code }),
      }),
  },

  getSession: async () =>
    authFetch<{ user?: { id: string }; session?: unknown }>("/get-session", {
      method: "GET",
    }),

  signOut: async () =>
    authFetch("/sign-out", {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
