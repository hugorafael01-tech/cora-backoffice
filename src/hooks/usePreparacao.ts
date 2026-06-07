import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { farinhaPorPaoG } from '../lib/producao';
import type {
  DadosPreparacao,
  Ficha,
  FichaEtapa,
  FichaIngrediente,
  MiseIngrediente,
  MiseProduto,
} from '../pages/Producao/types';

const UUID_VAZIO = '00000000-0000-0000-0000-000000000000';

export interface UsePreparacaoResult {
  dados: DadosPreparacao | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Carrega a view Preparacao (read-only) de uma semana:
 * - mise en place: rpc mise_en_place_semana (fonte da verdade). O client so
 *   soma qty_g por ingrediente pro total; o breakdown por produto e a saida
 *   nativa da funcao (GROUP BY ingrediente, produto).
 * - fichas: formulacao (baker% + g/pao via peso_massa_g/Sigma baker, mesma
 *   formula guardada de peso_farinha_por_pao) + processo (etapas_receita).
 *
 * Le os producoes da semana (output da fatia 1) pra saber o que esta sendo
 * produzido. Sem producoes -> dados com fichas vazias (estado vazio na view).
 */
export function usePreparacao(semanaId: string | undefined): UsePreparacaoResult {
  const [dados, setDados] = useState<DadosPreparacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!semanaId) return;
    let cancelado = false;

    async function carregar(id: string) {
      setLoading(true);
      setError(null);
      try {
        const dados = await montarPreparacao(id);
        if (!cancelado) {
          setDados(dados);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelado) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setLoading(false);
        }
      }
    }

    carregar(semanaId);
    return () => {
      cancelado = true;
    };
  }, [semanaId]);

  return { dados, loading, error };
}

