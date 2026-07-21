// Acoes da Expedicao (E2 + baseline 20/07/2026): gerador (snapshot por ciclo) +
// transicoes de status + observacao/remocao. Le subscriptions/weekly_orders/
// pedidos_pontuais/produtos (so leitura) e escreve em `entregas`. Schema 0026 +
// 0030 (subscription_id).
import { supabase } from './supabase';
import type { Database, Json } from './database.types';
import {
  flattenComposicaoPontual,
  itensAssinatura,
  normalizaRegiao,
  proximoStatus,
  statusAnterior,
  type ItemEntrega,
  type StatusEntrega,
} from './expedicao';

type EntregaInsert = Database['public']['Tables']['entregas']['Insert'];

export interface GerarResult {
  criadas: number;
  atualizadas: number;
}

/**
 * (Re)gera a expedicao de um ciclo a partir da demanda:
 *   - assinaturas: TODO subscriptions.status='active' recebe o baseline
 *     (Original + Integral do plano) toda semana, sem precisar de acao. O
 *     weekly_order do ciclo (delivery_date = data_entrega) e o UNICO override
 *     valido quando CONFIRMADO (composicao custom E extras) — rascunho ou
 *     ausencia de order caem no baseline puro, sem extras. Ver itensAssinatura.
 *   - avulsos: pedidos_pontuais status='confirmado' e semana_id = ciclo.
 * Faz upsert em `entregas` SO com o snapshot (nome/endereco/regiao/itens/origem);
 * status e observacao NUNCA entram no payload — regenerar atualiza a demanda sem
 * tocar no progresso de entrega nem nas observacoes da bancada. Idempotente pelos
 * UNIQUE (semana_id, subscription_id) da 0030 / (semana_id, pedido_pontual_id) da
 * 0026.
 */
export async function gerarExpedicao(semanaId: string): Promise<GerarResult> {
  // 1) ciclo
  const { data: semana, error: errSemana } = await supabase
    .from('semanas')
    .select('id, data_entrega')
    .eq('id', semanaId)
    .single();
  if (errSemana || !semana) throw errSemana ?? new Error('Ciclo nao encontrado');
  const dataEntrega = semana.data_entrega;

  // 2) nome por slug (catalogo) pra resolver os itens
  const { data: produtos } = await supabase.from('produtos').select('slug, nome');
  const nomePorSlug = new Map((produtos ?? []).map((p) => [p.slug as string, p.nome as string]));

  // 3) assinaturas ativas (fonte da demanda) + weekly_orders do ciclo (override)
  const { data: assinaturas, error: errAssinaturas } = await supabase
    .from('subscriptions')
    .select(
      'id, nome, whatsapp, cep, rua, numero, complemento, bairro, cidade, qty_original, qty_integral'
    )
    .eq('status', 'active');
  if (errAssinaturas) throw errAssinaturas;

  const { data: ordens, error: errOrdens } = await supabase
    .from('weekly_orders')
    .select('id, subscription_id, status, composition, extras')
    .eq('delivery_date', dataEntrega);
  if (errOrdens) throw errOrdens;

  const ordemPorSubscription = new Map(
    (ordens ?? []).map((o) => [
      o.subscription_id as string,
      { id: o.id as string, status: o.status as 'rascunho' | 'confirmado', composition: o.composition, extras: o.extras },
    ])
  );

  // 4) avulsos (pedidos_pontuais)
  const { data: pontuais, error: errPontuais } = await supabase
    .from('pedidos_pontuais')
    .select(
      'id, composicao, destinatario_nome, destinatario_whatsapp, pagador_nome, pagador_whatsapp, endereco_cep, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade'
    )
    .eq('status', 'confirmado')
    .eq('semana_id', semanaId);
  if (errPontuais) throw errPontuais;

  const linhasAssinatura: EntregaInsert[] = (assinaturas ?? []).map((s) => {
    const ordem = ordemPorSubscription.get(s.id as string) ?? null;
    const itens = itensAssinatura(
      ordem,
      { original: s.qty_original ?? 0, integral: s.qty_integral ?? 0 },
      nomePorSlug
    );
    return {
      semana_id: semanaId,
      origem: 'assinatura',
      subscription_id: s.id,
      weekly_order_id: ordem && ordem.status === 'confirmado' ? ordem.id : null,
      pedido_pontual_id: null,
      nome: s.nome,
      whatsapp: s.whatsapp ?? null,
      cep: s.cep ?? null,
      rua: s.rua,
      numero: s.numero ?? null,
      complemento: s.complemento ?? null,
      bairro: s.bairro,
      cidade: s.cidade,
      regiao: normalizaRegiao(s.cidade),
      itens: itens as unknown as Json,
    };
  });

  const linhasAvulso: EntregaInsert[] = (pontuais ?? []).map((p) => {
    const itens = flattenComposicaoPontual(p.composicao, nomePorSlug);
    return {
      semana_id: semanaId,
      origem: 'avulso',
      weekly_order_id: null,
      pedido_pontual_id: p.id,
      nome: p.destinatario_nome || p.pagador_nome,
      whatsapp: p.destinatario_whatsapp || p.pagador_whatsapp || null,
      cep: p.endereco_cep ?? null,
      rua: p.endereco_rua,
      numero: p.endereco_numero ?? null,
      complemento: p.endereco_complemento ?? null,
      bairro: p.endereco_bairro,
      cidade: p.endereco_cidade,
      regiao: normalizaRegiao(p.endereco_cidade),
      itens: itens as unknown as Json,
    };
  });

  // Conta criadas vs atualizadas comparando com o que ja existe (antes do upsert).
  const { data: existentes } = await supabase
    .from('entregas')
    .select('subscription_id, pedido_pontual_id')
    .eq('semana_id', semanaId);
  const subExist = new Set(
    (existentes ?? []).map((e) => e.subscription_id).filter((v): v is string => v != null)
  );
  const ppExist = new Set(
    (existentes ?? []).map((e) => e.pedido_pontual_id).filter((v): v is string => v != null)
  );

  let criadas = 0;
  let atualizadas = 0;
  for (const r of linhasAssinatura) {
    if (subExist.has(r.subscription_id!)) atualizadas++;
    else criadas++;
  }
  for (const r of linhasAvulso) {
    if (ppExist.has(r.pedido_pontual_id!)) atualizadas++;
    else criadas++;
  }

  if (linhasAssinatura.length > 0) {
    const { error } = await supabase
      .from('entregas')
      .upsert(linhasAssinatura, { onConflict: 'semana_id,subscription_id' });
    if (error) throw error;
  }
  if (linhasAvulso.length > 0) {
    const { error } = await supabase
      .from('entregas')
      .upsert(linhasAvulso, { onConflict: 'semana_id,pedido_pontual_id' });
    if (error) throw error;
  }

  return { criadas, atualizadas };
}

