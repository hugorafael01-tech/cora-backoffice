import { formataDiaMes } from '../../../lib/date';
import { cicloLabel } from '../../../lib/semana';
import { CicloSwitcher } from '../../Producao/components/CicloSwitcher';
import type { ExpedicaoSemana } from '../types';

interface Props {
  semana: ExpedicaoSemana;
  temEntregas: boolean;
  gerando: boolean;
  onGerar: () => void;
}

/** Header da Expedicao: identidade do ciclo + switcher + gerar/atualizar. */
export function EdHeader({ semana, temEntregas, gerando, onGerar }: Props) {
  const titulo = cicloLabel(semana.data_entrega);
  const subtitulo = `Semana ISO ${semana.numero} · ${formataDiaMes(semana.data_inicio)} — ${formataDiaMes(
    semana.data_entrega
  )}`;
  const labelGerar = gerando
    ? 'Gerando…'
    : temEntregas
      ? 'Atualizar da demanda'
      : 'Gerar expedição';

  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-warm-200 px-5 py-5 md:px-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.04em] text-warm-500">expedição</div>
        <h1 className="font-display text-[26px] leading-tight text-ink-700 md:text-[30px]">
          {titulo}
        </h1>
        <div className="mt-1 text-[13px] text-warm-500">{subtitulo}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-warning-border bg-warning-bg px-2.5 py-1 text-[11px] text-warning-text">
          período de testes
        </span>
        <CicloSwitcher basePath="/expedicao" />
        <button
          onClick={onGerar}
          disabled={gerando}
          className="h-11 rounded-md bg-brand-500 px-4 text-[13px] text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-warm-200 disabled:text-warm-400"
        >
          {labelGerar}
        </button>
      </div>
    </header>
  );
}
