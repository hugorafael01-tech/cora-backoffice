import { supabase } from './supabase';

/** URL base do cora-portal (endpoints server-side). Config via env, fallback prod. */
const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL ?? 'https://app.acora.com.br').replace(/\/$/, '');

/**
 * Resultado da tentativa de vínculo, já traduzido do contrato da Peça A
 * (status HTTP + body.error) pra um caso que a UI sabe tratar.
 */
export type VincularResultado =
  | { tipo: 'ok' }
  | { tipo: 'customer_already_linked' } // 409: o cliente Asaas já está em outra assinatura
  | { tipo: 'not_found' } //              404: a assinatura escolhida sumiu
  | { tipo: 'bad_request' } //            400: dados inválidos/incompletos
  | { tipo: 'unauthorized' } //           401/403 ou sem sessão: re-login
  | { tipo: 'network' }; //               rede/erro inesperado

/**
 * Grava o vínculo asaas_customer_id ↔ subscription chamando o endpoint do portal.
 * O backoffice não escreve em subscriptions direto (0019): a escrita é via service_role
 * no portal. Usa o access_token da sessão atual do admin (não pede login novo).
 */
export async function vincularAsaas(params: {
  subscriptionId: string;
  asaasCustomerId: string;
}): Promise<VincularResultado> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) return { tipo: 'unauthorized' };

  let resp: Response;
  try {
    resp = await fetch(`${PORTAL_URL}/api/asaas/vincular`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subscription_id: params.subscriptionId,
        asaas_customer_id: params.asaasCustomerId,
      }),
    });
  } catch {
    return { tipo: 'network' };
  }

  if (resp.ok) return { tipo: 'ok' };

  switch (resp.status) {
    case 409:
      return { tipo: 'customer_already_linked' };
    case 404:
      return { tipo: 'not_found' };
    case 400:
      return { tipo: 'bad_request' };
    case 401:
    case 403:
      return { tipo: 'unauthorized' };
    default:
      return { tipo: 'network' };
  }
}
