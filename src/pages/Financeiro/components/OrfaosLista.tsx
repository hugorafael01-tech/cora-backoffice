import { useEffect, useState } from 'react';
import { formatBRL, formatData, mascararCliente, rotuloEvento } from '../../../lib/financeiro';
import type { OrfaoCliente, SubscriptionFinanceiro } from '../types';
import { VincularModal } from './VincularModal';

interface Props {
  orfaos: OrfaoCliente[];
  /** Assinaturas já carregadas pelo C1 (alimentam a busca do modal; sem nova leitura). */
  subscriptions: SubscriptionFinanceiro[];
  /** Chamado após vincular com sucesso, pra atualizar panorama + órfãos (refetch). */
  onVinculado: () => void;
}

/**
 * Gesto 2 — pagamentos pra identificar (eventos órfãos, agrupados por cliente Asaas).
 * O botão "Vincular a um assinante" abre o modal de busca; a escrita vai pro endpoint
 * do portal (/api/asaas/vincular), nunca direto em subscriptions (0019).
 */
export function OrfaosLista({ orfaos, subscriptions, onVinculado }: Props) {
  const [orfaoAtivo, setOrfaoAtivo] = useState<OrfaoCliente | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Clientes já resolvidos nesta sessão. O endpoint vincula a subscription mas não
  // reprocessa o evento órfão (subscription_id segue null), então some-se o grupo aqui
  // pra refletir "já tratei isso". Reprocessar os eventos antigos é follow-up da Perna 3.
  const [resolvidos, setResolvidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const visiveis = orfaos.filter(
    (o) => !o.asaas_customer_id || !resolvidos.has(o.asaas_customer_id),
  );

  return (
    <section className="px-5 py-4 md:px-8">
      <h2 className="mb-1 font-display text-[20px] text-ink-700">Pagamentos pra identificar</h2>
      <p className="mb-3 text-[13px] text-warm-500">
        Pagamentos que chegaram do Asaas e ainda não casaram com um assinante.
      </p>

      {visiveis.length === 0 ? (
        <div className="rounded-lg border border-dashed border-warm-300 bg-warm-50 px-4 py-8 text-center text-warm-500">
          Nenhum pagamento pra identificar.
        </div>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((cliente) => (
            <li
              key={cliente.asaas_customer_id ?? cliente.principal.id}
              className="flex flex-col gap-3 rounded-lg border border-warm-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-700">{rotuloEvento(cliente.principal.event_type)}</span>
                  <span className="font-display text-[16px] text-ink-700">
                    {formatBRL(cliente.principal.valor)}
                  </span>
                  {cliente.total > 1 && (
                    <span className="rounded-full bg-warm-100 px-2 py-0.5 text-[11px] text-warm-500">
                      {cliente.total} eventos
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-warm-500">
                  cliente {mascararCliente(cliente.asaas_customer_id)} · {formatData(cliente.principal.received_at)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOrfaoAtivo(cliente)}
                className="shrink-0 rounded-md bg-brand-500 px-3 py-1.5 text-[13px] text-white hover:bg-brand-600"
              >
                Vincular a um assinante
              </button>
            </li>
          ))}
        </ul>
      )}

      {orfaoAtivo && (
        <VincularModal
          orfao={orfaoAtivo}
          subscriptions={subscriptions}
          onClose={() => setOrfaoAtivo(null)}
          onSuccess={(nome) => {
            const cid = orfaoAtivo?.asaas_customer_id;
            setOrfaoAtivo(null);
            setToast(`Pronto. Pagamento vinculado a ${nome}.`);
            if (cid) setResolvidos((prev) => new Set(prev).add(cid));
            onVinculado();
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border border-success-border bg-success-bg px-4 py-2 text-[14px] text-success-text shadow"
        >
          {toast}
        </div>
      )}
    </section>
  );
}
