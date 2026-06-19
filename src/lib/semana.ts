import type { Database } from './database.types';
import { dataSpStr, formataDiaSemanaDiaMes, formataHa } from './date';

type Semana = Database['public']['Tables']['semanas']['Row'];

export type EstadoSemana = 'rascunho' | 'A' | 'B' | 'C';

/**
 * Deriva o estado de exibicao a partir da semana e do "agora".
 *
 * - status='rascunho' -> 'rascunho' (banner amarelo, render como A)
 * - status='concluida' -> 'C' (retrospectivo)
 * - status in ('aberta','congelada'):
 *     agora < data_corte -> 'A' (previsao com ~)
 *     data_corte <= agora <= fim do dia de data_entrega -> 'B' (definitivo)
 *     agora > data_entrega -> 'C' (delta realizado)
 *
 * Timezone: A/B usa o instante exato de data_corte (timestamptz);
 * B/C compara a data calendario em America/Sao_Paulo contra data_entrega.
 */
export function derivaEstado(semana: Pick<Semana, 'status' | 'data_corte' | 'data_entrega'>, agora: Date = new Date()): EstadoSemana {
  if (semana.status === 'rascunho') return 'rascunho';
  if (semana.status === 'concluida') return 'C';

  const corte = new Date(semana.data_corte);
  if (agora < corte) return 'A';

  // Pos-corte: ainda 'B' enquanto a data de hoje (SP) nao passar a entrega.
  if (dataSpStr(agora) <= semana.data_entrega) return 'B';
  return 'C';
}

export interface EtapaAgora {
  label: string;
  ha: string | null;
  tom: 'brand' | 'warm' | 'mute';
}

interface EtapaProducaoLite {
  iniciada_at: string | null;
  concluida_at: string | null;
  ordem: number;
  dobra_numero: number | null;
  // nome vem do join com etapas_receita (etapas_producao nao tem coluna nome)
  etapas_receita: { nome: string } | null;
}

export interface ProducaoComEtapas {
  status: string;
  etapas_producao: EtapaProducaoLite[];
}

const DUAS_HORAS_MS = 2 * 60 * 60 * 1000;

/**
 * Etapa "agora" de uma producao da semana (coluna do Estado B).
 *
 * - etapa com iniciada_at, sem concluida_at, iniciada_at > now - 2h -> mostra
 *   o nome (de etapas_receita), com "ha X min".
 * - producao 'em_curso' sem etapa recente -> 'em producao' (generico).
 * - producao 'concluida' -> 'concluída'.
 * - sem producao ou demais status (planejada etc.) -> 'aguardando'.
 *
 * Ate a Etapa 2 popular etapas_producao, sempre retorna 'aguardando'.
 */
export function etapaAgora(
  producao: ProducaoComEtapas | null | undefined,
  agora: Date = new Date()
): EtapaAgora {
  if (!producao) return { label: 'aguardando', ha: null, tom: 'mute' };
  if (producao.status === 'concluida') return { label: 'concluída', ha: null, tom: 'mute' };
  if (producao.status !== 'em_curso') return { label: 'aguardando', ha: null, tom: 'mute' };

  const recente = producao.etapas_producao
    .filter((e) => e.concluida_at == null && e.iniciada_at != null)
    .filter((e) => agora.getTime() - new Date(e.iniciada_at as string).getTime() < DUAS_HORAS_MS)
    .sort((a, b) => (b.iniciada_at as string).localeCompare(a.iniciada_at as string))[0];

  if (recente) {
    const minutos = Math.floor(
      (agora.getTime() - new Date(recente.iniciada_at as string).getTime()) / 60000
    );
    const base = recente.etapas_receita?.nome ?? 'etapa';
    const label = recente.dobra_numero != null ? `${base} ${recente.dobra_numero}` : base;
    return { label, ha: formataHa(minutos), tom: 'brand' };
  }

  return { label: 'em produção', ha: null, tom: 'warm' };
}

/** Mapeia grupo_sugerido (smallint 1-3) -> rotulo "G1"/"G2"/"G3". */
export function grupoLabel(grupo: number | null | undefined): string {
  return grupo ? `G${grupo}` : '-';
}

// ---- Resolucao da "semana atual" (compartilhada por Semana e Producao) ----

export interface SemanaLite {
  id: string;
  data_entrega: string;
  data_corte: string;
}

const DIA_MS = 86_400_000;

function ymdLocal(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Identidade exibida do ciclo: "Ciclo · entrega qua 10 jun". */
export function cicloLabel(dataEntrega: string): string {
  return `Ciclo · entrega ${formataDiaSemanaDiaMes(dataEntrega)}`;
}

export interface CicloLite {
  id: string;
  data_entrega: string;
  status: string;
}

/**
 * Ciclo "atual" do modulo Producao: entre os ABERTOS (nao cancelado/encerrado),
 * o de entrega mais proxima a partir de hoje (>= hoje); se nenhum no futuro, o de
 * entrega mais recente. Sem ciclos abertos, cai no conjunto inteiro. Compara
 * datas YYYY-MM-DD lexicograficamente (hoje = data SP).
 */
export function escolherCicloAtual(ciclos: CicloLite[], hojeYmd: string): string | null {
  const abertos = ciclos.filter((c) => c.status !== 'cancelada' && c.status !== 'concluida');
  const fonte = abertos.length > 0 ? abertos : ciclos;
  if (fonte.length === 0) return null;

  const proximos = fonte
    .filter((c) => c.data_entrega >= hojeYmd)
    .sort((a, b) => a.data_entrega.localeCompare(b.data_entrega));
  if (proximos[0]) return proximos[0].id;

  const recentes = [...fonte].sort((a, b) => b.data_entrega.localeCompare(a.data_entrega));
  return recentes[0].id;
}

/** Escolhe a semana "atual" por prioridade (briefing v3 §10). */
export function escolherAtual(semanas: SemanaLite[], agora: number): string | null {
  // 1. viva: corte <= agora <= entrega + 3 dias
  const viva = semanas.find((s) => {
    const corte = new Date(s.data_corte).getTime();
    const limite = ymdLocal(s.data_entrega) + 3 * DIA_MS;
    return corte <= agora && agora <= limite;
  });
  if (viva) return viva.id;

  // 2. proxima futura (menor data_entrega >= hoje)
  const futuras = semanas
    .filter((s) => ymdLocal(s.data_entrega) >= agora - DIA_MS)
    .sort((a, b) => a.data_entrega.localeCompare(b.data_entrega));
  if (futuras[0]) return futuras[0].id;

  // 3. mais recente passada
  const passadas = [...semanas].sort((a, b) => b.data_entrega.localeCompare(a.data_entrega));
  return passadas[0]?.id ?? null;
}
