import { formatBRL, formatData, mascararCliente, rotuloEvento } from '../../../lib/financeiro';
import type { OrfaoCliente } from '../types';

interface Props {
  orfaos: OrfaoCliente[];
}

/**
 * Gesto 2 — pagamentos pra identificar (eventos órfãos, agrupados por cliente Asaas).
 * Read-only nesta etapa: a ação "Vincular a um assinante" chama o endpoint do portal
 * (/api/asaas/vincular), que ainda não responde cross-origin (CORS pendente no cora-portal).
 * Por isso o botão entra desabilitado ("em breve") até o ajuste no portal.
 */
export function OrfaosLista({ orfaos }: Props) {
  return (
    <section className="px-5 py-4 md:px-8">
      <h2 className="mb-1 font-display text-[20px] text-ink-700">Pagamentos pra identificar</h2>
      <p className="mb-3 text-[13px] text-warm-500">
        Pagamentos que chegaram do Asaas e ainda não casaram com um assinante.
      </p>

      {orfaos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-warm-300 bg-warm-50 px-4 py-8 text-center text-warm-500">
          Nenhum pagamento pra identificar.
        </div>
      ) : (
        <ul className="space-y-2">
          {orfaos.map((cliente) => (
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
                disabled
                title="Em breve"
                className="shrink-0 cursor-default rounded-md border border-warm-200 px-3 py-1.5 text-[13px] text-warm-400"
              >
                Vincular a um assinante
                <span className="ml-1 text-[10px] uppercase tracking-wide">em breve</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
