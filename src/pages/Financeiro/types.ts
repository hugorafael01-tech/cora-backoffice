import type { Database } from '../../lib/database.types';

/** Enum do schema (0020): em_dia | pendente | vencido. null = ainda sem pagamento registrado. */
export type PaymentStatus = Database['public']['Enums']['payment_status_enum'];

/** Linha do panorama (gesto 1). Leitura via client autenticado + is_admin. */
export interface SubscriptionFinanceiro {
  id: string;
  nome: string;
  payment_status: PaymentStatus | null;
  last_payment_at: string | null;
  asaas_customer_id: string | null;
}

/** Evento órfão individual (asaas_webhook_events com subscription_id null). */
export interface OrfaoEvento {
  id: string;
  event_type: string;
  asaas_customer_id: string | null;
  received_at: string;
  /** Extraído defensivamente de payload.payment.value; ausente vira null. */
  valor: number | null;
}

/** Eventos órfãos agrupados por cliente Asaas (decisão 03/jun: 1 cliente por linha). */
export interface OrfaoCliente {
  asaas_customer_id: string | null;
  /** Eventos do cliente, mais recente primeiro. */
  eventos: OrfaoEvento[];
  /** Evento mais recente do cliente (o exibido na linha). */
  principal: OrfaoEvento;
  total: number;
}

export interface ResumoFinanceiro {
  emDia: number;
  vencidas: number;
  semStatus: number;
  /** Clientes Asaas com evento órfão (não nº de eventos). */
  praIdentificar: number;
}

export type FiltroPanorama = 'todas' | 'vencidas' | 'sem_status' | 'em_dia';
