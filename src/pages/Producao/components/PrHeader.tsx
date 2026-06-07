import { useNavigate } from 'react-router-dom';
import { formataDiaMes } from '../../../lib/date';
import type { Semana } from '../types';

interface Props {
  semana: Semana;
  anterior: string | null;
  proxima: string | null;
}

/** Cabecalho da tela de Producao. Espelha o WkHeader do modulo Semana. */
export function PrHeader({ semana, anterior, proxima }: Props) {
  const navigate = useNavigate();
  const titulo = `PRODUCAO · SEMANA ${semana.numero}`;
  const subtitulo = `${formataDiaMes(semana.data_inicio)} — ${formataDiaMes(
    semana.data_fim
  )} · entrega ${formataDiaMes(semana.data_entrega)}`;

  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-warm-200 px-5 py-5 md:px-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.04em] text-warm-500">
          pre-producao · definir volume
        </div>
        <h1 className="font-display text-[26px] leading-tight text-ink-700 md:text-[30px]">
          {titulo}
        </h1>
        <div className="mt-1 text-[13px] text-warm-500">{subtitulo}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-md border border-warm-300 bg-warm-100 px-2.5 py-1 text-[11px] uppercase tracking-[0.06em] text-warm-600">
          pre-producao
        </span>
        <span className="rounded-md border border-warning-border bg-warning-bg px-2.5 py-1 text-[11px] text-warning-text">
          periodo de testes
        </span>
        <button
          aria-label="Semana anterior"
          disabled={!anterior}
          onClick={() => anterior && navigate(`/producao/${anterior}`)}
          className="grid h-11 w-11 place-items-center rounded-md border border-warm-200 text-warm-600 enabled:hover:bg-warm-100 disabled:opacity-30"
        >
          ‹
        </button>
        <button
          aria-label="Proxima semana"
          disabled={!proxima}
          onClick={() => proxima && navigate(`/producao/${proxima}`)}
          className="grid h-11 w-11 place-items-center rounded-md border border-warm-200 text-warm-600 enabled:hover:bg-warm-100 disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </header>
  );
}
