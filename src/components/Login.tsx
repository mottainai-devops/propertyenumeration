import { useState } from 'react';
import { nativeHttp } from '../api/nativeHttp';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

// ─── Debug helper: capture raw HTTP response for on-screen display ─────────────
interface DebugEntry {
  label: string;
  value: string;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // ── Direct raw login test (bypasses App.tsx handleLogin entirely) ────────────
  const handleRawTest = async () => {
    setError('');
    setDebugEntries([]);
    setShowDebug(true);
    setLoading(true);

    const entries: DebugEntry[] = [];
    const add = (label: string, value: any) =>
      entries.push({ label, value: typeof value === 'string' ? value : JSON.stringify(value, null, 2) });

    try {
      const encodedPassword = btoa(password);
      add('1. btoa(password)', encodedPassword.substring(0, 20) + '…');
      add('2. Request body', { email, password: encodedPassword });

      // Make the raw HTTP call directly — no retries, no interceptors
      const response = await nativeHttp.post('/api/mobile/users/login', {
        email,
        password: encodedPassword,
      });

      add('3. HTTP status', response.status);
      add('4. response.data type', typeof response.data);
      add('5. response.data (raw)', response.data);

      // Try to extract token/user from various envelope shapes
      const d = response.data;
      const inner = d?.data ?? d;
      add('6. inner (d?.data ?? d)', inner);
      add('7. inner.token', inner?.token ?? 'MISSING');
      add('8. inner.user', inner?.user ?? 'MISSING');

      if (inner?.token) {
        add('✅ SUCCESS', `Token starts with: ${String(inner.token).substring(0, 20)}…`);
      } else {
        add('❌ No token found', 'Check entries 5-6 above');
      }
    } catch (err: any) {
      add('3. THREW error', err?.message ?? String(err));
      add('4. err.code', err?.code ?? 'none');
      add('5. err.response?.status', err?.response?.status ?? 'none');
      add('6. err.response?.data type', typeof err?.response?.data);
      add('7. err.response?.data', err?.response?.data ?? 'none');
      add('8. err.isAxiosError', err?.isAxiosError ?? false);
    }

    setDebugEntries([...entries]);
    setLoading(false);
  };

  // ── Normal login flow ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onLogin(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Property Enumeration</h1>
          <p className="text-gray-600 mt-2">Sign in to start mapping buildings</p>
          <p className="text-xs text-blue-500 mt-1">v1.43.0 — Debug Build</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="test.supervisor@mottainai.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {/* Debug: Raw HTTP test button */}
          <button
            type="button"
            disabled={loading || !email || !password}
            onClick={handleRawTest}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold py-2 px-4 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            🔍 Raw HTTP Debug Test
          </button>
        </form>

        {/* ── Debug panel ─────────────────────────────────────────────────────── */}
        {showDebug && (
          <div className="mt-4 p-3 bg-gray-900 rounded-lg text-xs text-green-300 font-mono max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-yellow-300 font-bold text-sm">HTTP Debug Output</span>
              <button
                onClick={() => setShowDebug(false)}
                className="text-gray-400 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
            {debugEntries.length === 0 && (
              <div className="text-gray-400">Running…</div>
            )}
            {debugEntries.map((entry, i) => (
              <div key={i} className="mb-2 border-b border-gray-700 pb-1">
                <div className="text-yellow-200 font-semibold">{entry.label}</div>
                <div className="text-green-300 whitespace-pre-wrap break-all">{entry.value}</div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-sm text-gray-600 mt-6">
          For field supervisors only
        </p>
      </div>
    </div>
  );
}
