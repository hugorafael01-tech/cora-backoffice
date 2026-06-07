import type { DiaSemana } from '../../../lib/producao';

interface Props {
  dias: DiaSemana[];
}

/** Tres dias do ciclo (ter/qua/qui). Informativo; espelha o wireframe. */
export function DayTabs({ dias }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2.5 px-5 pt-4 md:px-8">
      {dias.map((d, i) => (
        <div
          key={d.sigla + d.data}
          className={`rounded-md border px-3.5 py-3 ${
            i === 0
              ? 'border-brand-200 bg-brand-50'
              : `border-warm-300 bg-white ${d.futuro ? 'opacity-60' : ''}`
          }`}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[18px] uppercase tracking-[0.04em] text-brand-500">
              {d.sigla}
            </span>
            <span className="text-[12px] tabular-nums text-warm-500">{d.data}</span>
          </div>
          <div className="mt-1 text-[12px] leading-snug text-warm-600">{d.descricao}</div>
        </div>
      ))}
    </div>
  );
}
