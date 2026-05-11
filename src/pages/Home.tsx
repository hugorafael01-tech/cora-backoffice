import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function Home() {
  const [user, setUser] = useState<string>('');
  const [subsAtivas, setSubsAtivas] = useState<number | null>(null);
  const [produtos, setProdutos] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user.email || '');

      const { count: subs } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      setSubsAtivas(subs);

      const { count: prods } = await supabase
        .from('produtos')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);
      setProdutos(prods);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen bg-warm-50 p-8">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="font-heading text-4xl text-brand-500">Cora Backoffice</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-warm-600 hover:underline"
          >
            Sair
          </button>
        </header>

        <p className="mb-8 text-warm-600">Logado como <strong>{user}</strong>.</p>

        <div className="bg-white border border-warm-200 rounded p-6 mb-6">
          <h2 className="font-heading text-xl mb-4">Healthcheck</h2>
          <ul className="space-y-2 text-warm-600">
            <li>Assinaturas ativas: <strong>{subsAtivas ?? '…'}</strong></li>
            <li>Produtos ativos no catálogo: <strong>{produtos ?? '…'}</strong></li>
          </ul>
        </div>

        <div className="bg-warm-100 border border-warm-200 rounded p-6">
          <h2 className="font-heading text-xl mb-4">Módulos (em construção)</h2>
          <ul className="space-y-2 text-warm-600 opacity-50">
            <li>Semana — Fase 1</li>
            <li>Produção — Fase 1</li>
            <li>Expedição — Fase 2</li>
            <li>Receitas — Fase 3</li>
            <li>Planejamento — Fase 4</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
