import type { EstadoSemana, EtapaAgora } from '../../../lib/semana';
import { grupoLabel } from '../../../lib/semana';
import type { LinhaProducao } from '../types';

interface Props {
  estado: EstadoSemana;
  planejamento: LinhaProducao[];
  etapasAgora: Map<string, EtapaAgora>;
}

function kg(g: number): string {
  return (g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function EtapaCell({ etapa }: { etapa: EtapaAgora | undefined }) {
  const e = etapa ?? { label: 'aguardando', ha: null, tom: 'mute' as const };
  const tomClass =
    e.tom === 'brand' ? 'text-brand-600' : e.tom === 'warm' ? 'text-warm-600' : 'text-warm-400';
  return (
    <span className={tomClass}>
      {e.label}
      {e.ha && <span className="ml-1 text-[11px] text-warm-400">· {e.ha}</span>}
    </span>
  );
}

export function TabelaProducao({ estado, planejamento, etapasAgora }: Props) {
  if (planejamento.length === 0) {
    return (
      <div className="px-5 py-6 md:px-8">
        <div className="rounded-lg border border-dashed border-warm-300 bg-warm-50 px-4 py-8 text-center text-warm-500">
          Nenhum pedido confirmado ainda para esta semana.
        </div>
      </div>
    );
  }

  const totalPaes = planejamento.reduce((s, l) => s + l.qty, 0);
  const totalMassaG = planejamento.reduce((s, l) => s + l.massaTotalG, 0);
  const totalLevainG = planejamento.reduce((s, l) => s + l.levainG, 0);
  const mostrarEtapa = estado === 'B';
  const retro = estado === 'C';

  return (
    <div className="px-5 py-4 md:px-8">
      <div className="overflow-x-auto rounded-lg border border-warm-200 bg-white">
        <table className="w-full text-left text-[14px]">
          <thead className="border-b border-warm-200 text-[12px] uppercase tracking-wide text-warm-500">
            <tr>
              <th className="px-4 py-2 font-medium">Produto</th>
              {retro ? (
                <>
                  <th className="px-4 py-2 text-right font-medium">Previsto</th>
                  <th className="px-4 py-2 text-right font-medium">Realizado</th>
                  <th className="px-4 py-2 text-right font-medium">Δ</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-2 font-medium">Grupo</th>
                  <th className="px-4 py-2 text-right font-medium">Pães</th>
                  <th className="px-4 py-2 text-right font-medium">Massa</th>
                  <th className="px-4 py-2 text-right font-medium">Levain</th>
                  {mostrarEtapa && <th className="px-4 py-2 font-medium">Etapa agora</th>}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {planejamento.map((l) => (
              <tr key={l.slug} className="border-b border-warm-100 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="text-ink-700">{l.nome}</div>
                  {l.qtyPontual > 0 && (
                    <div className="text-[11px] text-warm-500">
                      {l.qtyBase} base + {l.qtyPontual} pontua{l.qtyPontual > 1 ? 'is' : 'l'}
                    </div>
                  )}
                </td>
                {retro ? (
                  <>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.qty}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-warm-400">—</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-warm-400">—</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2.5 text-warm-600">{grupoLabel(l.grupo)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.qty}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{kg(l.massaTotalG)} kg</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{kg(l.levainG)} kg</td>
                    {mostrarEtapa && (
                      <td className="px-4 py-2.5">
                        <EtapaCell etapa={etapasAgora.get(l.slug)} />
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
          </tbody>
          {!retro && (
            <tfoot className="border-t border-warm-200 text-[14px] font-medium text-ink-700">
              <tr>
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5" />
                <td className="px-4 py-2.5 text-right tabular-nums">{totalPaes}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{kg(totalMassaG)} kg</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{kg(totalLevainG)} kg</td>
                {mostrarEtapa && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
