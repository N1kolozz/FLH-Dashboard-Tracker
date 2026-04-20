"use client";

import { useState, useRef } from "react";
import { checkEmail, login } from "../actions/auth";
import FlhIconMark from "@/components/FlhIconMark";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submittedRef = useRef(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || submittedRef.current) return;
    submittedRef.current = true;
    setLoading(true);
    setError("");

    const res = await checkEmail(email);

    if (res.error) {
      setError(res.error);
      setLoading(false);
      submittedRef.current = false;
    } else if (!res.exists) {
      setError("Email not found. Only admins can register users.");
      setLoading(false);
      submittedRef.current = false;
    } else if (!res.hasPassword) {
      window.location.href = `/create-password?email=${encodeURIComponent(email)}`;
    } else {
      setLoading(false);
      submittedRef.current = false;
      setStep("password");
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || submittedRef.current) return;
    submittedRef.current = true;
    setLoading(true);
    setError("");

    const res = await login(email, password);

    if (res.error) {
      setError(res.error);
      setLoading(false);
      submittedRef.current = false;
    } else {
      // Hard redirect — browser sends new cookie on fresh GET request
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden shadow-purple-900/5">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 overflow-hidden bg-white flex items-center justify-center">
              <FlhIconMark
                width={56}
                height={58}
                title="FLH Logo"
                className="h-14 w-14"
              />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
            Welcome Back
          </h2>
          <p className="text-sm text-center text-slate-500 mb-8">
            Access your department dashboard
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm">
              {error}
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors outline-none text-slate-700"
                  placeholder="name@flh.org"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium shadow-md shadow-purple-600/20 transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  "Continue"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="flex items-center justify-between mb-4 bg-slate-50 p-3 rounded-xl">
                <span className="text-sm text-slate-600 font-medium truncate">{email}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setPassword("");
                    setError("");
                  }}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  Change
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors outline-none text-slate-700"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium shadow-md shadow-purple-600/20 transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
