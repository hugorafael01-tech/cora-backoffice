import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  flattenComposicaoPontual,
  flattenComposition,
  type ItemEntrega,
} from '../lib/expedicao';

/** Um produto e sua quantidade num bloco de demanda. Mesma forma de ItemEntrega. */
export type DemandaItem = ItemEntrega;

/**
 * Demanda da semana, quebrada por natureza (NAO soma tudo num numero so):
 *   - assinatura: baseline de TODO subscriptions.status='active' (qty_original/
 *     qty_integral), sem passar por weekly_orders — decisao de produto 20/07.
 *   - extras: weekly_orders CONFIRMADOS do ciclo (muda ate o corte).
 *   - pontuais: pedidos_pontuais confirmados da semana.
 *   - aguardando: subscriptions.status='pending_payment' (previsao, nao demanda).
 */
export interface DemandaSemana {
  dataEntrega: string; // YYYY-MM-DD (do ciclo)
  assinatura: DemandaItem[];
  extras: DemandaItem[];
  pontuais: DemandaItem[];
  aguardando: DemandaItem[];
}

export interface UseDemandaSemanaResult {
  demanda: DemandaSemana | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** Soma varias listas de itens por slug (usado nos pedidos pontuais, N por semana). */
function somaItens(listas: ItemEntrega[][]): ItemEntrega[] {
  const porSlug = new Map<string, ItemEntrega>();
  for (const lista of listas) {
    for (const it of lista) {
      const ja = porSlug.get(it.slug);
      if (ja) ja.qty += it.qty;
      else porSlug.set(it.slug, { ...it });
    }
  }
  return [...porSlug.values()];
}

/**
 * Le a demanda de um ciclo pra exibir ao lado do "Definir volume". Leitura pura
 * (nenhum insert/update/delete). As quatro fontes espelham o que a Expedicao ja
 * consome em lib/expedicaoActions.ts, reusando os flatten de lib/expedicao.ts.
 * Respeita o ciclo selecionado: recebe o mesmo `semanaId` do useParams.
 */
export function useDemandaSemana(semanaId: string | undefined): UseDemandaSemanaResult {
  const [demanda, setDemanda] = useState<DemandaSemana | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelado = false;
    if (!semanaId) return;

    async function carregar(id: string) {
      setLoading(true);
      setError(null);
      try {
        // 1) ciclo -> data_entrega (chave dos weekly_orders)
        const { data: semana, error: errSemana } = await supabase
          .from('semanas')
          .select('data_entrega')
          .eq('id', id)
          .single();
        if (errSemana || !semana) throw errSemana ?? new Error('Ciclo nao encontrado');
        const dataEntrega = semana.data_entrega;

        // 2) nome por slug (catalogo) pra rotular os itens
        const { data: produtos } = await supabase.from('produtos').select('slug, nome');
        const nomePorSlug = new Map(
          (produtos ?? []).map((p) => [p.slug as string, p.nome as string])
        );

        // 3) subscriptions: baseline por status (active = demanda; pending = previsao)
        const { data: subs, error: errSubs } = await supabase
          .from('subscriptions')
          .select('status, qty_original, qty_integral')
          .in('status', ['active', 'pending_payment']);
        if (errSubs) throw errSubs;

        let ativoOriginal = 0;
        let ativoIntegral = 0;
        let pendenteOriginal = 0;
        let pendenteIntegral = 0;
        for (const s of subs ?? []) {
          if (s.status === 'active') {
            ativoOriginal += s.qty_original ?? 0;
            ativoIntegral += s.qty_integral ?? 0;
          } else if (s.status === 'pending_payment') {
            pendenteOriginal += s.qty_original ?? 0;
            pendenteIntegral += s.qty_integral ?? 0;
          }
        }
        const assinatura = flattenComposicaoPontual(
          { original: ativoOriginal, integral: ativoIntegral },
          nomePorSlug
        );
        const aguardando = flattenComposicaoPontual(
          { original: pendenteOriginal, integral: pendenteIntegral },
          nomePorSlug
        );

        // 4) extras dos weekly_orders CONFIRMADOS do ciclo (rascunho nao conta)
        const { data: ordens, error: errOrdens } = await supabase
          .from('weekly_orders')
          .select('extras')
          .eq('delivery_date', dataEntrega)
          .eq('status', 'confirmado');
        if (errOrdens) throw errOrdens;
        const todosExtras = (ordens ?? []).flatMap((o) =>
          Array.isArray(o.extras) ? o.extras : []
        );
        const extras = flattenComposition(null, todosExtras, nomePorSlug);

        // 5) encomendas pontuais confirmadas da semana
        const { data: pontuaisRows, error: errPontuais } = await supabase
          .from('pedidos_pontuais')
          .select('composicao')
          .eq('semana_id', id)
          .eq('status', 'confirmado');
        if (errPontuais) throw errPontuais;
        const pontuais = somaItens(
          (pontuaisRows ?? []).map((p) => flattenComposicaoPontual(p.composicao, nomePorSlug))
        );

        if (cancelado) return;
        setDemanda({ dataEntrega, assinatura, extras, pontuais, aguardando });
        setLoading(false);
      } catch (e) {
        if (!cancelado) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setLoading(false);
        }
      }
    }

    carregar(semanaId);
    return () => {
      cancelado = true;
    };
  }, [semanaId, tick]);

  return { demanda, loading, error, refetch };
}