/** pendente -> em_rota (em_rota_at=now) -> entregue (entregue_at=now). Em entregue, no-op. */
export async function avancarStatusEntrega(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('entregas')
    .select('status')
    .eq('id', id)
    .single();
  if (error || !data) throw error ?? new Error('Entrega nao encontrada');

  const atual = data.status as StatusEntrega;
  const prox = proximoStatus(atual);
  if (prox === atual) return;

  const now = new Date().toISOString();
  const patch: Database['public']['Tables']['entregas']['Update'] = { status: prox };
  if (prox === 'em_rota') patch.em_rota_at = now;
  if (prox === 'entregue') patch.entregue_at = now;

  const { error: errUpd } = await supabase.from('entregas').update(patch).eq('id', id);
  if (errUpd) throw errUpd;
}

/** Um passo atras; limpa o timestamp do estado que deixou. Em pendente, no-op. */
export async function voltarStatusEntrega(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('entregas')
    .select('status')
    .eq('id', id)
    .single();
  if (error || !data) throw error ?? new Error('Entrega nao encontrada');

  const atual = data.status as StatusEntrega;
  const ant = statusAnterior(atual);
  if (ant === atual) return;

  const patch: Database['public']['Tables']['entregas']['Update'] = { status: ant };
  if (atual === 'em_rota') patch.em_rota_at = null; // saiu de em_rota
  if (atual === 'entregue') patch.entregue_at = null; // saiu de entregue

  const { error: errUpd } = await supabase.from('entregas').update(patch).eq('id', id);
  if (errUpd) throw errUpd;
}

/** Salva (ou limpa) a observacao editavel da entrega. */
export async function salvarObservacaoEntrega(id: string, texto: string): Promise<void> {
  const valor = texto.trim() || null;
  const { error } = await supabase.from('entregas').update({ observacao: valor }).eq('id', id);
  if (error) throw error;
}

/** Remove a entrega (confirmacao fica na UI). */
export async function removerEntrega(id: string): Promise<void> {
  const { error } = await supabase.from('entregas').delete().eq('id', id);
  if (error) throw error;
}

export type { ItemEntrega };
