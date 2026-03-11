import React, { useState } from 'react';
import { apiLogin, setToken } from '../services/api';

interface Props {
  onLogin: (email: string) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await apiLogin(email, password);
      setToken(result.token);
      onLogin(result.email);
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 mb-4">
            <span className="text-white text-xl font-black">TF</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">TradeFeed</h1>
          <p className="text-sm text-zinc-500 mt-1">Sign in to your journal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />

          {error && (
            <p className="text-xs text-rose-500 text-center py-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-indigo-500/8 blur-[140px] rounded-full" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] bg-emerald-500/6 blur-[140px] rounded-full" />
      </div>
    </div>
  );
};
