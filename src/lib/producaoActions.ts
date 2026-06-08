import { supabase } from './supabase';
import { slugify } from './producao';
import type { Database, Json } from './database.types';
import type { LinhaVolume, ProdutoFormato } from '../pages/Producao/types';

type EtapaProducaoUpdate = Database['public']['Tables']['etapas_producao']['Update'];

async function getLevainId(): Promise<string | null> {
  const { data } = await supabase
    .from('ingredientes')
    .select('id')
    .eq('slug', 'levain')
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Monta uma LinhaVolume (qty 0, sem producao) pra uma versao recem-criada.
 * Usada por criarVariacao/criarPaoNovo pra inserir a linha na tela sem refetch
 * (a versao de teste ainda nao esta no cardapio nem tem producao).
 */
export async function carregarLinhaVolume(
  versaoReceitaId: string,
  fonte: LinhaVolume['fonte']
): Promise<LinhaVolume> {
  const { data: versao } = await supabase
    .from('versoes_receita')
    .select('id, receita_id, peso_massa_g, status')
    .eq('id', versaoReceitaId)
    .single();
  if (!versao) throw new Error('Versao recem-criada nao encontrada');

  const { data: receita } = await supabase
    .from('receitas')
    .select('id, produto_id, grupo_sugerido')
    .eq('id', versao.receita_id as string)
    .single();
  if (!receita) throw new Error('Receita da versao nao encontrada');

  const { data: produto } = await supabase
    .from('produtos')
    .select('id, nome, formato')
    .eq('id', receita.produto_id as string)
    .single();
  if (!produto) throw new Error('Produto da versao nao encontrado');

  const levainId = await getLevainId();
  const { data: ingredientes } = await supabase
    .from('ingredientes_receita')
    .select('ingrediente_id, percentual_baker')
    .eq('versao_receita_id', versaoReceitaId);

  let somaBaker = 0;
  let levainPct: number | null = null;
  for (const ir of ingredientes ?? []) {
    const pct = Number(ir.percentual_baker) || 0;
    somaBaker += pct;
    if (levainId && ir.ingrediente_id === levainId) levainPct = pct;
  }

  return {
    versaoReceitaId,
    produtoId: produto.id as string,
    nome: produto.nome as string,
    formato: (produto.formato as ProdutoFormato | null) ?? null,
    grupo: receita.grupo_sugerido ?? null,
    fonte,
    rascunho: versao.status === 'rascunho',
    pesoMassaG: versao.peso_massa_g ?? null,
    somaBaker,
    levainPct,
    qty: 0,
    temProducao: false,
    producaoStatus: null,
  };
}

export interface CriarProducoesResult {
  criadas: number;
}

/**
 * "Criar producoes da semana": para cada linha com qty>0, upsert em producoes
 * (ON CONFLICT semana_id+versao_receita_id DO UPDATE) e gera as etapas.
 * massa/levain previstos sao preenchidos pelo trigger no banco (fonte da verdade).
 *
 * IMPORTANTE (fix Estado B): NAO mandamos origem/status no payload. No INSERT os
 * defaults da coluna preenchem ('teste'/'planejada'); no UPDATE de conflito ficam
 * PRESERVADOS (antes o upsert resetava esses campos, jogando uma producao
 * em_curso/concluida de volta pra planejada). Alem disso, producoes ja
 * em_curso/concluida sao EXCLUIDAS do upsert: a tela de volume nunca reescreve a
 * qty de uma producao que ja saiu da prancheta.
 */
export async function criarProducoesSemana(
  semanaId: string,
  linhas: LinhaVolume[]
): Promise<CriarProducoesResult> {
  const comQty = linhas.filter((l) => l.qty > 0);
  if (comQty.length === 0) return { criadas: 0 };

  // Guard: producoes ja iniciadas/concluidas nao sao tocadas por esta tela.
  const { data: existentes, error: errExist } = await supabase
    .from('producoes')
    .select('versao_receita_id, status')
    .eq('semana_id', semanaId);
  if (errExist) throw errExist;

  const congeladas = new Set(
    (existentes ?? [])
      .filter((p) => p.status === 'em_curso' || p.status === 'concluida')
      .map((p) => p.versao_receita_id as string)
  );

  const aGravar = comQty.filter((l) => !congeladas.has(l.versaoReceitaId));
  if (aGravar.length === 0) return { criadas: 0 };

  const rows = aGravar.map((l) => ({
    semana_id: semanaId,
    versao_receita_id: l.versaoReceitaId,
    qty_paes_prevista: l.qty,
  }));

  const { data, error } = await supabase
    .from('producoes')
    .upsert(rows, { onConflict: 'semana_id,versao_receita_id' })
    .select('id');
  if (error) throw error;

  // Gera etapas de cada producao (idempotente: ON CONFLICT DO NOTHING no banco).
  for (const p of data ?? []) {
    const { error: errEtapas } = await supabase.rpc('popular_etapas_producao', {
      p_producao_id: p.id as string,
    });
    if (errEtapas) throw errEtapas;
  }

  return { criadas: rows.length };
}

/**
 * Remove a producao de uma versao na semana. Dois guards:
 *  - origem='teste': nunca apaga uma producao de pedido/manual real (futuro).
 *  - status in (planejada, cancelada): nunca apaga uma producao ja em_curso ou
 *    concluida (a FK e ON DELETE CASCADE — apagaria etapas, carimbos e capturas).
 * Retorna quantas linhas foram apagadas (0 = nada a apagar / congelada / nao teste).
 */
export async function removerProducao(
  semanaId: string,
  versaoReceitaId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('producoes')
    .delete()
    .eq('semana_id', semanaId)
    .eq('versao_receita_id', versaoReceitaId)
    .eq('origem', 'teste')
    .in('status', ['planejada', 'cancelada'])
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}

export interface VariacaoInput {
  versaoOrigemId: string;
  pesoMassaG: number;
  hidratacaoAlvo: number; // ex.: 75 (%)
  prefermentoPct: number; // ex.: 20 (%) -> baker 0.20 na linha de levain
  notas: string;
}

/**
 * Variacao de pao existente: fork_versao_receita(origem, 'rascunho') clona
 * ingredientes+etapas; depois aplicamos os overrides do form (peso, hidratacao,
 * notas e o % da linha de levain). Retorna a LinhaVolume pronta pra tela.
 */
export async function criarVariacao(input: VariacaoInput): Promise<LinhaVolume> {
  const { data: novaVersaoId, error: errFork } = await supabase.rpc('fork_versao_receita', {
    p_versao_origem_id: input.versaoOrigemId,
    p_status: 'rascunho',
  });
  if (errFork) throw errFork;
  if (!novaVersaoId) throw new Error('fork_versao_receita nao retornou id');

  const versaoId = novaVersaoId as string;

  const { error: errVersao } = await supabase
    .from('versoes_receita')
    .update({
      peso_massa_g: input.pesoMassaG,
      hidratacao_alvo: input.hidratacaoAlvo,
      notas: input.notas || null,
    })
    .eq('id', versaoId);
  if (errVersao) throw errVersao;

  // Override do % de prefermento na linha de levain clonada (se existir).
  const levainId = await getLevainId();
  if (levainId) {
    const { error: errLev } = await supabase
      .from('ingredientes_receita')
      .update({ percentual_baker: input.prefermentoPct / 100 })
      .eq('versao_receita_id', versaoId)
      .eq('ingrediente_id', levainId);
    if (errLev) throw errLev;
  }

  return carregarLinhaVolume(versaoId, 'teste');
}

export interface PaoNovoInput {
  nome: string;
  formato: ProdutoFormato;
  pesoMassaG: number;
  hidratacaoAlvo: number; // ex.: 75 (%)
  prefermentoPct: number; // ex.: 20 (%) -> registrado em notas (sem ingredientes)
  notas: string;
}

/** Garante slug unico em produtos (slug e UNIQUE): base, base-2, base-3... */
async function slugUnico(nome: string): Promise<string> {
  const base = slugify(nome) || 'pao-teste';
  const { data } = await supabase.from('produtos').select('slug').like('slug', `${base}%`);
  const usados = new Set((data ?? []).map((p) => p.slug as string));
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Pao novo de teste: novo produto + receita + versao rascunho. Nasce SEM
 * ingredientes (briefing) -> somaBaker 0 -> levain '-' e massa = qty x peso.
 * hidratacao/prefermento ficam registrados em notas pro modulo Receitas autorar.
 */
export async function criarPaoNovo(input: PaoNovoInput): Promise<LinhaVolume> {
  const slug = await slugUnico(input.nome);

  const { data: produto, error: errProd } = await supabase
    .from('produtos')
    .insert({
      slug,
      nome: input.nome,
      tipo: 'fabricado',
      unidade: 'un',
      formato: input.formato,
      peso_alvo_g: input.pesoMassaG, // placeholder: Receitas refina (assado vs cru)
    })
    .select('id')
    .single();
  if (errProd) throw errProd;

  const { data: receita, error: errRec } = await supabase
    .from('receitas')
    .insert({
      produto_id: produto.id as string,
      formato: input.formato,
      grupo_sugerido: 2,
    })
    .select('id')
    .single();
  if (errRec) throw errRec;

  const notaAuthoring = [
    input.notas,
    `Alvo: hidratacao ${input.hidratacaoAlvo}%, prefermento ${input.prefermentoPct}%.`,
  ]
    .filter(Boolean)
    .join(' ');

  const { data: versao, error: errVer } = await supabase
    .from('versoes_receita')
    .insert({
      receita_id: receita.id as string,
      numero_versao: 1,
      status: 'rascunho',
      hidratacao_alvo: input.hidratacaoAlvo,
      peso_massa_g: input.pesoMassaG,
      perda_coccao: 0.16,
      notas: notaAuthoring,
    })
    .select('id')
    .single();
  if (errVer) throw errVer;

  return carregarLinhaVolume(versao.id as string, 'teste');
}

// ============ Acompanhamento (Estado B / fatia B1) — escrita ============
//
// Escrita direta do client como admin (RLS admin_all em producoes/etapas_producao,
// igual fatia 1). Toda funcao faz throw no erro do supabase pra UI surfacear via
// erroAcao (nada de falha calada); a tela faz refetch apos sucesso.

export type AcaoEtapa = 'iniciar' | 'concluir' | 'pular';

/**
 * Avanca o status de uma etapa_producao:
 *  - iniciar  -> em_curso  + iniciada_at
 *  - concluir -> concluida + concluida_at (carimba iniciada_at se ainda nula)
 *  - pular    -> pulada
 * O `now` e gerado no client (sem RPC de relogio); aceitavel pro periodo de teste.
 *
 * Auto-inicio da producao: ao iniciar OU pular uma etapa, a producao e promovida
 * de 'planejada' -> 'em_curso' (idempotente via .eq('status','planejada'): nunca
 * re-carimba uma producao ja em_curso/concluida). 'concluir' nao promove (etapa
 * em_curso ja implica producao iniciada). Etapa primeiro, promote depois: se o
 * promote falhar, o erro sobe pro banner e um retry recupera.
 */
export async function avancarEtapa(
  etapaId: string,
  acao: AcaoEtapa,
  producaoId: string
): Promise<void> {
  const now = new Date().toISOString();

  let patch: EtapaProducaoUpdate;
  if (acao === 'iniciar') {
    patch = { status: 'em_curso', iniciada_at: now };
  } else if (acao === 'concluir') {
    // Le iniciada_at pra carimbar se a etapa foi concluida sem ter sido iniciada.
    const { data: atual, error: errLer } = await supabase
      .from('etapas_producao')
      .select('iniciada_at')
      .eq('id', etapaId)
      .single();
    if (errLer) throw errLer;
    patch = {
      status: 'concluida',
      concluida_at: now,
      iniciada_at: atual?.iniciada_at ?? now,
    };
  } else {
    patch = { status: 'pulada' };
  }

  const { error } = await supabase.from('etapas_producao').update(patch).eq('id', etapaId);
  if (error) throw error;

  // Promove a producao ao mover a 1a etapa (idempotente). 'concluir' nao promove.
  if (acao === 'iniciar' || acao === 'pular') {
    const { error: errProm } = await supabase
      .from('producoes')
      .update({ status: 'em_curso', iniciada_at: now })
      .eq('id', producaoId)
      .eq('status', 'planejada');
    if (errProm) throw errProm;
  }
}

/** Captura opcional gravada na propria etapa (por tipo). Campos undefined nao mexem. */
export interface CapturaEtapa {
  tempC?: number | null;
  dobraNumero?: number | null;
  detalhes?: Record<string, unknown> | null;
  notas?: string | null;
}

/**
 * Grava a captura inline de uma etapa (temp_c / dobra_numero / detalhes JSONB /
 * notas). So as chaves presentes no objeto sao enviadas ao update.
 */
export async function salvarCapturaEtapa(etapaId: string, captura: CapturaEtapa): Promise<void> {
  const patch: EtapaProducaoUpdate = {};
  if ('tempC' in captura) patch.temp_c = captura.tempC;
  if ('dobraNumero' in captura) patch.dobra_numero = captura.dobraNumero;
  if ('detalhes' in captura) patch.detalhes = (captura.detalhes ?? null) as Json;
  if ('notas' in captura) patch.notas = captura.notas;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from('etapas_producao').update(patch).eq('id', etapaId);
  if (error) throw error;
}

/** Status da producao MANUAL: iniciar -> em_curso + iniciada_at. */
export async function iniciarProducao(producaoId: string): Promise<void> {
  const { error } = await supabase
    .from('producoes')
    .update({ status: 'em_curso', iniciada_at: new Date().toISOString() })
    .eq('id', producaoId);
  if (error) throw error;
}

/**
 * Status da producao MANUAL: concluir -> concluida + concluida_at, cascateando
 * as etapas ainda abertas (aguardando/em_curso) -> concluida. As etapas vao
 * PRIMEIRO: se falhar, a producao continua em_curso e o erro sobe pro banner.
 * Nao toca iniciada_at nem nas etapas 'pulada' (o skip explicito fica intacto).
 */
export async function concluirProducao(producaoId: string): Promise<void> {
  const now = new Date().toISOString();

  const { error: errEtapas } = await supabase
    .from('etapas_producao')
    .update({ status: 'concluida', concluida_at: now })
    .eq('producao_id', producaoId)
    .in('status', ['aguardando', 'em_curso']);
  if (errEtapas) throw errEtapas;

  const { error } = await supabase
    .from('producoes')
    .update({ status: 'concluida', concluida_at: now })
    .eq('id', producaoId);
  if (error) throw error;
}
