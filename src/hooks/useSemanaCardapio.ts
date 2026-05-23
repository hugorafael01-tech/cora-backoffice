import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type TipoCardapio = Database['public']['Enums']['tipo_cardapio_enum'];

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
  jaNoBanco: Set<string>; // produto_ids rotativos ja em cardapios
  loading: boolean;
  error: Error | null;
}

export function useSemanaCardapio(semanaId: string | undefined): UseSemanaCardapioResult {
  const [baseFixos, setBaseFixos] = useState<ProdutoCardapio[]>([]);
  const [rotativos, setRotativos] = useState<ProdutoCardapio[]>([]);
  const [jaNoBanco, setJaNoBanco] = useState<Set<string>>(new Set());
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
          .select('produto_id')
          .eq('semana_id', id);
        if (cancelado) return;
        if (errCard) throw errCard;

        const lista = (produtos ?? []).filter(
          (p): p is ProdutoCardapio => p.preco_avulso != null && p.tipo_cardapio != null
        );

        setBaseFixos(lista.filter((p) => p.tipo_cardapio === 'base' || p.tipo_cardapio === 'fixo'));
        setRotativos(lista.filter((p) => p.tipo_cardapio === 'rotativo'));
        setJaNoBanco(new Set((cardapioAtual ?? []).map((c) => c.produto_id as string)));
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

  return { baseFixos, rotativos, jaNoBanco, loading, error };
}
