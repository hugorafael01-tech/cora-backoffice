import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ContextoDia } from '../pages/Producao/types';

export interface UseContextosDiaResult {
  porDia: Map<number, ContextoDia> | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Carrega contextos_dia da semana -> Map por `dia` (D-index INT da 0024).
 * Padrao dos hooks do modulo (cancelado-on-unmount + refetch via tick). MANTEM o
 * map atual durante o refetch (nao reseta pra null), pra a aba Contexto nao
 * desmontar os blocos e perder edits em andamento dos outros dias.
 */
export function useContextosDia(semanaId: string | undefined): UseContextosDiaResult {
  const [porDia, setPorDia] = useState<Map<number, ContextoDia> | null>(null);
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
        const { data, error: err } = await supabase
          .from('contextos_dia')
          .select('id, dia, ultimo_refresh_levain_at, temp_ambiente_max_c, notas')
          .eq('semana_id', id);
        if (err) throw err;
        if (cancelado) return;

        const map = new Map<number, ContextoDia>();
        for (const r of data ?? []) {
          map.set(r.dia as number, {
            id: r.id as string,
            dia: r.dia as number,
            ultimoRefreshLevainAt: r.ultimo_refresh_levain_at ?? null,
            tempAmbienteMaxC: r.temp_ambiente_max_c ?? null,
            notas: r.notas ?? null,
          });
        }
        setPorDia(map);
        setLoading(false);
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

  return { porDia, loading, error, refetch };
}
