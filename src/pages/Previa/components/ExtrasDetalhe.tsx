import type { ExtraCobravel } from '../../../lib/previa';
import { formatBRL } from '../../../lib/financeiro';

interface Props {
  extras: ExtraCobravel[];
}

/** 'quinta 03/09' a partir de 'YYYY-MM-DD'. */
function quintaCurta(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${d}/${m}`;
}

/**
 * Os produtos extras, agrupados por quinta.
 *
 * Nasce legível como extrato porque é isso que ele vira: na Fase 3 o e-mail da
 * cobrança é o próprio extrato, com o mesmo detalhe. Se aqui já lê bem, lá é
 * transposição e não redesenho.
 */
export function ExtrasDetalhe({ extras }: Props) {
  if (extras.length === 0) {
    return <p className="text-[13px] text-warm-400">Nenhum produto extra no ciclo.</p>;
  }

  const porQuinta = new Map<string, ExtraCobravel[]>();
  for (const e of extras) {
    porQuinta.set(e.quinta, [...(porQuinta.get(e.quinta) ?? []), e]);
  }
  const quintas = [...porQuinta.keys()].sort();

  return (
    <div className="space-y-2">
      {quintas.map((quinta) => (
        <div key={quinta}>
          <div className="text-[12px] text-warm-400">quinta {quintaCurta(quinta)}</div>
          <ul className="mt-0.5 space-y-0.5">
            {porQuinta.get(quinta)!.map((e, i) => (
              <li
                key={`${e.id}-${i}`}
                className="flex items-baseline justify-between gap-3 text-[13px]"
              >
                <span className="text-warm-600">
                  {e.qty > 1 ? `${e.qty}x ` : ''}
                  {e.nome}
                </span>
                <span
                  className={`shrink-0 tabular-nums ${
                    e.preco_unit === 0 ? 'text-warning-text' : 'text-warm-600'
                  }`}
                >
                  {formatBRL(e.subtotal)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
