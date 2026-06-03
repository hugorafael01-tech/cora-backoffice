import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { agruparOrfaos, extrairValor, ordenarPorAtencao } from '../lib/financeiro';
import type {
  OrfaoCliente,
  ResumoFinanceiro,
  SubscriptionFinanceiro,
} from '../pages/Financeiro/types';

export interface UseFinanceiroResult {
  subscriptions: SubscriptionFinanceiro[];
  orfaos: OrfaoCliente[];
  resumo: ResumoFinanceiro;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Lê o panorama de pagamentos (subscriptions) e os eventos órfãos
 * (asaas_webhook_events sem subscription). Tudo via client autenticado + RLS is_admin,
 * padrão das telas existentes. Não escreve nada.
 */
export function useFinanceiro(): UseFinanceiroResult {
  const [subscriptions, setSubscriptions] = useState<SubscriptionFinanceiro[]>([]);
  const [orfaos, setOrfaos] = useState<OrfaoCliente[]>([]);
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
        const [subsRes, evtRes] = await Promise.all([
          supabase
            .from('subscriptions')
            .select('id, nome, payment_status, last_payment_at, asaas_customer_id'),
          supabase
            .from('asaas_webhook_events')
            .select('id, event_type, asaas_customer_id, received_at, payload')
            .is('subscription_id', null),
        ]);

        if (subsRes.error) throw subsRes.error;
        if (evtRes.error) throw evtRes.error;

        const subs = ordenarPorAtencao((subsRes.data ?? []) as SubscriptionFinanceiro[]);
        const eventos = (evtRes.data ?? []).map((e) => ({
          id: e.id,
          event_type: e.event_type,
          asaas_customer_id: e.asaas_customer_id,
          received_at: e.received_at,
          valor: extrairValor(e.payload),
        }));
        const grupos = agruparOrfaos(eventos);

        if (!cancelado) {
          setSubscriptions(subs);
          setOrfaos(grupos);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelado) {
          setError(e as Error);
          setLoading(false);
        }
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [tick]);

  const resumo: ResumoFinanceiro = {
    emDia: subscriptions.filter((s) => s.payment_status === 'em_dia').length,
    vencidas: subscriptions.filter((s) => s.payment_status === 'vencido').length,
    semStatus: subscriptions.filter((s) => s.payment_status == null).length,
    praIdentificar: orfaos.length,
  };

  return { subscriptions, orfaos, resumo, loading, error, refetch };
}
