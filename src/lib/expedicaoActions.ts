// Acoes da Expedicao (E2): gerador (snapshot por ciclo) + transicoes de status +
// observacao/remocao. Le weekly_orders/pedidos_pontuais/subscriptions/produtos
// (so leitura) e escreve em `entregas`. Schema 0026.
import { supabase } from './supabase';
import type { Database, Json } from './database.types';
import {
  flattenComposicaoPontual,
  flattenComposition,
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
 * (Re)gera a expedicao de um ciclo a partir da demanda confirmada:
 *   - assinaturas: weekly_orders status='confirmado' e delivery_date = data_entrega
 *     do ciclo (join subscriptions pra nome/whatsapp/endereco/itens);
 *   - avulsos: pedidos_pontuais status='confirmado' e semana_id = ciclo.
 * Faz upsert em `entregas` SO com o snapshot (nome/endereco/regiao/itens/origem);
 * status e observacao NUNCA entram no payload — regenerar atualiza a demanda sem
 * tocar no progresso de entrega nem nas observacoes da bancada. Idempotente pelos
 * UNIQUE (semana_id, weekly_order_id) / (semana_id, pedido_pontual_id) da 0026.
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

  // 3) assinaturas (weekly_orders + subscriptions)
  const { data: ordens, error: errOrdens } = await supabase
    .from('weekly_orders')
    .select(
      'id, composition, extras, subscriptions!inner ( nome, whatsapp, cep, rua, numero, complemento, bairro, cidade )'
    )
    .eq('status', 'confirmado')
    .eq('delivery_date', dataEntrega);
  if (errOrdens) throw errOrdens;

  // 4) avulsos (pedidos_pontuais)
  const { data: pontuais, error: errPontuais } = await supabase
    .from('pedidos_pontuais')
    .select(
      'id, composicao, destinatario_nome, destinatario_whatsapp, pagador_nome, pagador_whatsapp, endereco_cep, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade'
    )
    .eq('status', 'confirmado')
    .eq('semana_id', semanaId);
  if (errPontuais) throw errPontuais;

  type OrdemRow = {
    id: string;
    composition: Json | null;
    extras: Json | null;
    subscriptions: {
      nome: string;
      whatsapp: string | null;
      cep: string | null;
      rua: string;
      numero: string | null;
      complemento: string | null;
      bairro: string;
      cidade: string;
    };
  };

  const linhasAssinatura: EntregaInsert[] = ((ordens ?? []) as unknown as OrdemRow[]).map((o) => {
    const s = o.subscriptions;
    const itens = flattenComposition(o.composition, o.extras, nomePorSlug);
    return {
      semana_id: semanaId,
      origem: 'assinatura',
      weekly_order_id: o.id,
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
    .select('weekly_order_id, pedido_pontual_id')
    .eq('semana_id', semanaId);
  const woExist = new Set(
    (existentes ?? []).map((e) => e.weekly_order_id).filter((v): v is string => v != null)
  );
  const ppExist = new Set(
    (existentes ?? []).map((e) => e.pedido_pontual_id).filter((v): v is string => v != null)
  );

  let criadas = 0;
  let atualizadas = 0;
  for (const r of linhasAssinatura) {
    if (woExist.has(r.weekly_order_id!)) atualizadas++;
    else criadas++;
  }
  for (const r of linhasAvulso) {
    if (ppExist.has(r.pedido_pontual_id!)) atualizadas++;
    else criadas++;
  }

  if (linhasAssinatura.length > 0) {
    const { error } = await supabase
      .from('entregas')
      .upsert(linhasAssinatura, { onConflict: 'semana_id,weekly_order_id' });
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
