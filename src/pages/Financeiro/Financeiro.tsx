import { useFinanceiro } from '../../hooks/useFinanceiro';
import { Shell } from '../Semana/components/Shell';
import { ResumoCards } from './components/ResumoCards';
import { PanoramaTabela } from './components/PanoramaTabela';
import { OrfaosLista } from './components/OrfaosLista';

export function Financeiro() {
  const { subscriptions, orfaos, resumo, loading, error } = useFinanceiro();

  if (loading) {
    return (
      <Shell>
        <div className="p-8 text-warm-500">Carregando…</div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="p-8 text-danger-text">
          Não foi possível carregar o Financeiro: {error.message}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="px-5 pt-6 md:px-8">
        <h1 className="font-display text-[28px] tracking-wide text-ink-700">Financeiro</h1>
        <p className="text-[14px] text-warm-500">Pagamentos das assinaturas e o que falta identificar.</p>
      </header>

      <ResumoCards resumo={resumo} />
      <PanoramaTabela subscriptions={subscriptions} />
      <OrfaosLista orfaos={orfaos} />
    </Shell>
  );
}
