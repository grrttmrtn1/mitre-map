import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import type { OidcProvider } from '../types';

function ShieldLogo() {
  return (
    <svg width="56" height="56" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="login-shield-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="login-circuit-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#67e8f9" />
        </linearGradient>
      </defs>
      <path d="M14 2L4 6.5V13.5C4 19.2 8.4 24.5 14 26C19.6 24.5 24 19.2 24 13.5V6.5L14 2Z"
        fill="url(#login-shield-grad)" opacity="0.9" />
      <path d="M14 2L4 6.5V13.5C4 19.2 8.4 24.5 14 26C19.6 24.5 24 19.2 24 13.5V6.5L14 2Z"
        stroke="url(#login-circuit-grad)" strokeWidth="0.75" fill="none" opacity="0.6" />
      <line x1="14" y1="9" x2="14" y2="11" stroke="url(#login-circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <line x1="14" y1="11" x2="10" y2="13" stroke="url(#login-circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <line x1="14" y1="11" x2="18" y2="13" stroke="url(#login-circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <line x1="10" y1="13" x2="10" y2="17" stroke="url(#login-circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <line x1="18" y1="13" x2="18" y2="17" stroke="url(#login-circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <line x1="10" y1="17" x2="14" y2="19" stroke="url(#login-circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <line x1="18" y1="17" x2="14" y2="19" stroke="url(#login-circuit-grad)" strokeWidth="1" strokeLinecap="round" />
      <circle cx="14" cy="9" r="1.25" fill="white" opacity="0.9" />
      <circle cx="10" cy="13" r="1" fill="white" opacity="0.7" />
      <circle cx="18" cy="13" r="1" fill="white" opacity="0.7" />
      <circle cx="10" cy="17" r="1" fill="white" opacity="0.7" />
      <circle cx="18" cy="17" r="1" fill="white" opacity="0.7" />
      <circle cx="14" cy="19" r="1.25" fill="white" opacity="0.9" />
    </svg>
  );
}

export default function LoginPage() {
  const { login, user, isBootstrapMode } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<OidcProvider[]>([]);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    api.getPublicOidcProviders().then(providers => setProviders(providers as OidcProvider[])).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  const bgContent = (
    <>
      {/* Animated radial glow blobs */}
      <div className="animate-login-pulse absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)' }} />
      <div className="animate-login-pulse absolute bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', animationDelay: '3s' }} />
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
    </>
  );

  const cardClasses = "relative bg-gray-50 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-300 dark:border-slate-700/80 rounded-2xl p-8 w-full max-w-md shadow-2xl shadow-black/40";

  if (isBootstrapMode) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 relative overflow-hidden flex items-center justify-center p-4">
        {bgContent}
        <div className={`${cardClasses} text-center`}>
          <div className="flex justify-center mb-4"><ShieldLogo /></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">MitreMap</h1>
          <p className="text-gray-500 dark:text-slate-400 mb-6">Running in bootstrap mode — no authentication configured yet.</p>
          <p className="text-gray-700 dark:text-slate-300 text-sm">Create an API key or user account via the Settings page to enable authentication.</p>
          <button onClick={() => navigate('/')} className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors">
            Continue to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 relative overflow-hidden flex items-center justify-center p-4">
      {bgContent}
      <div className={cardClasses}>
        {/* Top accent line */}
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent rounded-full" />

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl bg-blue-500/30 scale-150" />
              <div className="relative"><ShieldLogo /></div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">MitreMap</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">ATT&amp;CK Detection Coverage Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-gray-100 dark:bg-slate-800/80 border border-gray-400 dark:border-slate-600/80 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-gray-100 dark:bg-slate-800/80 border border-gray-400 dark:border-slate-600/80 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-blue-900/30"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {providers.length > 0 && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-slate-700/80" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-gray-50 dark:bg-slate-900/80 px-3 text-gray-400 dark:text-slate-500 text-xs uppercase tracking-widest">or continue with</span>
              </div>
            </div>
            <div className="space-y-2">
              {providers.map(p => (
                <a
                  key={p.id}
                  href={api.getOidcLoginUrl(p.slug)}
                  className="block w-full text-center border border-gray-400 dark:border-slate-600/80 hover:border-blue-500 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white font-medium py-2.5 rounded-lg transition-all hover:bg-blue-500/5"
                >
                  Sign in with {p.name}
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
