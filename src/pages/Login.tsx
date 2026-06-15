import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff, AlertCircle, Key, Mail, CheckCircle, Smartphone, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { CompanyLogo } from "../components/CompanyLogo";

export const Login: React.FC = () => {
  const { needsBootstrap, checkBootstrapStatus } = useAuth();
  
  // Login Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Recovery Engine States
  const [loginMode, setLoginMode] = useState<"login" | "forgot_request" | "forgot_verify" | "forgot_success">("login");
  const [resetEmail, setResetEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Bootstrap Admin Form States
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [bootstrapSuccess, setBootstrapSuccess] = useState<string | null>(null);

  const navigate = useNavigate();

  // Handler for OTP request dispatch
  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResetError(null);
    setResetSuccess(null);

    if (!resetEmail) {
      setResetError("Please key in your registered email address.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/forgot-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch password reset code.");
      }

      setLoginMode("forgot_verify");
      setResetSuccess("A secure verification code has been dispatched to your email address.");
    } catch (err: any) {
      setResetError(err.message || "An unexpected error occurred during password recovery.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for verification & actual override
  const handleResetVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResetError(null);

    if (!otp) {
      setResetError("Please key in the 6-digit verification code sent to your email.");
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setResetError("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail.trim(),
          otp: otp.trim(),
          newPassword: newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      setLoginMode("forgot_success");
      setResetSuccess(data.message || "Your password has been successfully updated.");
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password. Please verify the code and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    if (!email || !password) {
      setAuthError("Please fill in all email and password fields.");
      setIsLoading(false);
      return;
    }

    try {
      // 1. Submit email and password to Supabase auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthError(error.message);
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // 2. Fetch profile of logging-in user
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", data.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          setAuthError("No profile is registered for this email on the system.");
          setIsLoading(false);
          return;
        }

        if (!profile.is_active) {
          await supabase.auth.signOut();
          setAuthError("Your employee account has been deactivated. Access denied.");
          setIsLoading(false);
          return;
        }

        // 3. User is valid and active. Redirection is handled reactive by RouteGuards or we navigate directly
        if (profile.role === "admin") {
          navigate("/admin-dashboard");
        } else if (profile.role === "accounts") {
          navigate("/accounts-dashboard");
        } else {
          navigate("/employee-dashboard");
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "An unexpected error occurred during auth.");
    } finally {
      setIsLoading(false);
    }
  };

  // Bootstrap initial Admin handler
  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    if (!adminName || !adminEmail || !adminPassword) {
      setAuthError("All setup fields are required to register an Administrator.");
      setIsLoading(false);
      return;
    }

    if (adminPassword.length < 6) {
      setAuthError("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/setup/bootstrap-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: adminName,
          email: adminEmail,
          password: adminPassword,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to initialize Admin profile.");
      }

      setBootstrapSuccess(result.message || "Setup completed successfully!");
      setEmail(adminEmail);
      await checkBootstrapStatus(); // Update context status
    } catch (err: any) {
      setAuthError(err.message || "Admin setup failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-100 to-slate-200 px-4 py-12 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full"
      >
        <div className="bg-white py-10 px-8 rounded-2xl shadow-xl border border-slate-100">
          
          {/* Header Brand and Title block */}
          <div className="text-center mb-8">
            <CompanyLogo variant="full" iconSize={64} />
            <h2 id="login-portal-title" className="text-lg font-extrabold text-slate-900 mt-4 leading-tight">
              Expense Approval & Audit Portal
            </h2>
            <p className="text-xs text-slate-450 uppercase tracking-widest mt-1 font-bold">
              Secure Staff Portal login
            </p>
          </div>

          {/* Render Bootstrapping view if no profiles exist */}
          {needsBootstrap ? (
            <div>
              <div className="p-4 mb-6 bg-slate-50 border-l-4 border-slate-800 rounded-r-lg">
                <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                  🛠️ DATABASE DETECTED EMPTY: <br />
                  Initialize your primary Administrator profile below to get started. You can login with these credentials immediately afterwards.
                </p>
              </div>

              {bootstrapSuccess ? (
                <div className="text-center py-6">
                  <div className="flex justify-center text-green-500 mb-3">
                    <CheckCircle className="w-12 h-12" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Success!</h3>
                  <p className="text-sm text-slate-500 mt-1 mb-6">{bootstrapSuccess}</p>
                  <button
                    onClick={() => {
                      setBootstrapSuccess(null);
                      setAdminName("");
                      setAdminEmail("");
                      setAdminPassword("");
                    }}
                    className="w-full bg-slate-950 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition"
                  >
                    Go to Login Form
                  </button>
                </div>
              ) : (
                <form onSubmit={handleBootstrap} className="space-y-5">
                  {authError && (
                    <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Admin Full Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="e.g. Rachel Adams"
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Admin Email Address
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@company.com"
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Admin Default Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <Key className="w-4 h-4" />
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 inline-flex items-center justify-center bg-slate-950 hover:bg-slate-900 text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-slate-950 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Initializing Server admin...
                      </span>
                    ) : (
                      "Provision First Admin Profile"
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : loginMode === "forgot_request" ? (
            /* Forgot Password Request Mode */
            <form onSubmit={handleResetRequest} className="space-y-5">
              <div className="mb-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Password Recovery Step 1 of 2
                </span>
                <h3 className="text-lg font-bold text-slate-950 mt-1">Request Reset Code</h3>
                <p className="text-xs text-slate-500 mt-1">
                  We will dispatch a secure single-use 6-digit OTP to override your account password.
                </p>
              </div>

              {resetError && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-100">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Registered Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center bg-slate-950 hover:bg-slate-900 text-white rounded-lg px-4 py-3 text-sm font-semibold shadow-md transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-slate-950 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Dispatching Code...
                  </span>
                ) : (
                  "Dispatch OTP"
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("login");
                    setResetError(null);
                    setResetSuccess(null);
                  }}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-950 focus:outline-hidden"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to standard Login
                </button>
              </div>
            </form>
          ) : loginMode === "forgot_verify" ? (
            /* Forgot Password Verify OTP & Reset Mode */
            <form onSubmit={handleResetVerify} className="space-y-5">
              <div className="mb-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Password Recovery Step 2 of 2
                </span>
                <h3 className="text-lg font-bold text-slate-950 mt-1">Verify OTP Pin</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Input the verification code and keyset to re-authenticate credentials.
                </p>
              </div>

              {resetError && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-100">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all font-mono tracking-widest text-center text-lg font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 focus:outline-hidden"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center bg-slate-950 hover:bg-slate-900 text-white rounded-lg px-4 py-3 text-sm font-semibold shadow-md transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-slate-950 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Overriding security locks...
                  </span>
                ) : (
                  "Reset Password"
                )}
              </button>

              <div className="flex justify-between items-center text-xs font-semibold pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("forgot_request");
                    setOtp("");
                    setResetError(null);
                  }}
                  className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-950 focus:outline-hidden"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("login");
                    setOtp("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setResetError(null);
                  }}
                  className="text-slate-500 hover:text-slate-950 focus:outline-hidden"
                >
                  Return to Login
                </button>
              </div>
            </form>
          ) : loginMode === "forgot_success" ? (
            /* Forgot Password Success Mode */
            <div className="text-center py-6 space-y-4">
              <div className="flex justify-center text-emerald-500 mb-2">
                <CheckCircle className="w-14 h-14" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Credentials Overridden!</h3>
              <p className="text-xs text-slate-500 leading-relaxed px-2">
                Your password has been successfully updated. You can now use your brand-new credentials to log into your account securely.
              </p>
              
              <button
                type="button"
                onClick={() => {
                  setLoginMode("login");
                  setResetEmail("");
                  setOtp("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setResetError(null);
                  setResetSuccess(null);
                }}
                className="w-full inline-flex items-center justify-center bg-slate-950 hover:bg-slate-900 text-white rounded-lg px-4 py-3 text-sm font-semibold shadow-md transition-colors"
              >
                Proceed to Login Form
              </button>
            </div>
          ) : (
            /* Standard Login Form */
            <form onSubmit={handleLogin} className="space-y-5">
              {authError && (
                <div id="login-error-message" className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter raw email..."
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode("forgot_request");
                      setResetEmail(email); // autofill current input as placeholder
                      setResetError(null);
                      setResetSuccess(null);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-950 transition-colors focus:outline-hidden"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    id="password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 focus:outline-hidden"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="login-button"
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 inline-flex items-center justify-center bg-slate-950 hover:bg-slate-900 text-white rounded-lg px-4 py-3 text-sm font-semibold shadow-md active:bg-slate-950 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-slate-950 disabled:opacity-50"
              >
                {isLoading ? (
                  <span id="loading-spinner" className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing session...
                  </span>
                ) : (
                  "Login securely"
                )}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
            Secure administrative platform. All login attempts logged and monitored.
          </div>
        </div>
      </motion.div>
    </div>
  );
};
