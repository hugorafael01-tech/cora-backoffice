import { calcLevainBuild, fmtG } from '../../../lib/producao';

interface Props {
  metaG: number; // meta autolise = levain total previsto da semana, em gramas
  sobraG: number;
  onSobra: (g: number) => void;
}

/**
 * Levain: perfil (so liquido 1:2:2 por ora) + calculadora de build.
 * Meta autolise = demanda total de levain da semana (vem do preview, espelho do trigger).
 * Build: total = meta + sobra; isca:agua:farinha = 1:2:2.
 */
export function LevainCard({ metaG, sobraG, onSobra }: Props) {
  const build = calcLevainBuild(metaG, sobraG);

  return (
    <section className="px-5 pt-7 md:px-8">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[13px] uppercase tracking-[0.06em] text-warm-600">Levain</h2>
        <span className="text-[12px] text-warm-500">
          calculado a partir do volume · autolise na quarta
        </span>
      </div>

      <div className="rounded-md border border-warm-300 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-display text-[18px] uppercase tracking-[0.04em] text-brand-500">
                Levain da semana
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2 py-1">
                <span className="font-display text-[10px] uppercase tracking-[0.06em] text-brand-500">
                  perfil
                </span>
                <select
                  className="rounded bg-white px-1.5 py-0.5 text-[12.5px] font-semibold text-brand-700"
                  defaultValue="liquido"
                >
                  <option value="liquido">levain liquido 1:2:2</option>
                  <option value="solido" disabled>
                    levain solido — em breve
                  </option>
                </select>
              </span>
            </div>
            <div className="mt-1.5 text-[13px] text-warm-600">
              isca + agua 18C + farinha
              <span className="mx-1.5 text-warm-300">·</span>
              1 isca · 2 agua · 2 farinha
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-[10px] uppercase tracking-[0.06em] text-warm-500">
              meta autolise
            </div>
            <div className="font-display text-[22px] tabular-nums text-brand-500">
              {fmtG(metaG)}
            </div>
          </div>
        </div>

        {/* Calculadora de build */}
        <div className="mt-4 rounded-md border border-warm-200 bg-warm-50 p-4">
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.06em] text-warm-700">
              Calculadora · build
            </span>
            <span className="text-[10.5px] tracking-[0.04em] text-warm-500">
              1 isca · 2 agua · 2 farinha
            </span>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2.5 border-b border-dashed border-warm-300 pb-3 md:grid-cols-2">
            <div className="flex items-baseline justify-between gap-2 text-[13px] text-warm-700">
              <span className="text-warm-600">Meta autolise</span>
              <span className="font-bold tabular-nums text-warm-800">{fmtG(metaG)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-[13px] text-warm-700">
              <span className="text-warm-600">Sobra desejada (mae)</span>
              <span className="inline-flex items-baseline gap-1 rounded border border-warm-300 bg-white px-2 py-1 font-semibold tabular-nums text-warm-800">
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={sobraG}
                  onChange={(e) => onSobra(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 border-0 bg-transparent text-right outline-none"
                />
                <span className="text-[11px] font-normal text-warm-500">g</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-1.5 text-[13px] tabular-nums text-warm-700 md:grid-cols-2">
            <Out label="Isca (levain mae)" valor={fmtG(build.isca)} />
            <Out label="Agua mineral 18C" valor={fmtG(build.agua)} />
            <Out label="Farinha" valor={fmtG(build.farinha)} />
            <div className="col-span-full mt-1 flex items-baseline justify-between border-t border-dashed border-warm-300 pt-2">
              <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.06em] text-warm-700">
                Total a produzir
              </span>
              <span className="font-semibold text-brand-500">{fmtG(build.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded border border-dashed border-warning-border bg-warning-bg px-3 py-2 text-[12px] leading-snug text-warning-text">
          <span>⚠</span>
          <span>Levain parado ha mais de 3 dias? Faca 1 refresco a mais antes de usar.</span>
        </div>
      </div>
    </section>
  );
}

function Out({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-warm-600">{label}</span>
      <span className="font-semibold text-warm-800">{valor}</span>
    </div>
  );
}
