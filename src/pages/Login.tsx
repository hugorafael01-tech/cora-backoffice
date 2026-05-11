import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-50">
      <div className="max-w-sm w-full bg-white p-8 rounded-lg border border-warm-200">
        <h1 className="font-heading text-3xl text-brand-500 mb-2">Cora Backoffice</h1>
        <p className="text-warm-600 mb-6">Entrar via magic link.</p>

        {sent ? (
          <p className="text-warm-600">Link enviado pra {email}. Confere o email.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full px-3 py-2 border border-warm-200 rounded"
            />
            <button
              type="submit"
              className="w-full bg-brand-500 text-white py-2 rounded hover:bg-brand-600"
            >
              Receber link
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
