'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message === 'Invalid login credentials' ? 'Invalid email or password. Contact admin if you need access.' : authError.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError('Enter your email first'); return; }
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/login`,
    });
    if (resetError) { setError(resetError.message); setLoading(false); return; }
    setResetSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-health1-teal flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">H1</span>
          </div>
          <h1 className="font-display font-bold text-xl text-gray-900">Health1 HMIS</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={mode === 'login' ? handleLogin : handleForgotPassword} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {resetSent ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">📧</div>
              <div className="font-bold text-sm">Password reset email sent</div>
              <div className="text-xs text-gray-500 mt-1">Check your inbox for {email}</div>
              <button type="button" onClick={() => { setMode('login'); setResetSent(false); }} className="mt-4 text-sm text-brand-600 hover:underline">Back to login</button>
            </div>
          ) : (
          <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
              placeholder="you@health1.in"
            />
          </div>

          {mode === 'login' && <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="text-xs text-brand-600 hover:underline">Forgot password?</button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-health1-teal text-white font-medium text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (mode === 'login' ? 'Signing in...' : 'Sending reset...') : (mode === 'login' ? 'Sign in' : 'Send Reset Link')}
          </button>

          {mode === 'forgot' && <button type="button" onClick={() => { setMode('login'); setError(''); }} className="w-full text-sm text-gray-500 hover:underline">Back to login</button>}
          </>
          )}
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Health1 Super Speciality Hospitals Pvt. Ltd.
        </p>
      </div>
    </div>
  );
}
