/**
 * AuthCallbackPage — handles Supabase email confirmation redirects.
 * Supabase sends the user back to /auth/callback with a `code` or `token` in the URL.
 * This page exchanges that for a session and sends the user into the app.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase.js';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function handleCallback() {
      try {
        // Supabase redirects back with ?code=... (PKCE flow) or #access_token=... (implicit)
        // supabase-js automatically picks it up from the URL.
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data?.session) {
          setStatus('success');
          setTimeout(() => navigate('/app', { replace: true }), 1500);
          return;
        }

        // Try exchanging the code from the URL hash/search params
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        if (exchangeError) throw exchangeError;

        setStatus('success');
        setTimeout(() => navigate('/app', { replace: true }), 1500);
      } catch (err) {
        console.error('Auth callback error:', err);
        setErrorMsg(err.message || 'Verification failed. Please try signing in again.');
        setStatus('error');
      }
    }

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 px-4">
      {/* Brand */}
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-sky-500/20">
        <Plane size={26} className="rotate-[-20deg]" />
      </div>

      {status === 'loading' && (
        <div className="text-center">
          <Loader2 size={36} className="animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-lg font-extrabold text-navy">Verifying your email…</h2>
          <p className="text-sm text-ink-soft mt-1">Just a moment, setting up your account.</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center">
          <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-lg font-extrabold text-navy">Email Confirmed!</h2>
          <p className="text-sm text-ink-soft mt-1">Taking you to your TripSync dashboard…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center max-w-sm">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-extrabold text-navy">Verification Failed</h2>
          <p className="text-sm text-ink-soft mt-1 mb-4">{errorMsg}</p>
          <button
            className="btn-primary w-full py-3 text-sm"
            onClick={() => navigate('/login', { replace: true })}
          >
            Back to Sign In
          </button>
        </div>
      )}
    </div>
  );
}
