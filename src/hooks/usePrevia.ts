import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  janelaDoCiclo,
  montaPrevia,
  type EntradaPrevia,
  type PrecosPorQuinta,
  type Previa,
  type SubscriptionPrevia,
  type WeeklyOrderPrevia,
} from '../lib/previa';

export interface UsePreviaResult {
  previa: Previa | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Le tudo que a previa precisa e entrega pro modulo puro montar.
 *
 * Todo o I/O da Fase 2 mora aqui, de proposito: `src/lib/previa.ts` tem um
 * gemeo no cora-portal (Fase 3) e nao pode carregar client de banco junto na
 * travessia. A divisao e a mesma de useFinanceiro/financeiro.
 *
 * Leitura via client autenticado + RLS `is_admin()`, padrao das telas
 * existentes. As cinco tabelas ja tem policy de leitura admin (conferido em
 * 04/09): subscriptions, weekly_orders, entregas, cardapios, produtos,
 * semanas. Nao escreve nada.
 */
export function usePrevia(periodoReferencia: string): UsePreviaResult {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setLoading(true);
      setError(null);
      try {
        const janela = janelaDoCiclo(periodoReferencia);

        // `forma_pagamento` NAO entra no filtro da query: quem esta com forma
        // nula precisa chegar ao modulo pra aparecer com alerta. Filtrar aqui
        // seria justamente o "filtra calada" que a fase proibe.
        const [subsRes, ordersRes] = await Promise.all([
          supabase
            .from('subscriptions')
            .select(
              'id, nome, total_paes, forma_pagamento, valor_mensal, valor_frete, ' +
                'activated_at, next_billing_change_date, next_billing_value, ' +
                'pagador_subscription_id, asaas_customer_id',
            )
            .eq('status', 'active')
            .not('nome', 'ilike', '%dev%'),
          supabase
            .from('weekly_orders')
            // `composition` entra pela regra de troca: slot vago na cesta e o
            // que distingue produto trocado de preco que faltou cadastrar.
            .select(
              'id, subscription_id, delivery_date, status, total_extras, extras, composition',
            )
            .gte('delivery_date', janela.primeiraQuinta)
            .lte('delivery_date', janela.ultimaQuinta),
        ]);
        if (subsRes.error) throw subsRes.error;
        if (ordersRes.error) throw ordersRes.error;

        const weeklyOrders = (ordersRes.data ?? []) as unknown as WeeklyOrderPrevia[];
        const ids = weeklyOrders.map((o) => o.id);

        // Entregas e precos dependem do que veio acima, entao vao no segundo
        // round-trip. `.in()` com lista vazia devolve vazio no PostgREST, mas
        // o request e desperdicio: pula quando nao ha pedido na janela.
        const [entregasRes, semanasRes] = await Promise.all([
          ids.length > 0
            ? supabase
                .from('entregas')
                .select('weekly_order_id, status')
                .in('weekly_order_id', ids)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from('semanas')
            .select('id, data_entrega')
            .in('data_entrega', janela.quintas),
        ]);
        if (entregasRes.error) throw entregasRes.error;
        if (semanasRes.error) throw semanasRes.error;

        const semanas = (semanasRes.data ?? []) as { id: string; data_entrega: string }[];
        const precos = await lePrecos(semanas);

        const entrada: EntradaPrevia = {
          subscriptions: (subsRes.data ?? []) as unknown as SubscriptionPrevia[],
          weeklyOrders,
          entregas: (entregasRes.data ?? []) as { weekly_order_id: string | null; status: string }[],
          precos,
        };

        if (!cancelado) setPrevia(montaPrevia(entrada, periodoReferencia));
      } catch (e) {
        if (!cancelado) setError(e as Error);
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, [periodoReferencia, tick]);

  return { previa, loading, error, refetch };
}

/**
 * Precos do cardapio de cada quinta da janela, por slug.
 *
 * Serve SO pros alertas de divergencia — o valor cobrado e sempre o snapshot
 * gravado no pedido. Por isso a falta de cardapio nao e erro: devolve o que
 * conseguir e a previa segue sem o alerta daquela semana.
 *
 * Dois round-trips (cardapios, depois produtos) em vez de embed do PostgREST,
 * mesmo trade-off ja aceito no extras-precos do portal: o volume e de ~5 linhas
 * por semana e o SELECT explicito nao depende de como a FK esta nomeada.
 */
async function lePrecos(semanas: { id: string; data_entrega: string }[]): Promise<PrecosPorQuinta> {
  const precos: PrecosPorQuinta = new Map();
  if (semanas.length === 0) return precos;

  const { data: linhas, error } = await supabase
    .from('cardapios')
    .select('semana_id, produto_id, preco_avulso')
    .in('semana_id', semanas.map((s) => s.id));
  if (error) throw error;
  if (!linhas || linhas.length === 0) return precos;

  // Sem filtro `ativo`: um snapshot antigo pode apontar pra produto que o Hugo
  // ja desativou, e e exatamente esse caso que mais precisa do alerta de
  // divergencia. Aqui so lemos preco, nao validamos venda.
  const { data: produtos, error: errProd } = await supabase
    .from('produtos')
    .select('id, slug')
    .in('id', linhas.map((l) => l.produto_id));
  if (errProd) throw errProd;

  const slugPorId = new Map((produtos ?? []).map((p) => [p.id, p.slug]));
  const quintaPorSemana = new Map(semanas.map((s) => [s.id, s.data_entrega]));

  for (const linha of linhas) {
    const quinta = quintaPorSemana.get(linha.semana_id);
    const slug = slugPorId.get(linha.produto_id);
    const preco = Number(linha.preco_avulso);
    if (!quinta || !slug || !Number.isFinite(preco)) continue;
    const doDia = precos.get(quinta) ?? new Map<string, number>();
    doDia.set(slug, preco);
    precos.set(quinta, doDia);
  }
  return precos;
}
