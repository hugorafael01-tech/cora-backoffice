import { useMemo, useState } from 'react';
import { usePrevia } from '../../hooks/usePrevia';
import { mesAnterior, reais } from '../../lib/previa';
import { Shell } from '../Semana/components/Shell';
import { AlertasPainel } from './components/AlertasPainel';
import { GrupoCard } from './components/GrupoCard';
import { opcoesDePeriodo, periodoPadrao, rotuloPeriodo } from './periodo';
import { PESO_POR_CODIGO } from './types';

export function Previa() {
  const padrao = useMemo(() => periodoPadrao(new Date()), []);
  const [periodo, setPeriodo] = useState(padrao);
  const { previa, loading, error } = usePrevia(periodo);

  const bloqueios = previa
    ? previa.alertas.filter((a) => PESO_POR_CODIGO[a.codigo] === 'bloqueia').length
    : 0;

  return (
    <Shell>
      <header className="px-5 pt-6 md:px-8">
        <h1 className="font-display text-[28px] tracking-wide text-ink-700">Prévia de cobrança</h1>
        <p className="text-[14px] text-warm-500">
          O que vai ser cobrado de cada pessoa, para conferir antes de gerar.
        </p>

        <label className="mt-3 flex flex-wrap items-baseline gap-2 text-[14px]">
          <span className="text-warm-500">Cobrança de</span>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="rounded-md border border-warm-200 bg-white px-2 py-1 text-ink-700"
          >
            {opcoesDePeriodo(padrao).map((p) => (
              <option key={p} value={p}>
                {rotuloPeriodo(p)}
              </option>
            ))}
          </select>
          <span className="text-[13px] text-warm-400">
            com os extras das quintas de {rotuloPeriodo(mesAnterior(periodo))}
          </span>
        </label>
      </header>

      {loading && <div className="p-8 text-warm-500">Carregando…</div>}

      {error && (
        <div className="p-8 text-danger-text">
          Não foi possível montar a prévia: {error.message}
        </div>
      )}

      {previa && !loading && !error && (
        <>
          <AlertasPainel alertas={previa.alertas} />

          {previa.grupos.length === 0 ? (
            <p className="px-5 py-6 text-warm-500 md:px-8">
              Nenhuma assinatura entra nesta cobrança.
            </p>
          ) : (
            <ul className="space-y-2 px-5 py-2 md:px-8">
              {previa.grupos.map((g) => (
                <GrupoCard key={g.pagadorId} grupo={g} />
              ))}
            </ul>
          )}

          <footer className="sticky bottom-0 border-t border-warm-200 bg-warm-50/95 px-5 py-3 backdrop-blur md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[12px] text-warm-500">
                  {previa.grupos.length === 1 ? '1 cobrança' : `${previa.grupos.length} cobranças`}
                </div>
                <div className="font-display text-[26px] leading-none tabular-nums text-ink-700">
                  {reais(previa.totalGeral)}
                </div>
              </div>

              <div className="text-right">
                {/* Botão único e geral, nunca por linha: a geração roda o ciclo
                    inteiro de uma vez, e um botão por pessoa convidaria a gerar
                    parcial numa tela com alerta em aberto. */}
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-md bg-warm-200 px-4 py-2 text-[14px] text-warm-500"
                >
                  Gerar cobranças
                </button>
                <div className="mt-1 text-[12px] text-warm-400">
                  {bloqueios > 0
                    ? 'Resolva o que bloqueia antes de gerar. A ação chega na fase 3.'
                    : 'A ação de gerar chega na fase 3.'}
                </div>
              </div>
            </div>
          </footer>
        </>
      )}
    </Shell>
  );
}
