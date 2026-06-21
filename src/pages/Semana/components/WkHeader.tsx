import { useNavigate } from 'react-router-dom';
import type { EstadoSemana } from '../../../lib/semana';
import { cicloLabel } from '../../../lib/semana';
import { formataDiaMes } from '../../../lib/date';
import type { Semana } from '../types';

const EYEBROW: Record<EstadoSemana, string> = {
  rascunho: 'rascunho',
  A: 'em curso · estimativa',
  B: 'em curso',
  C: 'concluída',
};

interface Props {
  semana: Semana;
  estado: EstadoSemana;
  anterior: string | null;
  proxima: string | null;
  onNova: () => void;
  onEditarData: () => void;
}

export function WkHeader({ semana, estado, anterior, proxima, onNova, onEditarData }: Props) {
  const navigate = useNavigate();
  const titulo = cicloLabel(semana.data_entrega);
  const subtitulo = `Semana ISO ${semana.numero} · ${formataDiaMes(semana.data_inicio)} — ${formataDiaMes(semana.data_fim)}`;

  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-warm-200 px-5 py-5 md:px-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.04em] text-warm-500">{EYEBROW[estado]}</div>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[26px] md:text-[30px] leading-tight text-ink-700">{titulo}</h1>
          <button
            onClick={onEditarData}
            aria-label="Editar data de entrega"
            className="text-warm-400 hover:text-warm-700 transition-colors pb-1"
          >
            ✏
          </button>
        </div>
        <div className="mt-1 text-[13px] text-warm-500">{subtitulo}</div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          aria-label="Semana anterior"
          disabled={!anterior}
          onClick={() => anterior && navigate(`/semanas/${anterior}`)}
          className="grid h-11 w-11 place-items-center rounded-md border border-warm-200 text-warm-600 disabled:opacity-30 enabled:hover:bg-warm-100"
        >
          ‹
        </button>
        <button
          aria-label="Próxima semana"
          disabled={!proxima}
          onClick={() => proxima && navigate(`/semanas/${proxima}`)}
          className="grid h-11 w-11 place-items-center rounded-md border border-warm-200 text-warm-600 disabled:opacity-30 enabled:hover:bg-warm-100"
        >
          ›
        </button>
        <button
          onClick={onNova}
          className="h-11 rounded-md bg-brand-500 px-4 text-[16px] text-white hover:bg-brand-600"
        >
          + Nova
        </button>
      </div>
    </header>
  );
}
