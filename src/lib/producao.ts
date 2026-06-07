import { formataDiaMes } from './date';

/**
 * Helpers puros da fatia 1 de Producao ("Definir volume").
 *
 * IMPORTANTE: a FONTE DA VERDADE de massa_prevista_kg / levain_previsto_kg e o
 * trigger producoes_set_prevista() no banco (migration 0021). As funcoes daqui
 * apenas ESPELHAM essa formula pro preview ao vivo da tela. Qualquer divergencia
 * deve ser resolvida a favor do banco.
 */

const PARTES_TOTAL = 5; // perfil liquido 1:2:2 -> isca 1 + agua 2 + farinha 2

export interface LevainBuild {
  isca: number;
  agua: number;
  farinha: number;
  total: number;
}

/**
 * Calculadora de build do levain. Perfil padrao liquido 1:2:2
 * (isca : agua : farinha). Voce precisa produzir (meta + sobra) no total;
 * cada parte = total / 5.
 */
export function calcLevainBuild(metaG: number, sobraG: number): LevainBuild {
  const total = Math.max(0, metaG) + Math.max(0, sobraG);
  return {
    isca: total / PARTES_TOTAL,
    agua: (2 * total) / PARTES_TOTAL,
    farinha: (2 * total) / PARTES_TOTAL,
    total,
  };
}

export interface PreviewLinha {
  massaKg: number | null;
  levainKg: number | null;
}

/**
 * Espelha o trigger producoes_set_prevista() (0021):
 *   massa  = qty x peso_massa_g
 *   farinha/pao = peso_massa_g / soma_baker      (peso_farinha_por_pao())
 *   levain = qty x farinha/pao x baker%_levain
 *
 * Guards identicos ao banco:
 * - peso_massa_g nulo            -> massa = null
 * - soma_baker == 0 OU peso nulo -> farinha/pao = null -> levain = null
 *   (cobre o pao novo de teste, que nasce sem ingredientes)
 * - sem linha de levain (pct nulo) -> levain = null
 */
export function previewLinha(
  qty: number,
  pesoMassaG: number | null,
  somaBaker: number,
  levainPct: number | null
): PreviewLinha {
  const massaKg = pesoMassaG == null ? null : round3((qty * pesoMassaG) / 1000);

  const farinhaPorPao =
    somaBaker > 0 && pesoMassaG != null ? pesoMassaG / somaBaker : null;

  const levainKg =
    farinhaPorPao == null || levainPct == null
      ? null
      : round3((qty * farinhaPorPao * levainPct) / 1000);

  return { massaKg, levainKg };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface DiaSemana {
  sigla: string; // TER / QUA / QUI
  data: string; // "1 abr"
  descricao: string;
  futuro: boolean; // dia ainda nao chegou (cosmetico)
}

const SIGLAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

/** Soma `delta` dias a uma date string YYYY-MM-DD sem shift de timezone. */
function addDiasYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function siglaDe(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return SIGLAS[new Date(y, m - 1, d).getDay()];
}

/**
 * Os 3 dias do ciclo de producao a partir da entrega (quinta tipica):
 * entrega-2 (levain/prep), entrega-1 (autolise -> shape), entrega (coccao).
 * Apenas informativo no cabecalho da tela.
 */
export function diasDaSemana(dataEntrega: string, hoje: string): DiaSemana[] {
  const defs = [
    { delta: -2, descricao: 'Levain · prep · mise en place' },
    { delta: -1, descricao: 'Autolise -> dobras -> shape' },
    { delta: 0, descricao: 'Coccao · expedicao · entregas' },
  ];
  return defs.map(({ delta, descricao }) => {
    const ymd = addDiasYmd(dataEntrega, delta);
    return {
      sigla: siglaDe(ymd),
      data: formataDiaMes(ymd),
      descricao,
      futuro: ymd > hoje,
    };
  });
}

/** "12,3 kg" a partir de kg; null/0-guard exibe travessao. */
export function fmtKg(kg: number | null): string {
  if (kg == null) return '—';
  return `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
}

/** "1.250 g" arredondado a partir de gramas. */
export function fmtG(g: number): string {
  return `${Math.round(g).toLocaleString('pt-BR')} g`;
}

/** Slugifica nome de pao novo: sem acento, sem espaco, kebab. */
export function slugify(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