async function montarPreparacao(semanaId: string): Promise<DadosPreparacao> {
  // Producoes da semana (output da fatia 1)
  const { data: producoes, error: errProd } = await supabase
    .from('producoes')
    .select('versao_receita_id, qty_paes_prevista')
    .eq('semana_id', semanaId);
  if (errProd) throw errProd;

  if (!producoes || producoes.length === 0) {
    return { miseEnPlace: [], fichas: [], totalPaes: 0 };
  }

  const qtyPorVersao = new Map<string, number>();
  for (const p of producoes) {
    qtyPorVersao.set(p.versao_receita_id as string, p.qty_paes_prevista ?? 0);
  }
  const versaoIds = [...qtyPorVersao.keys()];
  const totalPaes = [...qtyPorVersao.values()].reduce((a, b) => a + b, 0);

  // --- Mise en place (fonte da verdade) ---
  const { data: mep, error: errMep } = await supabase.rpc('mise_en_place_semana', {
    p_semana_id: semanaId,
  });
  if (errMep) throw errMep;

  // --- Metadados das versoes/receitas/produtos ---
  const { data: versoes } = await supabase
    .from('versoes_receita')
    .select('id, receita_id, peso_massa_g, hidratacao_alvo, status')
    .in('id', versaoIds);

  const receitaIds = [...new Set((versoes ?? []).map((v) => v.receita_id as string))];
  const { data: receitas } = await supabase
    .from('receitas')
    .select('id, produto_id, grupo_sugerido')
    .in('id', receitaIds.length ? receitaIds : [UUID_VAZIO]);

  const produtoIds = [...new Set((receitas ?? []).map((r) => r.produto_id as string))];
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, nome')
    .in('id', produtoIds.length ? produtoIds : [UUID_VAZIO]);

  // --- Ingredientes (formulacao + nome/slug/unidade) ---
  const { data: ingRows } = await supabase
    .from('ingredientes_receita')
    .select('versao_receita_id, ingrediente_id, percentual_baker, ordem')
    .in('versao_receita_id', versaoIds);

  const idsIngredientes = new Set<string>();
  for (const r of ingRows ?? []) idsIngredientes.add(r.ingrediente_id as string);
  for (const m of mep ?? []) idsIngredientes.add(m.ingrediente_id as string);
  const { data: ingredientes } = await supabase
    .from('ingredientes')
    .select('id, nome, slug, unidade')
    .in('id', idsIngredientes.size ? [...idsIngredientes] : [UUID_VAZIO]);

  // --- Processo (etapas template) ---
  const { data: etapas } = await supabase
    .from('etapas_receita')
    .select('versao_receita_id, ordem, nome, tipo, duracao_min, notas')
    .in('versao_receita_id', versaoIds);

  const ingById = new Map((ingredientes ?? []).map((i) => [i.id as string, i]));
  const receitaById = new Map((receitas ?? []).map((r) => [r.id as string, r]));
  const produtoById = new Map((produtos ?? []).map((p) => [p.id as string, p]));

  // Soma baker por versao + linhas de ingrediente por versao
  const somaBakerPorVersao = new Map<string, number>();
  const ingPorVersao = new Map<string, typeof ingRows>();
  for (const r of ingRows ?? []) {
    const vid = r.versao_receita_id as string;
    somaBakerPorVersao.set(vid, (somaBakerPorVersao.get(vid) ?? 0) + (Number(r.percentual_baker) || 0));
    const arr = ingPorVersao.get(vid) ?? [];
    arr!.push(r);
    ingPorVersao.set(vid, arr);
  }

  const etapasPorVersao = new Map<string, typeof etapas>();
  for (const e of etapas ?? []) {
    const vid = e.versao_receita_id as string;
    const arr = etapasPorVersao.get(vid) ?? [];
    arr!.push(e);
    etapasPorVersao.set(vid, arr);
  }

  // --- Monta fichas ---
  const fichas: Ficha[] = [];
  for (const v of versoes ?? []) {
    const versaoId = v.id as string;
    const receita = receitaById.get(v.receita_id as string);
    const produto = receita ? produtoById.get(receita.produto_id as string) : null;
    const pesoMassaG = v.peso_massa_g ?? null;
    const somaBaker = somaBakerPorVersao.get(versaoId) ?? 0;
    const farinha = farinhaPorPaoG(pesoMassaG, somaBaker);

    const ingredientesFicha: FichaIngrediente[] = (ingPorVersao.get(versaoId) ?? [])
      .slice()
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((r): FichaIngrediente => {
        const ing = ingById.get(r.ingrediente_id as string);
        const baker = Number(r.percentual_baker) || 0;
        return {
          nome: (ing?.nome as string) ?? 'ingrediente',
          slug: (ing?.slug as string) ?? '',
          baker,
          gramasPorPao: farinha == null ? null : Math.round(farinha * baker),
        };
      });

    const etapasFicha: FichaEtapa[] = (etapasPorVersao.get(versaoId) ?? [])
      .slice()
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((e): FichaEtapa => ({
        ordem: e.ordem as number,
        nome: e.nome as string,
        tipo: (e.tipo as string | null) ?? null,
        duracaoMin: e.duracao_min ?? null,
        notas: e.notas ?? null,
      }));

    fichas.push({
      versaoReceitaId: versaoId,
      nome: (produto?.nome as string) ?? 'Receita',
      grupo: receita?.grupo_sugerido ?? null,
      rascunho: v.status === 'rascunho',
      hidratacaoAlvo: v.hidratacao_alvo ?? null,
      pesoMassaG,
      qty: qtyPorVersao.get(versaoId) ?? 0,
      ingredientes: ingredientesFicha,
      etapas: etapasFicha,
    });
  }
  fichas.sort((a, b) => a.nome.localeCompare(b.nome));

  // --- Agrega mise en place por ingrediente (so soma qty_g pro total) ---
  const grupos = new Map<string, MiseIngrediente>();
  for (const m of mep ?? []) {
    const ingId = m.ingrediente_id as string;
    const qtyG = Number(m.qty_g) || 0;
    const prod: MiseProduto = {
      produtoId: m.produto_id as string,
      produtoNome: m.produto_nome as string,
      qtyG,
    };
    const ja = grupos.get(ingId);
    if (ja) {
      ja.totalG += qtyG;
      ja.porProduto.push(prod);
    } else {
      const ing = ingById.get(ingId);
      grupos.set(ingId, {
        ingredienteId: ingId,
        nome: (m.ingrediente_nome as string) ?? (ing?.nome as string) ?? 'ingrediente',
        unidade: (ing?.unidade as string) ?? 'g',
        totalG: qtyG,
        porProduto: [prod],
      });
    }
  }
  const miseEnPlace = [...grupos.values()].sort((a, b) => b.totalG - a.totalG);
  for (const g of miseEnPlace) g.porProduto.sort((a, b) => b.qtyG - a.qtyG);

  return { miseEnPlace, fichas, totalPaes };
}
