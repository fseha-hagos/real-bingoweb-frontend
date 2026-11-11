"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../lib/api";

const REF_STORAGE_KEY = "wb_ref_inviter";

/**
 * Captures `?ref={userId}` into localStorage, then attaches once the player is logged in.
 */
export default function ReferralCapture() {
  const searchParams = useSearchParams();
  const { status, user } = useAuth();

  useEffect(() => {
    const ref = searchParams.get("ref")?.trim();
    if (ref && ref.length >= 8) {
      try {
        localStorage.setItem(REF_STORAGE_KEY, ref);
      } catch {
        // ignore
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (status !== "authenticated" || !user?.id) return;

    let inviterId: string | null = null;
    try {
      inviterId = localStorage.getItem(REF_STORAGE_KEY);
    } catch {
      return;
    }
    if (!inviterId || inviterId === user.id) return;

    void (async () => {
      try {
        const res = await apiClient.attachReferral(inviterId!);
        if (res.success) {
          localStorage.removeItem(REF_STORAGE_KEY);
        }
      } catch (err) {
        console.error("attachReferral failed", err);
      }
    })();
  }, [status, user?.id]);

  return null;
}
