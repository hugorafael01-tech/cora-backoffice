import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ItemEntrega, EntregaLite, StatusEntrega } from '../lib/expedicao';
import type { DadosExpedicao } from '../pages/Expedicao/types';

export interface UseExpedicaoResult {
  dados: DadosExpedicao | null;
  loading: boolean;
  error: Error | null;
  naoEncontrada: boolean;
  refetch: () => void;
}

/** Itens persistidos (Json) -> ItemEntrega[] defensivo. */
function parseItens(itens: unknown): ItemEntrega[] {
  if (!Array.isArray(itens)) return [];
  return (itens as Array<Record<string, unknown>>)
    .map((i) => ({
      slug: String(i?.slug ?? ''),
      nome: String(i?.nome ?? i?.slug ?? ''),
      qty: Number(i?.qty) || 0,
    }))
    .filter((i) => i.slug);
}

export function useExpedicao(id: string | undefined): UseExpedicaoResult {
  const [dados, setDados] = useState<DadosExpedicao | null>(null);
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
          .select('id, numero, data_inicio, data_entrega')
          .eq('id', semanaId)
          .single();

        if (errSemana || !semana) {
          if (!cancelado) {
            setNaoEncontrada(true);
            setLoading(false);
          }
          return;
        }

        const { data: rows, error: errEntregas } = await supabase
          .from('entregas')
          .select(
            'id, nome, whatsapp, cep, rua, numero, complemento, bairro, cidade, regiao, itens, observacao, status, em_rota_at, entregue_at'
          )
          .eq('semana_id', semanaId);
        if (errEntregas) throw errEntregas;

        const entregas: EntregaLite[] = (rows ?? []).map((r) => ({
          id: r.id as string,
          nome: r.nome as string,
          whatsapp: (r.whatsapp as string | null) ?? null,
          cep: (r.cep as string | null) ?? null,
          rua: r.rua as string,
          numero: (r.numero as string | null) ?? null,
          complemento: (r.complemento as string | null) ?? null,
          bairro: r.bairro as string,
          cidade: r.cidade as string,
          regiao: r.regiao as string,
          itens: parseItens(r.itens),
          observacao: (r.observacao as string | null) ?? null,
          status: r.status as StatusEntrega,
          emRotaAt: (r.em_rota_at as string | null) ?? null,
          entregueAt: (r.entregue_at as string | null) ?? null,
        }));

        if (cancelado) return;
        setDados({ semana, entregas });
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
