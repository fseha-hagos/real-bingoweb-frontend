"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../../lib/auth-client";
import { apiClient } from "../../lib/api";
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

function phoneToUsername(e164: string): string {
  return e164.replace(/\D/g, "");
}

type Mode = "login" | "signup";
type SignupMethod = "username" | "phone";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser, setUser, status, user } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [signupMethod, setSignupMethod] = useState<SignupMethod>("username");
  const [signupStep, setSignupStep] = useState<"phone" | "otp" | "password">("phone");

  // Form states
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [national, setNational] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const needsPassword = status === "authenticated" && user?.hasPassword === false;

  useEffect(() => {
    // AuthContext keeps us on /login when hasPassword is false
    if (needsPassword) {
      setMode("signup");
      setSignupMethod("phone");
      setSignupStep("password");
      setInfo(am.setPasswordHint);
      if (user?.phoneNumber) setPhoneE164(user.phoneNumber);
    }
  }, [needsPassword, user?.phoneNumber]);

  useEffect(() => {
    // Fully signed-in users leave login
    if (status === "authenticated" && user?.hasPassword !== false) {
      router.replace("/");
    }
  }, [status, user?.hasPassword, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setSignupStep("phone");
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setInfo(null);
  };

  const finishAuth = async () => {
    let user = await refreshUser();
    for (let i = 0; i < 6 && user; i++) {
      const hasBonus =
        Number(user.balance ?? 0) >= 10 || !!user.welcomeBonusClaimed;
      if (hasBonus && Number(user.balance ?? 0) > 0) break;
      await new Promise((r) => setTimeout(r, 350));
      user = (await refreshUser()) || user;
    }
    if (!user) {
      setError(am.sessionCreateFailed);
      return false;
    }
    router.replace("/");
    return true;
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const rawId = loginIdentifier.trim();
    if (!rawId) {
      setError("Please enter your username or phone number");
      return;
    }
    if (!password) {
      setError(am.passwordRequired);
      return;
    }

    // Determine if it's a phone number or username
    let resolvedUsername = rawId;
    if (/^\+?251\d+$/.test(rawId) || /^09\d{8}$/.test(rawId) || /^07\d{8}$/.test(rawId)) {
      resolvedUsername = phoneToUsername(normalizeEthiopianPhone(rawId));
    }

    setLoading(true);
    try {
      const { error: signError } = await authClient.signIn.username({
        username: resolvedUsername,
        password,
      });
      if (signError) {
        setError(signError.message || am.loginFailed);
        setInfo(am.loginNoPasswordHint);
        return;
      }
      await finishAuth();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || am.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }
    if (password.length < 6) {
      setError(am.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(am.passwordMismatch);
      return;
    }

    let phoneValue: string | undefined = undefined;
    if (national.trim()) {
      const formatted = normalizeEthiopianPhone(national.trim());
      if (!formatted.startsWith("+251") || formatted.length < 13) {
        setError(am.invalidPhone);
        return;
      }
      phoneValue = formatted;
    }

    setLoading(true);
    try {
      const regResult = await authClient.register({
        username: cleanUsername,
        password,
        name: displayName.trim() || cleanUsername,
        phoneNumber: phoneValue,
      });

      if (regResult.error) {
        setError(regResult.error.message || "Registration failed");
        return;
      }

      // Immediately sign in with the new credentials
      const { error: signError } = await authClient.signIn.username({
        username: cleanUsername,
        password,
      });

      if (signError) {
        setError("Account created, but sign in failed. Please log in.");
        setMode("login");
        setLoginIdentifier(cleanUsername);
        return;
      }

      await finishAuth();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

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
      setSignupStep("otp");
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

      let user = await refreshUser();
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
          hasPassword: false,
        });
      } else if (user) {
        setUser({ ...user, hasPassword: false });
      }
      setPassword("");
      setConfirmPassword("");
      setSignupStep("password");
      setInfo(am.setPasswordHint);
    } catch (err) {
      console.error(err);
      setError(am.otpInvalid);
    } finally {
      setLoading(false);
    }
  };

  const createPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError(am.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(am.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.setPassword(password);
      if (!res.success) {
        setError(res.error || am.setPasswordFailed);
        return;
      }
      if (res.data?.user) {
        setUser(res.data.user);
      }
      await finishAuth();
    } catch (err) {
      console.error(err);
      setError(am.setPasswordFailed);
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "login" ? am.loginTitle : am.signupTitle;
  const subtitle =
    mode === "login"
      ? am.loginSubtitle
      : signupStep === "password"
        ? am.setPasswordTitle
        : am.signupSubtitle;

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
            <h1 className="text-3xl font-black tracking-tight mb-2">{title}</h1>
            <p className="text-sm text-gray-400 leading-relaxed">{subtitle}</p>
          </div>

          <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
            {!(mode === "signup" && signupStep === "password") && (
              <div className="grid grid-cols-2 gap-2 mb-6 p-1 rounded-2xl bg-black/30 border border-white/10">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={`rounded-xl py-2.5 text-xs font-black uppercase tracking-widest transition ${
                    mode === "login"
                      ? "bg-brand-primary text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {am.tabLogin}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`rounded-xl py-2.5 text-xs font-black uppercase tracking-widest transition ${
                    mode === "signup"
                      ? "bg-brand-primary text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {am.tabSignup}
                </button>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                    Username or Phone Number
                  </label>
                  <input
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. john_doe or 0912345678"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-brand-primary text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                    {am.passwordLabel}
                  </label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-brand-primary text-sm"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-brand-primary py-3.5 text-sm font-black uppercase tracking-widest disabled:opacity-50 active:scale-[0.98] transition hover:bg-brand-primary/90 mt-2"
                >
                  {loading ? am.loggingIn : am.loginButton}
                </button>
              </form>
            )}

            {/* SIGNUP FORM (USERNAME + PASSWORD) */}
            {mode === "signup" && signupMethod === "username" && signupStep !== "password" && (
              <form onSubmit={handleUsernameSignup} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                    Username <span className="text-brand-accent">*</span>
                  </label>
                  <input
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. bingo_winner"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
                    className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-brand-primary text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                    Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-brand-primary text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                    Phone Number (Optional)
                  </label>
                  <div className="flex gap-2">
                    <div className="rounded-2xl bg-black/30 border border-white/10 px-3 py-3 text-sm text-gray-400 font-bold">
                      +251
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="912345678"
                      value={national}
                      onChange={(e) =>
                        setNational(e.target.value.replace(/[^\d]/g, "").slice(0, 10))
                      }
                      className="flex-1 rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-brand-primary text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                    Password <span className="text-brand-accent">*</span>
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-brand-primary text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                    Confirm Password <span className="text-brand-accent">*</span>
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-brand-primary text-sm"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-brand-primary py-3.5 text-sm font-black uppercase tracking-widest disabled:opacity-50 active:scale-[0.98] transition hover:bg-brand-primary/90 mt-2 shadow-lg shadow-brand-primary/20"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setSignupMethod("phone");
                      setSignupStep("phone");
                    }}
                    className="text-xs text-brand-secondary hover:underline"
                  >
                    Or Register via SMS OTP
                  </button>
                </div>
              </form>
            )}

            {/* SIGNUP VIA PHONE OTP (OPTIONAL ALTERNATIVE) */}
            {mode === "signup" && signupMethod === "phone" && signupStep === "phone" && (
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
                    onChange={(e) =>
                      setNational(e.target.value.replace(/[^\d]/g, "").slice(0, 10))
                    }
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
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setSignupMethod("username")}
                    className="text-xs text-brand-secondary hover:underline"
                  >
                    Back to Username Registration
                  </button>
                </div>
              </form>
            )}

            {/* OTP VERIFICATION STEP */}
            {mode === "signup" && signupMethod === "phone" && signupStep === "otp" && (
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
                      setSignupStep("phone");
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

            {/* SET PASSWORD STEP */}
            {mode === "signup" && signupStep === "password" && (
              <form onSubmit={createPassword} className="space-y-4">
                <p className="text-sm text-gray-300 text-center leading-relaxed">
                  {am.setPasswordHint}
                </p>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {am.passwordLabel}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-brand-primary"
                />
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {am.confirmPasswordLabel}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-brand-primary"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-brand-primary py-3.5 text-sm font-black uppercase tracking-widest disabled:opacity-50 active:scale-[0.98] transition"
                >
                  {loading ? am.saving : am.setPasswordTitle}
                </button>
              </form>
            )}

            {error && (
              <div className="mt-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-bold">
                {error}
              </div>
            )}
            {info && (
              <div className="mt-4 p-3 rounded-2xl bg-brand-secondary/10 border border-brand-secondary/20 text-brand-secondary text-xs text-center font-bold">
                {info}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
