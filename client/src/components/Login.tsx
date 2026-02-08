import { useState } from 'react';
import { authApi } from '../api/client';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('[Login] Attempting login with:', { email, passwordLength: password.length });
      console.log('[Login] API Base URL:', 'https://upwork.kowope.xyz');
      
      const response = await authApi.login({ email, password });
      console.log('[Login] Login successful:', response);
      
      // Store token and user data
      localStorage.setItem('jwt_token', response.token);
      localStorage.setItem('user_data', JSON.stringify(response.user));
      
      alert('Login successful! Token: ' + response.token.substring(0, 20) + '...');
      onLoginSuccess();
    } catch (err: any) {
      console.error('[Login] Login failed:', err);
      console.error('[Login] Error details:', {
        message: err.message,
        response: err.response,
        request: err.request,
        config: err.config,
        code: err.code,
        stack: err.stack
      });
      
      // Detailed error message for debugging
      let errorMessage = 'Login failed. ';
      
      if (err.response) {
        // Server responded with error
        errorMessage += `Server error: ${err.response.status} - ${JSON.stringify(err.response.data)}`;
        console.error('[Login] Server response:', err.response);
      } else if (err.request) {
        // Request made but no response
        errorMessage += 'No response from server. Check network connection.';
        console.error('[Login] No response received:', err.request);
      } else {
        // Error in request setup
        errorMessage += `Request error: ${err.message}`;
      }
      
      // Show alert for debugging on device
      alert('Login Error: ' + errorMessage);
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Property Enumeration</h1>
          <p className="text-gray-600 mt-2">Sign in to start mapping buildings</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              placeholder="supervisor@example.com"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          For field supervisors only
        </p>
      </div>
    </div>
  );
}
