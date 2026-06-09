import { useState } from 'react';
import { useAcompanhamento } from '../../../hooks/useAcompanhamento';
import {
  avancarEtapa,
  concluirProducao,
  iniciarProducao,
  salvarCapturaEtapa,
  type AcaoEtapa,
  type CapturaEtapa as CapturaEtapaInput,
} from '../../../lib/producaoActions';
import { ProducaoAcompCard } from './ProducaoAcompCard';
import { TempAmbienteCiclo } from './TempAmbienteCiclo';

interface Props {
  semanaId: string;
  dataEntrega: string;
  onIrParaVolume: () => void;
}

/**
 * View Acompanhamento (Estado B / fatia B1): percorre as etapas de cada producao
 * da semana. Le via useAcompanhamento; escreve via producaoActions e da refetch
 * apos cada sucesso. Erros surfacearem no banner (padrao erroAcao da fatia 1).
 */
export function Acompanhamento({ semanaId, dataEntrega, onIrParaVolume }: Props) {
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

  function onAvancar(etapaId: string, acao: AcaoEtapa, producaoId: string) {
    return rodar(etapaId, () => avancarEtapa(etapaId, acao, producaoId));
  }
  function onCaptura(etapaId: string, captura: CapturaEtapaInput) {
    return rodar(etapaId, () => salvarCapturaEtapa(etapaId, captura));
  }
  function onIniciarProd(producaoId: string) {
    return rodar(producaoId, () => iniciarProducao(producaoId));
  }
  function onConcluirProd(producaoId: string) {
    return rodar(producaoId, () => concluirProducao(producaoId));
  }

  if (loading) {
    return <div className="px-5 py-8 text-warm-500 md:px-8">Carregando…</div>;
  }
  if (error) {
    return <div className="px-5 py-8 text-danger-text md:px-8">Erro: {error.message}</div>;
  }
  if (!dados || dados.producoes.length === 0) {
    return (
      <div className="px-5 py-12 text-center md:px-8">
        <p className="font-display text-[18px] uppercase tracking-[0.04em] text-warm-500">
          Nenhuma producao na semana
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-warm-500">
          Defina o volume e crie as producoes pra acompanhar as etapas.
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

  const totalPaes = dados.producoes.reduce((a, p) => a + (p.qtyPrevista ?? 0), 0);

  return (
    <section className="px-5 pb-10 pt-6 md:px-8">
      <TempAmbienteCiclo semanaId={semanaId} dataEntrega={dataEntrega} />

      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[13px] uppercase tracking-[0.06em] text-warm-600">
          Acompanhamento
        </h2>
        <span className="text-[12px] text-warm-500">
          {dados.producoes.length} {dados.producoes.length === 1 ? 'producao' : 'producoes'} ·{' '}
          {totalPaes} paes
        </span>
      </div>

      {erroAcao && (
        <p className="mb-3 text-[13px] text-danger-text">Erro: {erroAcao}</p>
      )}

      <div className="space-y-2">
        {dados.producoes.map((p) => (
          <ProducaoAcompCard
            key={p.id}
            producao={p}
            aberta={aberta === p.id}
            onToggle={() => setAberta((cur) => (cur === p.id ? null : p.id))}
            salvando={salvando}
            onAvancar={onAvancar}
            onCaptura={onCaptura}
            onIniciarProd={onIniciarProd}
            onConcluirProd={onConcluirProd}
          />
        ))}
      </div>
    </section>
  );
}
