'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Convert user ID to internal auth email
// "nisha" → "nisha@hmis.h1"
// "nisha@health1.co.in" → kept as-is (legacy support)
function toAuthEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed; // Already an email — legacy support
  return `${trimmed}@hmis.h1`; // Username → internal auth email
}

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
              <rect x="8" y="0" width="12" height="28" rx="2" fill="#E8B931"/>
              <rect x="0" y="8" width="28" height="12" rx="2" fill="#E8B931"/>
              <rect x="9" y="1" width="10" height="26" rx="1.5" fill="#D4382C"/>
              <rect x="1" y="9" width="26" height="10" rx="1.5" fill="#2A9D8F"/>
              <rect x="9" y="9" width="10" height="10" fill="#1B3A5C"/>
            </svg>
            <span className="text-xl font-bold text-[#1B3A5C] tracking-wide">HEALTH1</span>
          </div>
          <h1 className="font-bold text-lg text-gray-900">Hospital Management System</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
              placeholder="e.g. nisha"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-teal-600 text-white font-medium text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Health1 Super Speciality Hospitals · HMIS
        </p>
      </div>
    </div>
  );
}
