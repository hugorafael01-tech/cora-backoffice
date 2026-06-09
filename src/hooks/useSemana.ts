import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { normalize } from '../lib/normalize';
import { derivaEstado, etapaAgora } from '../lib/semana';
import type { EtapaAgora, ProducaoComEtapas } from '../lib/semana';
import type {
  DadosSemana,
  LinhaProducao,
  InsumoAlerta,
  CidadeEntregas,
  BairroAgregado,
  Semana,
} from '../pages/Semana/types';

export interface UseSemanaResult {
  dados: DadosSemana | null;
  loading: boolean;
  error: Error | null;
  naoEncontrada: boolean;
  refetch: () => void;
}

export function useSemana(id: string | undefined): UseSemanaResult {
  const [dados, setDados] = useState<DadosSemana | null>(null);
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
        // Q1 — semana
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

        // Q2 — vizinhanca (nav)
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

        const planejamento = await carregarPlanejamento(semanaId);
        const insumos = await carregarInsumos();
        const entregas = await carregarEntregas(semana.data_entrega);
        // Sempre carrega (sem gate de estado): a funcao e escopada por semana e
        // devolve Map vazio sem producoes, entao o estado A cai em 'aguardando'.
        // Sem o gate, a Semana reflete producao em curso fora do Estado B.
        const etapasAgora = await carregarEtapasAgora(semanaId);

        if (cancelado) return;
        setDados({
          semana: semana as Semana,
          estado,
          planejamento,
          insumos,
          entregas,
          etapasAgora,
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

// ---- Q3: producoes reais da semana (volume + tabela) ----
// Fonte = `producoes` (nao a view de demanda `planejamento_semana`, que fica
// vazia sem assinante). Inclui origem='teste': Hugo quer ver paes de teste no
// volume da Semana. Massa/levain vem do previsto gravado pelo trigger (0021),
// nao mais da heuristica LEVAIN_PCT. Join versao->receita->produto em queries
// separadas (mesmo padrao de carregarEtapasAgora; evita ambiguidade das 2 FKs
// receitas<->versoes_receita). Agrega por slug (variacao = nova versao do mesmo
// produto -> mesmo slug) pra casar com o overlay etapasAgora.
async function carregarPlanejamento(semanaId: string): Promise<LinhaProducao[]> {
  const { data: producoes } = await supabase
    .from('producoes')
    .select(
      'id, versao_receita_id, qty_paes_prevista, massa_prevista_kg, levain_previsto_kg, status, origem'
    )
    .eq('semana_id', semanaId);

  if (!producoes || producoes.length === 0) return [];

  const versaoIds = producoes
    .map((p) => p.versao_receita_id as string)
    .filter((v): v is string => v != null);

  const { data: versoes } = await supabase
    .from('versoes_receita')
    .select('id, receita_id')
    .in('id', versaoIds.length ? versaoIds : ['00000000-0000-0000-0000-000000000000']);

  const receitaIds = (versoes ?? []).map((v) => v.receita_id as string);
  const { data: receitas } = await supabase
    .from('receitas')
    .select('id, produto_id, grupo_sugerido')
    .in('id', receitaIds.length ? receitaIds : ['00000000-0000-0000-0000-000000000000']);

  const produtoIds = (receitas ?? []).map((r) => r.produto_id as string);
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, slug, nome, formato')
    .in('id', produtoIds.length ? produtoIds : ['00000000-0000-0000-0000-000000000000']);

  const receitaById = new Map((receitas ?? []).map((r) => [r.id as string, r]));
  const produtoById = new Map((produtos ?? []).map((p) => [p.id as string, p]));

  interface MetaProduto {
    slug: string;
    nome: string;
    formato: string | null;
    grupo: number | null;
  }
  const versaoToProduto = new Map<string, MetaProduto>();
  for (const v of versoes ?? []) {
    const receita = receitaById.get(v.receita_id as string);
    const produto = receita ? produtoById.get(receita.produto_id as string) : null;
    if (produto?.slug) {
      versaoToProduto.set(v.id as string, {
        slug: produto.slug as string,
        nome: produto.nome as string,
        formato: (produto.formato as string | null) ?? null,
        grupo: receita?.grupo_sugerido ?? null,
      });
    }
  }

  const porSlug = new Map<string, LinhaProducao>();
  for (const p of producoes) {
    const meta = p.versao_receita_id ? versaoToProduto.get(p.versao_receita_id as string) : null;
    if (!meta) continue;
    const qty = p.qty_paes_prevista ?? 0;
    const massaG = (Number(p.massa_prevista_kg) || 0) * 1000;
    const levainG = (Number(p.levain_previsto_kg) || 0) * 1000;

    const ja = porSlug.get(meta.slug);
    if (ja) {
      ja.qty += qty;
      ja.qtyBase += qty;
      ja.massaTotalG += massaG;
      ja.levainG += levainG;
    } else {
      porSlug.set(meta.slug, {
        slug: meta.slug,
        nome: meta.nome,
        formato: meta.formato,
        grupo: meta.grupo,
        qty,
        qtyBase: qty, // producoes nao tem decomposicao de demanda (base/pontual)
        qtyPontual: 0,
        massaTotalG: massaG,
        levainG,
      });
    }
  }

  // Arredonda o levain so no fim (evita acumular erro de arredondamento na soma).
  return [...porSlug.values()]
    .map((l) => ({ ...l, levainG: Math.round(l.levainG) }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

// ---- Q4: insumos ----
async function carregarInsumos(): Promise<{ alertas: InsumoAlerta[]; okCount: number }> {
  const { data: insumos } = await supabase
    .from('ingredientes')
    .select('slug, nome, unidade, quantidade_atual_g, quantidade_minima_g')
    .order('nome');

  const lista = insumos ?? [];
  const alertas: InsumoAlerta[] = [];
  for (const i of lista) {
    const atual = i.quantidade_atual_g;
    const minimo = i.quantidade_minima_g;
    if (atual == null || minimo == null) continue;
    if (minimo <= 0) continue; // sem minimo definido = sem alerta
    if (atual < minimo) {
      alertas.push({
        slug: i.slug as string,
        nome: i.nome as string,
        unidade: (i.unidade as string) ?? 'g',
        atual,
        minimo,
        crit: atual === 0,
      });
    }
  }
  return { alertas, okCount: lista.length - alertas.length };
}

// ---- Q5: entregas por bairro ----
async function carregarEntregas(
  dataEntrega: string
): Promise<{ cidades: CidadeEntregas[]; totalGeral: number }> {
  const { data: ordens } = await supabase
    .from('weekly_orders')
    .select('subscriptions!inner ( cidade, bairro )')
    .eq('status', 'confirmado')
    .eq('delivery_date', dataEntrega);

  const { data: bairrosAtendidos } = await supabase
    .from('bairros_atendidos')
    .select('cidade, bairro')
    .eq('ativo', true);

  // Grafia oficial da whitelist por chave normalizada
  const grafiaOficial = new Map<string, { cidade: string; bairro: string }>();
  for (const b of bairrosAtendidos ?? []) {
    const key = `${normalize(b.cidade)}|${normalize(b.bairro)}`;
    grafiaOficial.set(key, { cidade: b.cidade as string, bairro: b.bairro as string });
  }
  const whitelist = new Set(grafiaOficial.keys());

  type Acc = { cidade: string; bairro: string; count: number };
  const contagem = new Map<string, Acc>();
  let totalGeral = 0;

  for (const o of ordens ?? []) {
    // subscriptions embedded vem como objeto (FK !inner)
    const sub = (o as { subscriptions: { cidade: string | null; bairro: string | null } })
      .subscriptions;
    if (!sub) continue;
    const cidade = sub.cidade ?? '(sem cidade)';
    const bairro = sub.bairro ?? '(sem bairro)';
    const key = `${normalize(cidade)}|${normalize(bairro)}`;
    totalGeral++;
    const ja = contagem.get(key);
    if (ja) {
      ja.count++;
    } else {
      const display = grafiaOficial.get(key) ?? { cidade, bairro };
      contagem.set(key, { ...display, count: 1 });
    }
  }

  const porCidade = new Map<string, BairroAgregado[]>();
  for (const { cidade, bairro, count } of contagem.values()) {
    const key = `${normalize(cidade)}|${normalize(bairro)}`;
    const arr = porCidade.get(cidade) ?? [];
    arr.push({ nome: bairro, count, foraDaLista: !whitelist.has(key) });
    porCidade.set(cidade, arr);
  }

  const cidades: CidadeEntregas[] = [...porCidade.entries()]
    .map(([nome, bairros]) => ({
      nome,
      bairros: bairros.sort((a, b) => a.nome.localeCompare(b.nome)),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return { cidades, totalGeral };
}

// ---- Q6: etapa agora (so Estado B) ----
// Resolucao versao_receita_id -> produto.slug via queries separadas pra evitar
// ambiguidade de FK (receitas <-> versoes_receita tem 2 FKs). Volume minimo.
// Sempre vazio ate a Etapa 2 popular producoes/etapas_producao.
async function carregarEtapasAgora(semanaId: string): Promise<Map<string, EtapaAgora>> {
  const { data: producoes } = await supabase
    .from('producoes')
    .select(
      `
      versao_receita_id,
      status,
      etapas_producao (
        ordem,
        dobra_numero,
        iniciada_at,
        concluida_at,
        etapas_receita ( nome )
      )
    `
    )
    .eq('semana_id', semanaId);

  if (!producoes || producoes.length === 0) return new Map();

  const versaoIds = producoes
    .map((p) => p.versao_receita_id as string)
    .filter((v): v is string => v != null);

  const { data: versoes } = await supabase
    .from('versoes_receita')
    .select('id, receita_id')
    .in('id', versaoIds.length ? versaoIds : ['00000000-0000-0000-0000-000000000000']);

  const receitaIds = (versoes ?? []).map((v) => v.receita_id as string);
  const { data: receitas } = await supabase
    .from('receitas')
    .select('id, produto_id')
    .in('id', receitaIds.length ? receitaIds : ['00000000-0000-0000-0000-000000000000']);

  const produtoIds = (receitas ?? []).map((r) => r.produto_id as string);
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, slug')
    .in('id', produtoIds.length ? produtoIds : ['00000000-0000-0000-0000-000000000000']);

  const receitaById = new Map((receitas ?? []).map((r) => [r.id as string, r]));
  const produtoById = new Map((produtos ?? []).map((p) => [p.id as string, p]));
  const versaoToSlug = new Map<string, string>();
  for (const v of versoes ?? []) {
    const receita = receitaById.get(v.receita_id as string);
    const produto = receita ? produtoById.get(receita.produto_id as string) : null;
    if (produto?.slug) versaoToSlug.set(v.id as string, produto.slug as string);
  }

  const mapa = new Map<string, EtapaAgora>();
  for (const p of producoes) {
    const slug = p.versao_receita_id ? versaoToSlug.get(p.versao_receita_id as string) : null;
    if (!slug) continue;
    mapa.set(slug, etapaAgora(p as unknown as ProducaoComEtapas));
  }
  return mapa;
}
