// Acoes da Expedicao (E2 + baseline 20/07/2026 + zonas 17/08/2026): gerador
// (snapshot por ciclo) + transicoes de status + observacao/remocao +
// sequenciamento por onda. Le subscriptions/weekly_orders/pedidos_pontuais/
// produtos (so leitura) e escreve em `entregas`. Schema 0026 + 0030
// (subscription_id) + 0032 (zona, sequencia).
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
import {
  atribuiSequenciasFaltantes,
  moveNaSequencia,
  recalculaSequencias,
  type AtribuicaoSequencia,
  type EntregaSequenciavel,
  type Onda,
  type Zona,
} from './zonas';

type EntregaInsert = Database['public']['Tables']['entregas']['Insert'];

export interface GerarResult {
  criadas: number;
  atualizadas: number;
  sequenciadas: number;
}

/**
 * (Re)gera a expedicao de um ciclo a partir da demanda:
 *   - assinaturas: TODO subscriptions.status='active' recebe o baseline
 *     (Original + Integral do plano) toda semana, sem precisar de acao. O
 *     weekly_order do ciclo (delivery_date = data_entrega) e o UNICO override
 *     valido quando CONFIRMADO (composicao custom E extras) — rascunho ou
 *     ausencia de order caem no baseline puro, sem extras. Ver itensAssinatura.
 *   - avulsos: pedidos_pontuais status='confirmado' e semana_id = ciclo.
 * Faz upsert em `entregas` SO com o snapshot (nome/endereco/regiao/ZONA/itens/
 * origem); status, observacao e SEQUENCIA nunca entram no payload — regenerar
 * atualiza a demanda sem tocar no progresso de entrega, nas observacoes da
 * bancada nem na ordem que o Hugo ajustou na mao. Idempotente pelos UNIQUE
 * (semana_id, subscription_id) da 0030 / (semana_id, pedido_pontual_id) da 0026.
 *
 * A zona vem do CADASTRO (subscriptions.zona / pedidos_pontuais.zona) e e
 * congelada aqui — nunca derivada do bairro (Lagoa cai em R1 e em R3). Depois do
 * upsert, quem ficou sem sequencia recebe uma; ver `sequenciarExpedicao`.
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
      'id, nome, whatsapp, cep, rua, numero, complemento, bairro, cidade, zona, qty_original, qty_integral'
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
      'id, composicao, destinatario_nome, destinatario_whatsapp, pagador_nome, pagador_whatsapp, endereco_cep, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, zona'
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
      zona: s.zona ?? null,
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
      zona: p.zona ?? null,
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

  // Sequencia so pra quem ainda nao tem: assinante que entrou no meio da semana
  // ganha numero sem embaralhar a bag que o Hugo ja montou.
  const sequenciadas = await sequenciarExpedicao(semanaId);

  return { criadas, atualizadas, sequenciadas };
}

/** Le zonas ativas + entregas do ciclo — base das operacoes de sequencia. */
async function carregarParaSequenciar(
  semanaId: string
): Promise<{ entregas: EntregaSequenciavel[]; porCodigo: Map<string, Zona> }> {
  const [{ data: zonasRows, error: errZonas }, { data: rows, error: errEntregas }] =
    await Promise.all([
      supabase.from('zonas_entrega').select('codigo, onda, ordem, entra_na_onda, ativo'),
      supabase
        .from('entregas')
        .select('id, zona, sequencia, regiao, bairro, rua, numero, nome')
        .eq('semana_id', semanaId),
    ]);
  if (errZonas) throw errZonas;
  if (errEntregas) throw errEntregas;

  const porCodigo = new Map<string, Zona>(
    (zonasRows ?? [])
      .filter((z) => z.ativo !== false)
      .map((z) => [
        z.codigo as string,
        {
          codigo: z.codigo as string,
          nome: '',
          cidade: '',
          onda: (z.onda === 'niteroi' ? 'niteroi' : 'rio') as Onda,
          ordem: Number(z.ordem) || 0,
          corHex: '#000000',
          forma: 'circulo',
          entraNaOnda: z.entra_na_onda !== false,
          ativo: true,
        },
      ])
  );

  const entregas: EntregaSequenciavel[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    zona: (r.zona as string | null) ?? null,
    sequencia: (r.sequencia as number | null) ?? null,
    regiao: r.regiao as string,
    bairro: r.bairro as string,
    rua: r.rua as string,
    numero: (r.numero as string | null) ?? null,
    nome: r.nome as string,
  }));

  return { entregas, porCodigo };
}

/**
 * Grava as sequencias uma a uma. Sao poucas linhas (dezenas) e o UPDATE
 * individual e o unico jeito de nao passar perto do resto da linha: upsert aqui
 * exigiria mandar o payload inteiro e reabriria o risco de clobber que a 0026
 * fechou. Ordem decrescente de sequencia primeiro pra troca de numeros nao
 * colidir caso um UNIQUE seja adicionado no futuro.
 */
async function gravarSequencias(atrib: AtribuicaoSequencia[]): Promise<number> {
  for (const { id, sequencia } of [...atrib].sort((a, b) => b.sequencia - a.sequencia)) {
    const { error } = await supabase.from('entregas').update({ sequencia }).eq('id', id);
    if (error) throw error;
  }
  return atrib.length;
}

/**
 * Atribui sequencia a quem ainda nao tem, nas duas ondas. NAO renumera ninguem:
 * o ajuste manual do Hugo e sempre preservado. Devolve quantas entregas foram
 * numeradas.
 */
export async function sequenciarExpedicao(semanaId: string): Promise<number> {
  const { entregas, porCodigo } = await carregarParaSequenciar(semanaId);
  return gravarSequencias(atribuiSequenciasFaltantes(entregas, porCodigo));
}

/**
 * Renumera a onda inteira 1..n na ordem canonica (zona, bairro, logradouro),
 * DESCARTANDO o arranjo manual. So por acao explicita do operador — recalculo
 * automatico seria o "sistema desfazendo o ajuste" que o briefing proibe.
 */
export async function recalcularSequenciaOnda(semanaId: string, onda: Onda): Promise<number> {
  const { entregas, porCodigo } = await carregarParaSequenciar(semanaId);
  return gravarSequencias(recalculaSequencias(entregas, porCodigo, onda));
}

/** Move uma entrega uma posicao na onda, trocando de numero com a vizinha. */
export async function moverEntregaNaSequencia(
  semanaId: string,
  id: string,
  direcao: 'cima' | 'baixo'
): Promise<void> {
  const { entregas, porCodigo } = await carregarParaSequenciar(semanaId);
  await gravarSequencias(moveNaSequencia(entregas, porCodigo, id, direcao));
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
