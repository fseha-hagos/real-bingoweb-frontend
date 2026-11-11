"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../lib/api";
import { needsDisplayName } from "../lib/player";
import { am } from "../constants/amharic";
import { toast } from "react-toastify";

const CELEBRATION_KEY = (userId: string) => `wb-welcome-seen-${userId}`;

function isRecentAccount(createdAt?: string | Date | null): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  // Show celebration within 48h of account creation
  return Date.now() - created < 48 * 60 * 60 * 1000;
}

/**
 * First-login flow:
 * 1) Celebrate welcome bonus (once, localStorage)
 * 2) Force display name before playing
 */
export default function OnboardingGate() {
  const { user, setUser, refreshUser } = useAuth();
  const [step, setStep] = useState<"idle" | "celebrate" | "name">("idle");
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const refreshedFor = React.useRef<string | null>(null);

  // Pull fresh balance once per session user (repairs welcome bonus on server)
  useEffect(() => {
    if (!user?.id) return;
    if (refreshedFor.current === user.id) return;
    refreshedFor.current = user.id;
    void refreshUser();
  }, [user?.id, refreshUser]);

  useEffect(() => {
    if (!user?.id) {
      setStep("idle");
      return;
    }

    const needsName = needsDisplayName(user);
    const seen =
      typeof window !== "undefined" &&
      localStorage.getItem(CELEBRATION_KEY(user.id)) === "1";

    const shouldCelebrate =
      (!!user.welcomeBonusClaimed || Number(user.balance ?? 0) >= 10) &&
      isRecentAccount(user.createdAt) &&
      !seen;

    if (shouldCelebrate) {
      setStep("celebrate");
    } else if (needsName) {
      setStep("name");
    } else {
      setStep("idle");
    }
  }, [
    user?.id,
    user?.welcomeBonusClaimed,
    user?.createdAt,
    user?.firstName,
    user?.name,
    user?.username,
    user?.balance,
  ]);

  const dismissCelebration = () => {
    if (user?.id) {
      localStorage.setItem(CELEBRATION_KEY(user.id), "1");
    }
    // Refresh again so wallet UI shows credited balance
    void refreshUser();
    if (needsDisplayName(user)) {
      setStep("name");
    } else {
      setStep("idle");
    }
  };

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    const next = nameInput.trim();
    if (next.length < 2) {
      toast.error(am.nameTooShort);
      return;
    }
    if (next === "ተጫዋች" || /^\+?\d{8,}$/.test(next)) {
      toast.error(am.nameSaveFailed);
      return;
    }

    setSaving(true);
    try {
      const res = await apiClient.updateMe({ name: next });
      if (!res.success || !res.data?.user) {
        toast.error(res.error || am.nameSaveFailed);
        return;
      }
      setUser(res.data.user);
      toast.success(am.nameSaved);
      setStep("idle");
    } catch {
      toast.error(am.nameSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  if (step === "idle") return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {step === "celebrate" && (
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-[2rem] border border-brand-accent/30 bg-brand-bg p-6 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute -top-16 -right-10 w-40 h-40 rounded-full bg-brand-accent/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative z-10 text-center">
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: [0.6, 1.15, 1] }}
                transition={{ duration: 0.6 }}
                className="mx-auto mb-4 w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center"
              >
                <span className="text-3xl font-black text-emerald-400">🎉</span>
              </motion.div>

              <h2 className="text-2xl font-black text-white mb-1">{am.welcomeBonusTitle}</h2>
              <p className="text-sm text-gray-400 mb-4">{am.welcomeBonusSubtitle}</p>

              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 py-4 mb-4">
                <p className="text-3xl font-black text-emerald-400 tracking-tight">
                  {am.welcomeBonusAmount}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80 mt-1">
                  Winner Bingo
                </p>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed mb-6">{am.welcomeBonusBody}</p>

              <button
                type="button"
                onClick={dismissCelebration}
                className="w-full rounded-2xl bg-brand-primary py-3.5 text-sm font-black uppercase tracking-widest active:scale-[0.98] transition"
              >
                {am.welcomeContinue}
              </button>
            </div>
          </motion.div>
        )}

        {step === "name" && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-md rounded-[2rem] border border-white/10 bg-brand-bg p-6 shadow-2xl"
          >
            <h2 className="text-xl font-black text-white mb-1">{am.nameRequiredTitle}</h2>
            <p className="text-sm text-gray-400 mb-5">{am.nameRequiredBody}</p>

            <form onSubmit={saveName} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  {am.displayName}
                </label>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder={am.setYourName}
                  maxLength={40}
                  autoFocus
                  className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3.5 text-white outline-none focus:border-brand-primary"
                />
                <p className="mt-2 text-[11px] text-gray-500">{am.setYourNameHint}</p>
              </div>

              <button
                type="submit"
                disabled={saving || nameInput.trim().length < 2}
                className="w-full rounded-2xl bg-brand-primary py-3.5 text-sm font-black uppercase tracking-widest disabled:opacity-50"
              >
                {saving ? am.saving : am.saveName}
              </button>
            </form>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
