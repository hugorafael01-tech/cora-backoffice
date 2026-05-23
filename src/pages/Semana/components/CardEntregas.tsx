import type { EstadoSemana } from '../../../lib/semana';
import type { CidadeEntregas } from '../types';

interface Props {
  estado: EstadoSemana;
  cidades: CidadeEntregas[];
  totalGeral: number;
}

export function CardEntregas({ estado, cidades, totalGeral }: Props) {
  const aprox = estado === 'A';

  return (
    <div className="rounded-lg border border-warm-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl text-ink-700">Entregas</h2>
        <span className="text-[12px] text-warm-500">
          {aprox ? '~' : ''}
          {totalGeral} pedido{totalGeral === 1 ? '' : 's'}
        </span>
      </div>

      {cidades.length === 0 ? (
        <p className="mt-3 text-warm-500">Nenhuma entrega confirmada ainda.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {cidades.map((cidade) => (
            <div key={cidade.nome}>
              <div className="text-[12px] uppercase tracking-wide text-warm-500">{cidade.nome}</div>
              <ul className="mt-1 space-y-1">
                {cidade.bairros.map((b) => (
                  <li
                    key={b.nome}
                    className={`flex items-center justify-between rounded-md px-2 py-1.5 ${
                      b.foraDaLista ? 'bg-warning-bg text-warning-text' : 'text-warm-700'
                    }`}
                  >
                    <span>
                      {b.nome}
                      {b.foraDaLista && (
                        <span className="ml-2 text-[11px]">fora da área atendida</span>
                      )}
                    </span>
                    <span className="tabular-nums">
                      {aprox ? '~' : ''}
                      {b.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-warm-100 pt-3">
        <span className="cursor-not-allowed text-[12px] text-warm-300" title="Disponível na Expedição (Fase 2)">
          ver detalhe na Expedição →
        </span>
      </div>
    </div>
  );
}
