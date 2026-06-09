import type { EtapaAcomp, EtapaStatus, EtapaTipo, ProducaoStatus } from '../pages/Producao/types';

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

  const farinhaPorPao = farinhaPorPaoG(pesoMassaG, somaBaker);

  const levainKg =
    farinhaPorPao == null || levainPct == null
      ? null
      : round3((qty * farinhaPorPao * levainPct) / 1000);

  return { massaKg, levainKg };
}

/**
 * Farinha (g) por pao = peso_massa_g / soma_baker. Mesma formula e guard da
 * funcao peso_farinha_por_pao() no banco: soma_baker == 0 OU peso nulo -> null
 * (pao novo de teste sem ingredientes). Usado pela ficha pra derivar g/pao de
 * cada ingrediente (farinha x baker%) sem chamar a rpc.
 */
export function farinhaPorPaoG(pesoMassaG: number | null, somaBaker: number): number | null {
  return somaBaker > 0 && pesoMassaG != null ? pesoMassaG / somaBaker : null;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
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

// ---- Acompanhamento (Estado B / fatia B1) — helpers puros ----

const ETAPA_TIPO_LABEL: Record<EtapaTipo, string> = {
  autolise_mistura: 'Autolise + mistura',
  batimento: 'Batimento',
  falsa_dobra: 'Falsa dobra',
  dobra: 'Dobras',
  pre_shape: 'Pre-shape',
  shape: 'Shape',
  descanso: 'Descanso',
  fermentacao_final: 'Fermentacao final',
  coccao: 'Coccao',
};

/** Rotulo legivel do tipo de etapa (etapa_tipo_enum). */
export function etapaTipoLabel(tipo: EtapaTipo): string {
  return ETAPA_TIPO_LABEL[tipo] ?? tipo;
}

const PRODUCAO_STATUS_LABEL: Record<ProducaoStatus, string> = {
  planejada: 'Planejada',
  em_curso: 'Em curso',
  concluida: 'Concluida',
  cancelada: 'Cancelada',
};

/** Rotulo legivel do status da producao (producao_status_enum). */
export function producaoStatusLabel(status: ProducaoStatus): string {
  return PRODUCAO_STATUS_LABEL[status] ?? status;
}

const RESOLVIDA: ReadonlySet<EtapaStatus> = new Set<EtapaStatus>(['concluida', 'pulada']);

/**
 * Etapa "agora": a em_curso de MENOR ordem; se nenhuma estiver em curso, a
 * primeira aguardando (menor ordem). Null se todas resolvidas (concluida/pulada).
 * Nao assume etapas ja ordenadas.
 */
export function derivaEtapaAgora(etapas: EtapaAcomp[]): string | null {
  const emCurso = etapas
    .filter((e) => e.status === 'em_curso')
    .sort((a, b) => a.ordem - b.ordem);
  if (emCurso.length > 0) return emCurso[0].id;

  const aguardando = etapas
    .filter((e) => e.status === 'aguardando')
    .sort((a, b) => a.ordem - b.ordem);
  return aguardando.length > 0 ? aguardando[0].id : null;
}

/** Progresso "N/M etapas": feitas = resolvidas (concluida + pulada). */
export function progressoEtapas(etapas: EtapaAcomp[]): { feitas: number; total: number } {
  let feitas = 0;
  for (const e of etapas) if (RESOLVIDA.has(e.status)) feitas++;
  return { feitas, total: etapas.length };
}

/**
 * Etapa onde a massa e dividida em pecas (peso da peca = peso_massa_g, cru).
 * Pao Original: a divisao e o 'Descanso e divisao' (passo 5, tipo 'pre_shape'),
 * NAO o 'Shape' (passo 6). Na ficha da pra casar tambem por nome; no
 * Acompanhamento (EtapaAcomp sem nome) so por tipo.
 */
export function ehEtapaDivisao(tipo: EtapaTipo | string | null, nome?: string | null): boolean {
  return tipo === 'pre_shape' || (nome != null && /divis/i.test(nome));
}

/** Subtexto do tamanho da peca na etapa de divisao: "pecas de ~283 g". */
export function fmtPecaDivisao(pesoMassaG: number | null): string | null {
  if (pesoMassaG == null) return null;
  return `pecas de ~${fmtG(pesoMassaG)}`;
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
