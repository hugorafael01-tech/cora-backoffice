import { useState } from 'react';
import { useAcompanhamento } from '../../../hooks/useAcompanhamento';
import {
  salvarContextoProducao,
  salvarRealizado,
  type ContextoProducaoInput,
  type RealizadoProducao,
} from '../../../lib/producaoActions';
import { RegistroCard } from './RegistroCard';

interface Props {
  semanaId: string;
  onIrParaVolume: () => void;
}

/**
 * View Registro (Estado C / fatia 1): previsto x realizado + retrospectiva da
 * execucao + nota pos-producao, por producao da semana (canceladas ficam fora).
 * Le via useAcompanhamento (mesma query do Acompanhamento, ja com realizado e
 * contextos_producao); escreve via producaoActions e da refetch apos cada
 * sucesso. Erros surfacearem no banner (padrao erroAcao do B1).
 */
export function Registro({ semanaId, onIrParaVolume }: Props) {
  const { dados, loading, error, refetch } = useAcompanhamento(semanaId);
  const [aberta, setAberta] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  async function rodar(chaveBusy: string, fn: () => Promise<void>) {
    setErroAcao(null);
    setSalvando(chaveBusy);
    try {
      await fn();
      refetch();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(null);
    }
  }

  function onSalvarRealizado(producaoId: string, campos: RealizadoProducao) {
    return rodar(`realizado:${producaoId}`, () => salvarRealizado(producaoId, campos));
  }
  function onSalvarContexto(producaoId: string, campos: ContextoProducaoInput) {
    return rodar(`contexto:${producaoId}`, () => salvarContextoProducao(producaoId, campos));
  }

  if (loading) {
    return <div className="px-5 py-8 text-warm-500 md:px-8">Carregando…</div>;
  }
  if (error) {
    return <div className="px-5 py-8 text-danger-text md:px-8">Erro: {error.message}</div>;
  }

  const producoes = (dados?.producoes ?? []).filter((p) => p.status !== 'cancelada');

  if (producoes.length === 0) {
    return (
      <div className="px-5 py-12 text-center md:px-8">
        <p className="font-display text-[18px] uppercase tracking-[0.04em] text-warm-500">
          Nenhuma produção na semana
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-warm-500">
          Defina o volume e crie as produções pra registrar o realizado.
        </p>
        <button
          onClick={onIrParaVolume}
          className="mt-4 min-h-[44px] rounded-md bg-brand-500 px-5 text-[15px] text-white hover:bg-brand-600"
        >
          Ir para Definir volume
        </button>
      </div>
    );
  }

  return (
    <section className="px-5 pb-10 pt-6 md:px-8">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[13px] uppercase tracking-[0.06em] text-warm-600">
          Registro
        </h2>
        <span className="text-[12px] text-warm-500">previsto x realizado · retrospectiva</span>
      </div>

      {erroAcao && <p className="mb-3 text-[13px] text-danger-text">Erro: {erroAcao}</p>}

      <div className="space-y-2">
        {producoes.map((p) => (
          <RegistroCard
            key={p.id}
            producao={p}
            aberta={aberta === p.id}
            onToggle={() => setAberta((cur) => (cur === p.id ? null : p.id))}
            salvando={salvando}
            onSalvarRealizado={onSalvarRealizado}
            onSalvarContexto={onSalvarContexto}
          />
        ))}
      </div>
    </section>
  );
}
