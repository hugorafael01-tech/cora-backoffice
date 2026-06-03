import type {
  OrfaoCliente,
  OrfaoEvento,
  PaymentStatus,
  SubscriptionFinanceiro,
} from '../pages/Financeiro/types';

/**
 * Extrai o valor do pagamento do payload jsonb cru do Asaas (payload.payment.value).
 * Defensivo: o campo pode não existir; nunca lança. Ausente vira null.
 */
export function extrairValor(payload: unknown): number | null {
  if (payload && typeof payload === 'object') {
    const payment = (payload as Record<string, unknown>).payment;
    if (payment && typeof payment === 'object') {
      const value = (payment as Record<string, unknown>).value;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
  }
  return null;
}

/** Formata em BRL; null/ausente vira travessão visual "—" (não quebra a tela). */
export function formatBRL(valor: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Data curta pt-BR; null vira "—". */
export function formatData(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Mascara o código do cliente Asaas (cus_000005219820 -> cus_…9820). */
export function mascararCliente(id: string | null): string {
  if (!id) return '—';
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/** Rótulo amigável do event_type cru do Asaas. */
export function rotuloEvento(eventType: string): string {
  switch (eventType) {
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED':
      return 'pagamento recebido';
    case 'PAYMENT_OVERDUE':
      return 'pagamento vencido';
    case 'PAYMENT_CREATED':
      return 'cobrança criada';
    default:
      return eventType.replace(/^PAYMENT_/, '').toLowerCase().replace(/_/g, ' ');
  }
}

/** Ordenação "por atenção": vencido primeiro, depois sem status, pendente, em dia. */
const PESO_ATENCAO: Record<PaymentStatus, number> = { vencido: 0, pendente: 2, em_dia: 3 };

export function pesoAtencao(status: PaymentStatus | null): number {
  if (status == null) return 1; // sem status fica logo após as vencidas
  return PESO_ATENCAO[status] ?? 1;
}

export function ordenarPorAtencao(subs: SubscriptionFinanceiro[]): SubscriptionFinanceiro[] {
  return [...subs].sort(
    (a, b) =>
      pesoAtencao(a.payment_status) - pesoAtencao(b.payment_status) ||
      a.nome.localeCompare(b.nome, 'pt-BR'),
  );
}

/**
 * Agrupa eventos órfãos por asaas_customer_id (decisão 03/jun): cada cliente aparece
 * uma vez, representado pelo evento mais recente, com a contagem total.
 * Clientes com evento mais recente aparecem primeiro.
 */
export function agruparOrfaos(eventos: OrfaoEvento[]): OrfaoCliente[] {
  const porCliente = new Map<string, OrfaoEvento[]>();
  for (const evento of eventos) {
    const chave = evento.asaas_customer_id ?? '__sem_codigo__';
    const lista = porCliente.get(chave) ?? [];
    lista.push(evento);
    porCliente.set(chave, lista);
  }

  const grupos: OrfaoCliente[] = [];
  for (const lista of porCliente.values()) {
    const ordenados = [...lista].sort((a, b) => b.received_at.localeCompare(a.received_at));
    grupos.push({
      asaas_customer_id: ordenados[0].asaas_customer_id,
      eventos: ordenados,
      principal: ordenados[0],
      total: ordenados.length,
    });
  }

  grupos.sort((a, b) => b.principal.received_at.localeCompare(a.principal.received_at));
  return grupos;
}
