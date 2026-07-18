"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../../lib/auth-client";
import { useAuth } from "../../context/AuthContext";
import { am } from "../../constants/amharic";

function normalizeEthiopianPhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("251")) return `+${digits}`;
  if (digits.startsWith("0")) return `+251${digits.slice(1)}`;
  if (digits.length === 9) return `+251${digits}`;
  return digits;
}

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser, setUser, status } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [national, setNational] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const sendOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setInfo(null);

    const formatted = normalizeEthiopianPhone(national.trim());
    if (!formatted.startsWith("+251") || formatted.length < 13) {
      setError(am.invalidPhone);
      return;
    }

    setLoading(true);
    try {
      const { error: sendError } = await authClient.phoneNumber.sendOtp({
        phoneNumber: formatted,
      });
      if (sendError) {
        setError(sendError.message || am.otpSendFailed);
        return;
      }
      setPhoneE164(formatted);
      setStep("otp");
      setResendIn(60);
      setInfo(am.otpSentHint);
    } catch (err) {
      console.error(err);
      setError(am.otpSendFailed);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: verifyError } = await authClient.phoneNumber.verify({
        phoneNumber: phoneE164,
        code: otp.trim(),
      });

      if (verifyError) {
        setError(verifyError.message || am.otpInvalid);
        return;
      }

      // Prefer loading wallet profile; fall back to verify payload
      // OTP callback may still be writing the welcome bonus — poll briefly
      let user = await refreshUser();
      for (let i = 0; i < 6 && user; i++) {
        const hasBonus =
          Number(user.balance ?? 0) >= 10 || !!user.welcomeBonusClaimed;
        if (hasBonus && Number(user.balance ?? 0) > 0) break;
        await new Promise((r) => setTimeout(r, 350));
        user = (await refreshUser()) || user;
      }
      if (!user && data?.user?.id) {
        await new Promise((r) => setTimeout(r, 400));
        user = await refreshUser();
      }
      if (!user && data?.user?.id) {
        setUser({
          id: data.user.id,
          phoneNumber: data.user.phoneNumber || phoneE164,
          username: null,
          firstName: null,
          lastName: null,
          registered: true,
          balance: 0,
          telegramId: null,
        });
        // Still go home — /api/me will repair bonus on next refresh
        router.replace("/");
        return;
      }
      if (!user) {
        setError(am.sessionCreateFailed);
        return;
      }

      router.replace("/");
    } catch (err) {
      console.error(err);
      setError(am.otpInvalid);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-brand-primary/20 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-brand-secondary/10 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-primary/15 border border-brand-primary/30 mb-5">
              <span className="text-2xl font-black text-brand-accent">WB</span>
            </div>
            <p className="text-brand-accent text-xs font-black tracking-[0.35em] uppercase mb-3">
              Winner Bingo
            </p>
            <h1 className="text-3xl font-black tracking-tight mb-2">{am.loginTitle}</h1>
            <p className="text-sm text-gray-400 leading-relaxed">{am.loginSubtitle}</p>
          </div>

          <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
            {step === "phone" ? (
              <form onSubmit={sendOtp} className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {am.phoneLabel}
                </label>
                <div className="flex gap-2">
                  <div className="rounded-2xl bg-black/30 border border-white/10 px-3 py-3 text-sm text-gray-400 font-bold">
                    +251
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="912345678"
                    value={national}
                    onChange={(e) => setNational(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                    className="flex-1 rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-brand-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-brand-primary py-3.5 text-sm font-black uppercase tracking-widest disabled:opacity-50 active:scale-[0.98] transition"
                >
                  {loading ? am.sendingOtp : am.sendOtp}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-4">
                <p className="text-sm text-gray-300 text-center">
                  {am.otpSentTo}{" "}
                  <span className="text-white font-bold">{phoneE164}</span>
                </p>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {am.otpLabel}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="------"
                  maxLength={8}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white tracking-[0.5em] text-center text-2xl outline-none focus:border-brand-primary"
                />
                <button
                  type="submit"
                  disabled={loading || otp.length < 4}
                  className="w-full rounded-2xl bg-brand-primary py-3.5 text-sm font-black uppercase tracking-widest disabled:opacity-50 active:scale-[0.98] transition"
                >
                  {loading ? am.verifyingOtp : am.verifyOtp}
                </button>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("phone");
                      setOtp("");
                      setError(null);
                      setInfo(null);
                    }}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    {am.changePhone}
                  </button>
                  <button
                    type="button"
                    disabled={resendIn > 0 || loading}
                    onClick={() => sendOtp()}
                    className="text-xs text-brand-secondary disabled:text-gray-600"
                  >
                    {resendIn > 0 ? am.resendIn(resendIn) : am.resendOtp}
                  </button>
                </div>
              </form>
            )}

            {info && (
              <p className="mt-4 text-xs text-emerald-400 text-center leading-relaxed">{info}</p>
            )}
            {error && (
              <p className="mt-4 text-xs text-rose-400 text-center">{error}</p>
            )}
          </div>

          <p className="text-center text-[11px] text-gray-600 mt-6">{am.loginFooter}</p>
        </div>
      </div>
    </div>
  );
}
