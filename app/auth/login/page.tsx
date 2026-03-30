'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogIn, Eye, EyeOff } from 'lucide-react';

function toAuthEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}@hmis.h1`;
}

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim() || !password) { setError('Enter User ID and password'); return; }
    setLoading(true);
    setError('');

    const supabase = createClient();
    const authEmail = toAuthEmail(userId);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Invalid User ID or password. Contact admin if you need access.'
          : authError.message
      );
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0f1729] relative overflow-hidden flex-col justify-between p-12">
        {/* Abstract grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />
        {/* Teal glow */}
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute top-20 right-10 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <span className="text-sm font-black text-white">H1</span>
            </div>
            <div>
              <span className="text-lg font-bold text-white">Health1</span>
              <span className="text-[10px] text-white/30 block -mt-0.5 font-medium">Super Speciality Hospitals</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">Hospital Management<br/>Information System</h2>
          <p className="text-sm text-white/40 max-w-sm leading-relaxed">
            Complete digital hospital operations — OPD, IPD, EMR, Lab, Pharmacy, Billing, and 40+ integrated modules.
          </p>
          <div className="flex gap-6 mt-8 text-white/25 text-xs font-medium">
            <div><span className="text-2xl font-bold text-teal-400 block">6</span>Hospitals</div>
            <div><span className="text-2xl font-bold text-teal-400 block">330</span>Beds</div>
            <div><span className="text-2xl font-bold text-teal-400 block">43</span>Modules</div>
            <div><span className="text-2xl font-bold text-teal-400 block">245</span>Tables</div>
          </div>
        </div>

        <div className="relative text-[10px] text-white/20">
          Health1 Super Speciality Hospitals Pvt. Ltd. · HFR: IN2410013685 · CIN: U85110GJ2019PTC109866
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <span className="text-base font-black text-white">H1</span>
              </div>
            </div>
            <h1 className="font-bold text-lg text-gray-900">Health1 HMIS</h1>
            <p className="text-sm text-gray-400">Sign in to continue</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-400 mt-1">Sign in to your account</p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">User ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pw')?.focus()}
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all bg-gray-50 focus:bg-white"
                placeholder="e.g. nisha or h1doc018"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="pw"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin(e)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all bg-gray-50 focus:bg-white pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-[#0f1729] text-white font-medium text-sm rounded-xl hover:bg-[#1a2640] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-900/10"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={16} />
                  Sign in
                </>
              )}
            </button>
          </div>

          <p className="text-center text-[10px] text-gray-300 mt-6">
            Health1 Super Speciality Hospitals · HMIS v2.0
          </p>
        </div>
      </div>
    </div>
  );
}
