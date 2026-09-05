/**
 * Qual periodo a tela abre, e quais ela oferece.
 *
 * Fica fora do componente porque tem regra de calendario com borda, e borda de
 * calendario merece teste.
 */
import { dataSpStr } from '../../lib/date';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** 'AAAA-MM' de um mes deslocado, com aritmetica em UTC (nunca hora local). */
function desloca(periodo: string, meses: number): string {
  const [a, m] = periodo.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + meses, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Periodo que a tela abre.
 *
 * A previa de um mes e montada no dia 26 do mes anterior e conferida ate o dia
 * 28. Entao ate o dia 28 o "proximo ciclo" e o mes que vem; passado o 28, aquele
 * ciclo ja foi conferido e o proximo a montar e o seguinte.
 *
 * O DIA VEM DO CALENDARIO DE SAO PAULO, nao do relogio da maquina nem de UTC.
 * `new Date().getDate()` daria o dia do fuso de quem abriu a tela, e `getUTCDate()`
 * viraria o mes cedo demais: dia 28 as 21h em Sao Paulo ja e dia 29 em UTC, e a
 * tela abriria o mes errado justo no ultimo dia da conferencia. `dataSpStr`
 * resolve os dois casos porque fixa o fuso da padaria. A aritmetica de mes
 * continua em UTC, como no previa.ts.
 */
export function periodoPadrao(agora: Date): string {
  const [ano, mes, dia] = dataSpStr(agora).split('-').map(Number);
  const avanco = dia > 28 ? 2 : 1;
  return desloca(`${ano}-${String(mes).padStart(2, '0')}`, avanco);
}

/** Alguns meses em volta do padrao, pra conferir um ciclo passado sem digitar. */
export function opcoesDePeriodo(padrao: string): string[] {
  const out: string[] = [];
  for (let delta = -3; delta <= 1; delta++) out.push(desloca(padrao, delta));
  return out;
}

/** 'outubro de 2026'. */
export function rotuloPeriodo(periodo: string): string {
  const [a, m] = periodo.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}
