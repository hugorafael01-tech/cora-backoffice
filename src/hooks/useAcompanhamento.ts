import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { derivaEtapaAgora, progressoEtapas } from '../lib/producao';
import type {
  DadosAcompanhamento,
  EtapaAcomp,
  ProducaoAcomp,
} from '../pages/Producao/types';

const UUID_VAZIO = '00000000-0000-0000-0000-000000000000';

export interface UseAcompanhamentoResult {
  dados: DadosAcompanhamento | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Carrega a view Acompanhamento (Estado B / fatia B1) de uma semana:
 * os producoes + suas etapas_producao (ordenadas) + nome/grupo do produto.
 *
 * Read da tela. As escritas (avancar etapa / captura / status da producao) ficam
 * em lib/producaoActions e a tela chama refetch() apos cada sucesso (consistente
 * com criarProducoesSemana — sem update otimista).
 */
export function useAcompanhamento(semanaId: string | undefined): UseAcompanhamentoResult {
  const [dados, setDados] = useState<DadosAcompanhamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!semanaId) return;
    let cancelado = false;

    async function carregar(id: string) {
      setLoading(true);
      setError(null);
      try {
        const d = await montarAcompanhamento(id);
        if (!cancelado) {
          setDados(d);
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
  }, [semanaId, tick]);

  return { dados, loading, error, refetch };
}

async function montarAcompanhamento(semanaId: string): Promise<DadosAcompanhamento> {
  // Producoes da semana
  const { data: producoes, error: errProd } = await supabase
    .from('producoes')
    .select('id, versao_receita_id, qty_paes_prevista, status, iniciada_at, concluida_at')
    .eq('semana_id', semanaId);
  if (errProd) throw errProd;

  if (!producoes || producoes.length === 0) {
    return { producoes: [] };
  }

  const producaoIds = producoes.map((p) => p.id as string);
  const versaoIds = [...new Set(producoes.map((p) => p.versao_receita_id as string))];

  // Etapas de todas as producoes (ordenadas por producao, ordem)
  const { data: etapas, error: errEt } = await supabase
    .from('etapas_producao')
    .select(
      'id, producao_id, ordem, tipo, status, iniciada_at, concluida_at, dobra_numero, temp_c, detalhes, notas'
    )
    .in('producao_id', producaoIds)
    .order('producao_id', { ascending: true })
    .order('ordem', { ascending: true });
  if (errEt) throw errEt;

  // Nome/grupo/rascunho via versoes_receita -> receitas -> produtos
  const { data: versoes } = await supabase
    .from('versoes_receita')
    .select('id, receita_id, status')
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

  const versaoById = new Map((versoes ?? []).map((v) => [v.id as string, v]));
  const receitaById = new Map((receitas ?? []).map((r) => [r.id as string, r]));
  const produtoById = new Map((produtos ?? []).map((p) => [p.id as string, p]));

  // Etapas por producao
  const etapasPorProducao = new Map<string, EtapaAcomp[]>();
  for (const e of etapas ?? []) {
    const pid = e.producao_id as string;
    const arr = etapasPorProducao.get(pid) ?? [];
    arr.push({
      id: e.id as string,
      ordem: e.ordem as number,
      tipo: e.tipo,
      status: e.status,
      iniciadaAt: e.iniciada_at ?? null,
      concluidaAt: e.concluida_at ?? null,
      dobraNumero: e.dobra_numero ?? null,
      tempC: e.temp_c ?? null,
      detalhes: (e.detalhes as Record<string, unknown> | null) ?? {},
      notas: e.notas ?? null,
    });
    etapasPorProducao.set(pid, arr);
  }

  const lista: ProducaoAcomp[] = producoes.map((p): ProducaoAcomp => {
    const versao = versaoById.get(p.versao_receita_id as string);
    const receita = versao ? receitaById.get(versao.receita_id as string) : null;
    const produto = receita ? produtoById.get(receita.produto_id as string) : null;
    const etapasP = etapasPorProducao.get(p.id as string) ?? [];
    const { feitas, total } = progressoEtapas(etapasP);

    return {
      id: p.id as string,
      versaoReceitaId: p.versao_receita_id as string,
      nome: (produto?.nome as string) ?? 'Receita',
      grupo: receita?.grupo_sugerido ?? null,
      rascunho: versao?.status === 'rascunho',
      status: p.status,
      iniciadaAt: p.iniciada_at ?? null,
      concluidaAt: p.concluida_at ?? null,
      qtyPrevista: p.qty_paes_prevista ?? null,
      etapas: etapasP,
      etapaAgoraId: derivaEtapaAgora(etapasP),
      feitas,
      total,
    };
  });

  // Ordena por grupo, depois nome (mesmo criterio das fichas)
  lista.sort(
    (a, b) => (a.grupo ?? 99) - (b.grupo ?? 99) || a.nome.localeCompare(b.nome)
  );

  return { producoes: lista };
}
