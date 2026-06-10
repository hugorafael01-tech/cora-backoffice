import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pedirAcesso(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  // Verifica o codigo de 6 digitos do email (mesmo destino do callback do link).
  async function entrarComCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerificando(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: codigo.trim(),
      type: 'email',
    });
    if (error) {
      setError('Código inválido ou expirado. Confira no email e tente de novo.');
      setVerificando(false);
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-50 px-4">
      <div className="max-w-sm w-full bg-white p-8 rounded-lg border border-warm-200">
        <h1 className="font-heading text-3xl text-brand-500 mb-2">Cora Backoffice</h1>

        {sent ? (
          <>
            <p className="text-warm-600 mb-6">
              Enviamos um link e um código pro seu email. No celular, digite o código aqui.
            </p>
            <form onSubmit={entrarComCodigo} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Código do email"
                required
                className="w-full px-3 py-2 border border-warm-200 rounded tracking-[0.3em] text-center text-lg tabular-nums"
              />
              <button
                type="submit"
                disabled={verificando}
                className="w-full bg-brand-500 text-white py-2 rounded hover:bg-brand-600 disabled:opacity-50"
              >
                {verificando ? 'Entrando…' : 'Entrar com código'}
              </button>
              {error && <p className="text-danger-text text-sm">{error}</p>}
            </form>
            <p className="text-warm-500 text-sm mt-4">
              Abriu no computador? O link do email também entra direto.
            </p>
          </>
        ) : (
          <>
            <p className="text-warm-600 mb-6">
              Entre com seu email — enviamos um link e um código de acesso.
            </p>
            <form onSubmit={pedirAcesso} className="space-y-4">
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
                Receber acesso
              </button>
              {error && <p className="text-danger-text text-sm">{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
