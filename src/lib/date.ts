import {
  addDays,
  startOfDay,
  getDay,
  getISOWeek,
  getISOWeekYear,
  format,
} from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export const TZ = 'America/Sao_Paulo';

export interface SemanaDerivada {
  numero: number;
  ano: number;
  data_inicio: string; // ISO date YYYY-MM-DD (segunda)
  data_fim: string; // ISO date YYYY-MM-DD (domingo)
  data_entrega: string; // ISO date YYYY-MM-DD (quinta)
  data_corte: string; // ISO timestamp com fuso (terca 12h BRT)
}

/**
 * Deriva os campos de uma semana a partir de data_entrega (quinta).
 *
 * Regras:
 * - data_corte = terca 12h00 (America/Sao_Paulo) da mesma semana ISO
 * - data_inicio = segunda da mesma semana ISO (quinta - 3)
 * - data_fim = domingo da mesma semana ISO (quinta + 3)
 * - numero = ISO week da data_entrega
 * - ano = ISO week year (NAO getFullYear: difere na virada de ano)
 *
 * data_corte e timestamptz; data_inicio/fim/entrega sao date (sem hora).
 * dataEntrega deve representar a meia-noite LOCAL da quinta (date picker).
 */
export function derivaSemana(dataEntrega: Date): SemanaDerivada {
  const segunda = addDays(dataEntrega, -3);
  const domingo = addDays(dataEntrega, 3);
  const terca = addDays(dataEntrega, -2);

  // terca 12h local SP -> instante UTC
  const tercaYmd = format(terca, 'yyyy-MM-dd');
  const dataCorte = fromZonedTime(`${tercaYmd}T12:00:00`, TZ);

  return {
    numero: getISOWeek(dataEntrega),
    ano: getISOWeekYear(dataEntrega),
    data_inicio: format(segunda, 'yyyy-MM-dd'),
    data_fim: format(domingo, 'yyyy-MM-dd'),
    data_entrega: format(dataEntrega, 'yyyy-MM-dd'),
    data_corte: dataCorte.toISOString(),
  };
}

/**
 * Proxima quinta a partir de hoje. Se hoje for quinta, retorna a proxima
 * quinta (nao hoje). Usado como default no date picker do modal de criacao.
 */
export function proximaQuinta(referencia: Date = new Date()): Date {
  const base = startOfDay(referencia);
  const QUINTA = 4; // 0=domingo
  let diff = (QUINTA - getDay(base) + 7) % 7;
  if (diff === 0) diff = 7;
  return addDays(base, diff);
}

/** Data calendario (YYYY-MM-DD) de um instante no fuso de Sao Paulo. */
export function dataSpStr(d: Date): string {
  return format(toZonedTime(d, TZ), 'yyyy-MM-dd');
}

const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

/** "25 mai" a partir de uma date string YYYY-MM-DD (sem timezone shift). */
export function formataDiaMes(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}

/** "qui 28 mai" a partir de uma date string YYYY-MM-DD. */
export function formataDiaSemanaDiaMes(ymd: string): string {
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${dias[dt.getDay()]} ${d} ${MESES[m - 1]}`;
}

/** "ha 12 min" / "ha 1h20" a partir de minutos decorridos. */
export function formataHa(minutos: number): string {
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `ha ${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `ha ${h}h` : `ha ${h}h${String(m).padStart(2, '0')}`;
}
