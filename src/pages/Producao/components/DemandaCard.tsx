import { formataDiaSemanaDiaMes } from '../../../lib/date';
import { useDemandaSemana, type DemandaItem } from '../../../hooks/useDemandaSemana';

interface Props {
  semanaId: string;
}

/**
 * Demanda da semana ao lado do "Definir volume": mostra o que foi vendido pra
 * cada natureza (assinatura, extras, pontuais) + o que aguarda pagamento, sem
 * somar num numero so. Leitura pura — nunca preenche o VolumeList nem escreve
 * nada; a decisao de volume continua do Hugo. Bloco vazio nao renderiza.
 */
export function DemandaCard({ semanaId }: Props) {
  const { demanda, loading, error } = useDemandaSemana(semanaId);

  return (
    <section className="px-5 pt-7 md:px-8">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[13px] uppercase tracking-[0.06em] text-warm-600">
          Demanda da semana
        </h2>
        {demanda && (
          <span className="text-[12px] text-warm-500">
            entrega {formataDiaSemanaDiaMes(demanda.dataEntrega)}
          </span>
        )}
      </div>

      <div className="rounded-md border border-warm-300 bg-white p-4 md:p-5">
        {loading ? (
          <p className="text-[13px] text-warm-500">Carregando demanda…</p>
        ) : error ? (
          <p className="text-[13px] text-warm-500">
            Não foi possível carregar a demanda deste ciclo.
          </p>
        ) : (
          <Conteudo demanda={demanda!} />
        )}
      </div>
    </section>
  );
}

function Conteudo({ demanda }: { demanda: NonNullable<ReturnType<typeof useDemandaSemana>['demanda']> }) {
  const { assinatura, extras, pontuais, aguardando } = demanda;
  const vazio =
    assinatura.length === 0 &&
    extras.length === 0 &&
    pontuais.length === 0 &&
    aguardando.length === 0;

  if (vazio) {
    return <p className="text-[13px] text-warm-500">Nenhuma demanda registrada para este ciclo.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Bloco titulo="Assinatura" hint="todo assinante ativo" itens={assinatura} />
      <Bloco titulo="Extras confirmados" hint="muda até o corte" itens={extras} />
      <Bloco titulo="Encomendas pontuais" hint="pedidos confirmados" itens={pontuais} />
      <Aguardando itens={aguardando} />
    </div>
  );
}

/** Bloco de demanda: rotulo + lista produto/quantidade. Nao renderiza se vazio. */
function Bloco({ titulo, hint, itens }: { titulo: string; hint: string; itens: DemandaItem[] }) {
  if (itens.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-[11px] uppercase tracking-[0.06em] text-warm-600">
          {titulo}
        </span>
        <span className="text-[11px] text-warm-400">{hint}</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {itens.map((it) => (
          <li
            key={it.slug}
            className="flex items-baseline justify-between gap-2 text-[13.5px] text-warm-700"
          >
            <span>{it.nome}</span>
            <span className="font-semibold tabular-nums text-warm-800">
              {it.qty.toLocaleString('pt-BR')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Aguardando pagamento: bloco subordinado (previsao, nao demanda) — separado por
 * borda tracejada, mais discreto, e em linha unica ("Pão Original 2 · Pão Integral 2").
 */
function Aguardando({ itens }: { itens: DemandaItem[] }) {
  if (itens.length === 0) return null;
  const linha = itens
    .map((it) => `${it.nome} ${it.qty.toLocaleString('pt-BR')}`)
    .join(' · ');
  return (
    <div className="border-t border-dashed border-warm-300 pt-3">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-[11px] uppercase tracking-[0.06em] text-warm-500">
          Aguardando pagamento
        </span>
        <span className="text-[11px] text-warm-400">entram se pagarem até o corte</span>
      </div>
      <p className="text-[13px] text-warm-500">{linha}</p>
    </div>
  );
}
