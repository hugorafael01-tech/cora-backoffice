import { useState } from 'react';
import { usePreparacao } from '../../../hooks/usePreparacao';
import { MiseEnPlace } from './MiseEnPlace';
import { FichaReceita } from './FichaReceita';

interface Props {
  semanaId: string;
  onIrParaVolume: () => void;
}

/** View Preparacao (read-only): mise en place + ficha por receita da semana. */
export function Preparacao({ semanaId, onIrParaVolume }: Props) {
  const { dados, loading, error } = usePreparacao(semanaId);
  const [aberta, setAberta] = useState<string | null>(null);

  if (loading) {
    return <div className="px-5 py-8 text-warm-500 md:px-8">Carregando…</div>;
  }
  if (error) {
    return <div className="px-5 py-8 text-danger-text md:px-8">Erro: {error.message}</div>;
  }
  if (!dados || dados.fichas.length === 0) {
    return (
      <div className="px-5 py-12 text-center md:px-8">
        <p className="font-display text-[18px] uppercase tracking-[0.04em] text-warm-500">
          Nenhuma produção na semana
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-warm-500">
          Defina o volume e crie as produções pra ver o mise en place e as fichas de receita.
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
    <>
      <MiseEnPlace grupos={dados.miseEnPlace} />

      <section className="px-5 pb-10 pt-7 md:px-8">
        <div className="mb-2.5 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-[13px] uppercase tracking-[0.06em] text-warm-600">
            Fichas de receita
          </h2>
          <span className="text-[12px] text-warm-500">
            {dados.fichas.length} {dados.fichas.length === 1 ? 'receita' : 'receitas'} ·{' '}
            {dados.totalPaes} pães
          </span>
        </div>
        <div className="space-y-2">
          {dados.fichas.map((f) => (
            <FichaReceita
              key={f.versaoReceitaId}
              ficha={f}
              aberta={aberta === f.versaoReceitaId}
              onToggle={() =>
                setAberta((cur) => (cur === f.versaoReceitaId ? null : f.versaoReceitaId))
              }
            />
          ))}
        </div>
      </section>
    </>
  );
}
