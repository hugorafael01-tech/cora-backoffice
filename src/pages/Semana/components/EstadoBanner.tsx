import type { EstadoSemana } from '../../../lib/semana';

interface Props {
  estado: EstadoSemana;
  onAbrirSemana?: () => void;
  abrindo?: boolean;
  proximaSemanaId?: string | null;
}

/**
 * Banner contextual no topo do detalhe.
 * - rascunho: amarelo, com CTA "Abrir semana".
 * - A: info, aviso de estimativa.
 * - C: success, semana concluida (+ link proxima, se houver).
 * - B: sem banner.
 */
export function EstadoBanner({ estado, onAbrirSemana, abrindo, proximaSemanaId }: Props) {
  if (estado === 'rascunho') {
    return (
      <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-md border border-warning-border bg-warning-bg px-4 py-3 text-warning-text md:mx-8">
        <span>⚠ Semana ainda não publicada.</span>
        <button
          onClick={onAbrirSemana}
          disabled={abrindo}
          className="rounded-md bg-warning-text px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {abrindo ? 'Abrindo…' : 'Abrir semana →'}
        </button>
      </div>
    );
  }

  if (estado === 'A') {
    return (
      <div className="mx-5 mt-4 rounded-md border border-warm-200 bg-warm-100 px-4 py-3 text-warm-600 md:mx-8">
        Estimativa. Confirmação no corte de terça 12h.
      </div>
    );
  }

  if (estado === 'C') {
    return (
      <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-md border border-success-border bg-success-bg px-4 py-3 text-success-text md:mx-8">
        <span>Semana concluída.</span>
        {proximaSemanaId && (
          <a href={`/semanas/${proximaSemanaId}`} className="text-sm underline">
            abrir próxima semana →
          </a>
        )}
      </div>
    );
  }

  return null;
}
