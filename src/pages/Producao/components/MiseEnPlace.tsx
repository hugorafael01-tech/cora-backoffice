import { fmtG, fmtKg } from '../../../lib/producao';
import type { MiseIngrediente } from '../types';

interface Props {
  grupos: MiseIngrediente[];
}

/** Quantidade agregada legivel: kg quando >= 1kg, senao g. */
function fmtQtd(g: number): string {
  return g >= 1000 ? fmtKg(g / 1000) : fmtG(g);
}

/**
 * Mise en place da semana: ingredientes a pesar, agrupados por ingrediente,
 * com total e breakdown por produto. Read-only (sem checklist persistido).
 * Os numeros vem de mise_en_place_semana (fonte da verdade).
 */
export function MiseEnPlace({ grupos }: Props) {
  return (
    <section className="px-5 pt-6 md:px-8">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[13px] uppercase tracking-[0.06em] text-warm-600">
          Mise en place
        </h2>
        <span className="text-[12px] text-warm-500">
          ingredientes a pesar · agregado da semana
        </span>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-md border border-warm-300 bg-white px-4 py-8 text-center text-[14px] text-warm-500">
          Nenhum ingrediente a pesar (produções sem quantidade definida).
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-warm-300 bg-white">
          {grupos.map((g) => {
            const unico = g.porProduto.length === 1;
            return (
              <div
                key={g.ingredienteId}
                className="border-b border-warm-200 px-4 py-3 last:border-b-0 md:px-5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-[12px] uppercase tracking-[0.06em] text-warm-700">
                    {g.nome}
                  </span>
                  <span className="font-display text-[18px] font-semibold tabular-nums text-brand-500">
                    {fmtQtd(g.totalG)}
                  </span>
                </div>
                {!unico && (
                  <ul className="mt-1.5 ml-1 border-l-2 border-dashed border-warm-200 pl-3">
                    {g.porProduto.map((p) => (
                      <li
                        key={p.produtoId}
                        className="flex items-baseline justify-between gap-3 py-1 text-[13px] text-warm-600"
                      >
                        <span>{p.produtoNome}</span>
                        <span className="tabular-nums text-warm-500">{fmtQtd(p.qtyG)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {unico && (
                  <div className="mt-0.5 text-[12px] text-warm-500">{g.porProduto[0].produtoNome}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
