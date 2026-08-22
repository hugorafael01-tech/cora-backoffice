import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type TipoCardapio = Database['public']['Enums']['tipo_cardapio_enum'];
type StatusSemana = Database['public']['Tables']['semanas']['Row']['status'];

export interface ProdutoCardapio {
  id: string;
  slug: string;
  nome: string;
  preco_avulso: number;
  tipo_cardapio: TipoCardapio;
}

export interface UseSemanaCardapioResult {
  baseFixos: ProdutoCardapio[];
  rotativos: ProdutoCardapio[];
  jaNoBanco: Set<string>; // produto_ids ja em cardapios (rotativos E base/fixos)
  /**
   * Preco CONGELADO por produto_id, pra quem ja esta em `cardapios`.
   *
   * Nao e o mesmo numero de `ProdutoCardapio.preco_avulso`, que vem de
   * `produtos` e e o preco de HOJE. `cardapios` guarda o preco do momento da
   * insercao e nao acompanha mudanca posterior no produto — de proposito, e
   * preco historico. Desde que o portal passou a exibir o preco do banco, esse
   * e o numero que o assinante paga, entao a tela mostra ele, e nao o do
   * produto.
   */
  precoCongelado: Map<string, number>;
  destaqueNoBanco: string | null; // produto_id do destaque, ou null
  statusSemana: StatusSemana | null;
  loading: boolean;
  error: Error | null;
}

export function useSemanaCardapio(semanaId: string | undefined): UseSemanaCardapioResult {
  const [baseFixos, setBaseFixos] = useState<ProdutoCardapio[]>([]);
  const [rotativos, setRotativos] = useState<ProdutoCardapio[]>([]);
  const [jaNoBanco, setJaNoBanco] = useState<Set<string>>(new Set());
  const [precoCongelado, setPrecoCongelado] = useState<Map<string, number>>(new Map());
  const [destaqueNoBanco, setDestaqueNoBanco] = useState<string | null>(null);
  const [statusSemana, setStatusSemana] = useState<StatusSemana | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!semanaId) return;
    let cancelado = false;

    // Sem setState sincrono no corpo do efeito: todos vem depois do 1o await.
    async function carregar(id: string) {
      try {
        const { data: produtos, error: errProd } = await supabase
          .from('produtos')
          .select('id, slug, nome, preco_avulso, tipo_cardapio')
          .eq('ativo', true)
          .not('preco_avulso', 'is', null)
          .order('nome');
        if (cancelado) return;
        if (errProd) throw errProd;

        const { data: cardapioAtual, error: errCard } = await supabase
          .from('cardapios')
          .select('produto_id, preco_avulso, destaque')
          .eq('semana_id', id);
        if (cancelado) return;
        if (errCard) throw errCard;

        // O status decide se "Publicar" vai congelar a semana — e e o congelar
        // que dispara o aviso de semana sem destaque.
        const { data: semana, error: errSem } = await supabase
          .from('semanas')
          .select('status')
          .eq('id', id)
          .maybeSingle();
        if (cancelado) return;
        if (errSem) throw errSem;

        const lista = (produtos ?? []).filter(
          (p): p is ProdutoCardapio => p.preco_avulso != null && p.tipo_cardapio != null
        );

        setBaseFixos(lista.filter((p) => p.tipo_cardapio === 'base' || p.tipo_cardapio === 'fixo'));
        setRotativos(lista.filter((p) => p.tipo_cardapio === 'rotativo'));

        const linhas = cardapioAtual ?? [];
        setJaNoBanco(new Set(linhas.map((c) => c.produto_id as string)));
        // `preco_avulso` e numeric no Postgres e chega como string no
        // supabase-js. Number() aqui pra tela nao formatar "30.00" como texto.
        setPrecoCongelado(
          new Map(
            linhas
              .map((c) => [c.produto_id as string, Number(c.preco_avulso)] as const)
              .filter(([, preco]) => Number.isFinite(preco))
          )
        );
        setDestaqueNoBanco(linhas.find((c) => c.destaque)?.produto_id ?? null);
        setStatusSemana(semana?.status ?? null);
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    carregar(semanaId);
    return () => {
      cancelado = true;
    };
  }, [semanaId]);

  return {
    baseFixos,
    rotativos,
    jaNoBanco,
    precoCongelado,
    destaqueNoBanco,
    statusSemana,
    loading,
    error,
  };
}
