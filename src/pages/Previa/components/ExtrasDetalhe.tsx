import { quintaLegivel, reais, type ExtraCobravel, type TipoExtra } from '../../../lib/previa';

/**
 * O que a linha diz quando custou zero. Sem preco riscado: riscar antes de a
 * cortesia ser declarada faria erro de cadastro parecer presente, e o riscado
 * ficou fora de escopo por isso.
 */
const ROTULO_TIPO: Partial<Record<TipoExtra, string>> = {
  troca: 'troca',
  cortesia: 'cortesia',
};

interface Props {
  extras: ExtraCobravel[];
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
    return <p className="text-[13px] text-warm-400">Nenhum extra no ciclo.</p>;
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
          <div className="text-[12px] text-warm-400">{quintaLegivel(quinta)}</div>
          <ul className="mt-0.5 space-y-0.5">
            {porQuinta.get(quinta)!.map((e, i) => (
              <li
                key={`${e.id}-${i}`}
                className="flex items-baseline justify-between gap-3 text-[13px]"
              >
                <span className="text-warm-600">
                  {e.qty > 1 ? `${e.qty}x ` : ''}
                  {e.nome}
                  {ROTULO_TIPO[e.tipo] && (
                    <span className="ml-1.5 text-[12px] text-warm-400">
                      {ROTULO_TIPO[e.tipo]}
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 tabular-nums ${
                    e.preco_unit === 0 && e.tipo === 'pago'
                      ? 'text-warning-text'
                      : 'text-warm-600'
                  }`}
                >
                  {reais(e.subtotal)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
