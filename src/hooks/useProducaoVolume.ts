import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { derivaEstado } from '../lib/semana';
import type { DadosProducao, FonteLinha, LinhaVolume, Semana } from '../pages/Producao/types';

const UUID_VAZIO = '00000000-0000-0000-0000-000000000000';

export interface UseProducaoVolumeResult {
  dados: DadosProducao | null;
  loading: boolean;
  error: Error | null;
  naoEncontrada: boolean;
  refetch: () => void;
}

/**
 * Monta o estado da tela "Definir volume" pra uma semana.
 *
 * Linhas = (versoes ativas do cardapio da semana) UNIAO (versoes ja com producao
 * na semana, incluindo receitas de teste). qty vem da producao existente (0 se nao
 * houver), deixando a tela idempotente: reabrir mostra o que ja foi planejado.
 *
 * O preview de massa/levain e calculado em lib/producao.ts a partir de pesoMassaG +
 * somaBaker + levainPct (espelho do trigger). O banco continua sendo a fonte da verdade.
 */
export function useProducaoVolume(id: string | undefined): UseProducaoVolumeResult {
  const [dados, setDados] = useState<DadosProducao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelado = false;
    if (!id) return;

    async function carregar(semanaId: string) {
      setLoading(true);
      setError(null);
      setNaoEncontrada(false);

      try {
        const { data: semana, error: errSemana } = await supabase
          .from('semanas')
          .select('*')
          .eq('id', semanaId)
          .single();

        if (errSemana || !semana) {
          if (!cancelado) {
            setNaoEncontrada(true);
            setLoading(false);
          }
          return;
        }

        const estado = derivaEstado(semana as Semana);

        // Vizinhanca (nav prev/next)
        const [{ data: anterior }, { data: proxima }] = await Promise.all([
          supabase
            .from('semanas')
            .select('id')
            .lt('data_entrega', semana.data_entrega)
            .order('data_entrega', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('semanas')
            .select('id')
            .gt('data_entrega', semana.data_entrega)
            .order('data_entrega', { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        const linhas = await carregarLinhas(semanaId);

        if (cancelado) return;
        setDados({
          semana: semana as Semana,
          estado,
          linhas,
          semanaAnterior: anterior?.id ?? null,
          semanaProxima: proxima?.id ?? null,
        });
        setLoading(false);
      } catch (e) {
        if (!cancelado) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setLoading(false);
        }
      }
    }

    carregar(id);
    return () => {
      cancelado = true;
    };
  }, [id, tick]);

  return { dados, loading, error, naoEncontrada, refetch };
}

async function carregarLinhas(semanaId: string): Promise<LinhaVolume[]> {
  // 1. Cardapio da semana -> produtos -> versao ativa
  const { data: cardapio } = await supabase
    .from('cardapios')
    .select('produto_id')
    .eq('semana_id', semanaId);
  const produtoIdsCardapio = (cardapio ?? []).map((c) => c.produto_id as string);

  const { data: receitasCardapio } = await supabase
    .from('receitas')
    .select('produto_id, versao_ativa_id')
    .in('produto_id', produtoIdsCardapio.length ? produtoIdsCardapio : [UUID_VAZIO]);

  const versaoIdsCardapio = new Set(
    (receitasCardapio ?? [])
      .map((r) => r.versao_ativa_id)
      .filter((v): v is string => v != null)
  );

  // 2. Producoes ja existentes na semana (prefill de qty)
  const { data: producoes } = await supabase
    .from('producoes')
    .select('versao_receita_id, qty_paes_prevista')
    .eq('semana_id', semanaId);

  const qtyPorVersao = new Map<string, number>();
  for (const p of producoes ?? []) {
    qtyPorVersao.set(p.versao_receita_id as string, p.qty_paes_prevista ?? 0);
  }

  // 3. Uniao de todas as versoes a exibir
  const allVersaoIds = [...new Set([...versaoIdsCardapio, ...qtyPorVersao.keys()])];
  if (allVersaoIds.length === 0) return [];

  // 4. Versoes -> receita_id, peso_massa_g, status
  const { data: versoes } = await supabase
    .from('versoes_receita')
    .select('id, receita_id, peso_massa_g, status')
    .in('id', allVersaoIds);

  const receitaIds = [...new Set((versoes ?? []).map((v) => v.receita_id as string))];
  const { data: receitas } = await supabase
    .from('receitas')
    .select('id, produto_id, grupo_sugerido, formato')
    .in('id', receitaIds.length ? receitaIds : [UUID_VAZIO]);

  const produtoIds = [...new Set((receitas ?? []).map((r) => r.produto_id as string))];
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, nome, formato')
    .in('id', produtoIds.length ? produtoIds : [UUID_VAZIO]);

  // 5. Ingredientes por versao -> somaBaker + levainPct
  const { data: levainIng } = await supabase
    .from('ingredientes')
    .select('id')
    .eq('slug', 'levain')
    .maybeSingle();
  const levainId = levainIng?.id ?? null;

  const { data: ingredientes } = await supabase
    .from('ingredientes_receita')
    .select('versao_receita_id, ingrediente_id, percentual_baker')
    .in('versao_receita_id', allVersaoIds);

  const somaBakerPorVersao = new Map<string, number>();
  const levainPctPorVersao = new Map<string, number>();
  for (const ir of ingredientes ?? []) {
    const vid = ir.versao_receita_id as string;
    const pct = Number(ir.percentual_baker) || 0;
    somaBakerPorVersao.set(vid, (somaBakerPorVersao.get(vid) ?? 0) + pct);
    if (levainId && ir.ingrediente_id === levainId) {
      levainPctPorVersao.set(vid, pct);
    }
  }

  const receitaById = new Map((receitas ?? []).map((r) => [r.id as string, r]));
  const produtoById = new Map((produtos ?? []).map((p) => [p.id as string, p]));

  const linhas: LinhaVolume[] = [];
  for (const v of versoes ?? []) {
    const receita = receitaById.get(v.receita_id as string);
    if (!receita) continue;
    const produto = produtoById.get(receita.produto_id as string);
    if (!produto) continue;

    const versaoId = v.id as string;
    const rascunho = v.status === 'rascunho';
    const temProducao = qtyPorVersao.has(versaoId);
    const fonte: FonteLinha = versaoIdsCardapio.has(versaoId)
      ? 'cardapio'
      : rascunho
        ? 'teste'
        : 'adicionada';

    linhas.push({
      versaoReceitaId: versaoId,
      produtoId: produto.id as string,
      nome: produto.nome as string,
      formato: (produto.formato as LinhaVolume['formato']) ?? null,
      grupo: receita.grupo_sugerido ?? null,
      fonte,
      rascunho,
      pesoMassaG: v.peso_massa_g ?? null,
      somaBaker: somaBakerPorVersao.get(versaoId) ?? 0,
      levainPct: levainPctPorVersao.get(versaoId) ?? null,
      qty: qtyPorVersao.get(versaoId) ?? 0,
      temProducao,
    });
  }

  // Cardapio/adicionadas primeiro, testes por ultimo; cada bloco por nome.
  const ordem: Record<FonteLinha, number> = { cardapio: 0, adicionada: 1, teste: 2 };
  return linhas.sort(
    (a, b) => ordem[a.fonte] - ordem[b.fonte] || a.nome.localeCompare(b.nome)
  );
}
