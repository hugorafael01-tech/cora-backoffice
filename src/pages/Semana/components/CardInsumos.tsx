import type { InsumoAlerta } from '../types';

interface Props {
  alertas: InsumoAlerta[];
  okCount: number;
}

export function CardInsumos({ alertas, okCount }: Props) {
  return (
    <div className="rounded-lg border border-warm-200 bg-white p-4">
      <h2 className="font-display text-xl text-ink-700">Insumos</h2>

      {alertas.length === 0 ? (
        <p className="mt-3 text-warm-500">Tudo dentro do mínimo. {okCount} insumos OK.</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {alertas.map((a) => (
              <li
                key={a.slug}
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                  a.crit
                    ? 'border-danger-border bg-danger-bg text-danger-text'
                    : 'border-warning-border bg-warning-bg text-warning-text'
                }`}
              >
                <span>{a.nome}</span>
                <span className="text-[12px]">
                  {a.crit
                    ? 'abaixo do mínimo. pede hoje.'
                    : `${a.atual}/${a.minimo} ${a.unidade}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-warm-500">{okCount} insumos OK.</p>
        </>
      )}
    </div>
  );
}
