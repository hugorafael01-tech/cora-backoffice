import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ItemEntrega, EntregaLite, StatusEntrega } from '../lib/expedicao';
import {
  indexaOrdemBairros,
  indexaZonas,
  type BairroZonaDefault,
  type FormaZona,
  type Onda,
  type Zona,
} from '../lib/zonas';
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

/** Linhas de `zonas_entrega` -> Zona[] (so as ativas entram na tela). */
function parseZonas(rows: Array<Record<string, unknown>> | null): Zona[] {
  return (rows ?? [])
    .filter((r) => r.ativo !== false)
    .map((r) => ({
      codigo: String(r.codigo ?? ''),
      nome: String(r.nome ?? ''),
      cidade: String(r.cidade ?? ''),
      onda: (r.onda === 'niteroi' ? 'niteroi' : 'rio') as Onda,
      ordem: Number(r.ordem) || 0,
      corHex: String(r.cor_hex ?? '#000000'),
      forma: (r.forma as FormaZona) ?? 'circulo',
      entraNaOnda: r.entra_na_onda !== false,
      ativo: r.ativo !== false,
    }));
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
            'id, nome, whatsapp, cep, rua, numero, complemento, bairro, cidade, regiao, zona, sequencia, ordem_rota, itens, observacao, status, em_rota_at, entregue_at'
          )
          .eq('semana_id', semanaId);
        if (errEntregas) throw errEntregas;

        // Cadastro das zonas (cor/forma/ordem/onda), ordem dos bairros na rota e
        // capacidade da bag. Tudo leitura pura: zona e ordem_rota se editam no
        // cadastro do assinante e a capacidade em app_settings (o client so tem
        // SELECT nela).
        const [
          { data: zonasRows, error: errZonas },
          { data: bairrosRows, error: errBairros },
          { data: settings },
        ] = await Promise.all([
          supabase
            .from('zonas_entrega')
            .select('codigo, nome, cidade, onda, ordem, cor_hex, forma, entra_na_onda, ativo')
            .order('onda')
            .order('ordem'),
          supabase.from('bairro_zona_default').select('cidade, bairro, zona, ordem'),
          supabase.from('app_settings').select('capacidade_bag').eq('id', 1).maybeSingle(),
        ]);
        if (errZonas) throw errZonas;
        if (errBairros) throw errBairros;

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
          zona: (r.zona as string | null) ?? null,
          sequencia: (r.sequencia as number | null) ?? null,
          ordemRota: (r.ordem_rota as number | null) ?? null,
          itens: parseItens(r.itens),
          observacao: (r.observacao as string | null) ?? null,
          status: r.status as StatusEntrega,
          emRotaAt: (r.em_rota_at as string | null) ?? null,
          entregueAt: (r.entregue_at as string | null) ?? null,
        }));

        if (cancelado) return;
        const zonas = parseZonas(zonasRows as Array<Record<string, unknown>> | null);
        const bairros: BairroZonaDefault[] = (bairrosRows ?? []).map((b) => ({
          cidade: b.cidade as string,
          bairro: b.bairro as string,
          zona: b.zona as string,
          ordem: Number(b.ordem) || 0,
        }));
        setDados({
          semana,
          entregas,
          zonas,
          bairros,
          ordem: { zonas: indexaZonas(zonas), bairros: indexaOrdemBairros(bairros) },
          capacidadeBag: (settings?.capacidade_bag as number | null) ?? null,
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
