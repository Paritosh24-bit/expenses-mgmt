import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Shield, Key, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const navigate = useNavigate();

  // On mount, verify the user session has been successfully populated from the URL hash
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Many email clients pre-render or open links, sometimes expiring tokens early.
        // It's helpful to warn the user if no session token was detected
        console.warn("No recovery session state detected. Ensure you reached this URL directly from the emailed link.");
      }
    };
    checkSession();
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        setError(updateError.message);
        setIsLoading(false);
        return;
      }

      setSuccess("Your account password has been updated securely.");
      // Sign the user out to make sure they complete a full re-login cycle with the new credentials
      await supabase.auth.signOut();
    } catch (err: any) {
      setError(err.message || "Failed to update security credentials.");
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
          
          {/* Header Brand */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg inline-block">
                <Shield className="w-8 h-8" />
              </div>
            </div>
            <h2 className="text-2xl font-sans font-extrabold text-slate-900 tracking-tight">
              Create New Password
            </h2>
            <p className="text-sm text-slate-500 mt-1.5 font-medium leading-relaxed">
              Complete your security details below to override your old password.
            </p>
          </div>

          {success ? (
            <div className="text-center py-4">
              <div className="flex justify-center text-emerald-500 mb-4 animate-bounce">
                <CheckCircle className="w-14 h-14" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Credentials Updated!</h3>
              <p className="text-sm text-slate-500 mt-2 mb-6 leading-relaxed">
                {success}
              </p>
              <Link
                to="/login"
                className="inline-flex w-full justify-center items-center gap-2 px-4 py-3 bg-slate-950 hover:bg-slate-900 text-white rounded-lg text-sm font-semibold transition"
              >
                Sign in with new password
              </Link>
            </div>
          ) : (
            <form onSubmit={handlePasswordUpdate} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                    placeholder="Re-type new password"
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
                    Updating credentials...
                  </span>
                ) : (
                  "Confirm and Update Password"
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Cancel and return to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
