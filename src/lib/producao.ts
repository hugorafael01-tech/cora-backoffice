import { formataDiaSemanaDiaMes, formataHoraSp, ymdMenosDias } from './date';
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
 *   farinha/pao = peso_massa_g / soma_baker_DA_MASSA  (peso_farinha_por_pao())
 *   levain = qty x farinha/pao x baker%_levain
 *
 * Guards identicos ao banco:
 * - peso_massa_g nulo            -> massa = null
 * - soma_baker da massa == 0 OU peso nulo -> farinha/pao = null -> levain = null
 *
 * "da massa" = so as etapas de ETAPAS_DE_MASSA. Cobertura e crosta ficam fora
 * do denominador (0037): dividir peso de MASSA por uma soma que inclui
 * cobertura subestima a farinha. O baker de cada linha continua relativo a
 * farinha, entao com a farinha certa a cobertura sai certa junto.
 *   (cobre o pao novo de teste, que nasce sem ingredientes)
 * - sem linha de levain (pct nulo) -> levain = null
 */
export function previewLinha(
  qty: number,
  pesoMassaG: number | null,
  somaBakerMassa: number,
  levainPct: number | null
): PreviewLinha {
  const massaKg = pesoMassaG == null ? null : round3((qty * pesoMassaG) / 1000);

  const farinhaPorPao = farinhaPorPaoG(pesoMassaG, somaBakerMassa);

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
export function farinhaPorPaoG(pesoMassaG: number | null, somaBakerMassa: number): number | null {
  return somaBakerMassa > 0 && pesoMassaG != null ? pesoMassaG / somaBakerMassa : null;
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

/** Temp legivel pt-BR: "25,5 °C" (virgula decimal, ate 1 casa). */
export function fmtTempC(c: number): string {
  return `${c.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} °C`;
}

// ---- Acompanhamento (Estado B / fatia B1) — helpers puros ----

const ETAPA_TIPO_LABEL: Record<EtapaTipo, string> = {
  autolise_mistura: 'Autólise + mistura',
  batimento: 'Batimento',
  falsa_dobra: 'Falsa dobra',
  dobra: 'Dobras',
  pre_shape: 'Pré-shape',
  shape: 'Shape',
  descanso: 'Descanso',
  fermentacao_final: 'Fermentação final',
  coccao: 'Cocção',
};

/** Rotulo legivel do tipo de etapa (etapa_tipo_enum). */
export function etapaTipoLabel(tipo: EtapaTipo): string {
  return ETAPA_TIPO_LABEL[tipo] ?? tipo;
}

const PRODUCAO_STATUS_LABEL: Record<ProducaoStatus, string> = {
  planejada: 'Planejada',
  em_curso: 'Em curso',
  concluida: 'Concluída',
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

/** Subtexto do tamanho da peca na etapa de divisao: "peças de ~283 g". */
export function fmtPecaDivisao(pesoMassaG: number | null): string | null {
  if (pesoMassaG == null) return null;
  return `peças de ~${fmtG(pesoMassaG)}`;
}

// ---- Registro de dobras (etapa tipo='dobra', em detalhes.dobras) ----
//
// Sem schema: o array vive em etapas_producao.detalhes (JSONB) e dobra_numero
// espelha a contagem. Registro e UM TOQUE (append { n, at, temp_c:null }); a
// temp e opcional e preenchivel depois. Helpers puros pra UI + testes.

export interface DobraRegistro {
  n: number; // 1-based, sequencial
  at: string; // timestamptz ISO do registro (gerado no client)
  temp_c: number | null; // temp da massa na dobra (opcional, preenchivel depois)
}

/**
 * Le detalhes.dobras de forma defensiva: ignora valor nao-array e entradas
 * malformadas; ordena por n pra exibicao estavel.
 */
export function lerDobras(detalhes: Record<string, unknown> | null | undefined): DobraRegistro[] {
  const raw = detalhes?.dobras;
  if (!Array.isArray(raw)) return [];
  const out: DobraRegistro[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.n === 'number' && typeof o.at === 'string') {
      out.push({ n: o.n, at: o.at, temp_c: typeof o.temp_c === 'number' ? o.temp_c : null });
    }
  }
  return out.sort((a, b) => a.n - b.n);
}

/** Append de uma nova dobra (n sequencial a partir da ultima). */
export function appendDobra(dobras: DobraRegistro[], at: string): DobraRegistro[] {
  const n = (dobras[dobras.length - 1]?.n ?? 0) + 1;
  return [...dobras, { n, at, temp_c: null }];
}

/** Define a temp (pode ser null) de uma dobra ja registrada, por n. */
export function setTempDobra(
  dobras: DobraRegistro[],
  n: number,
  tempC: number | null
): DobraRegistro[] {
  return dobras.map((d) => (d.n === n ? { ...d, temp_c: tempC } : d));
}

/** Remove a ultima dobra registrada (desfazer toque errado). */
export function removerUltimaDobra(dobras: DobraRegistro[]): DobraRegistro[] {
  return dobras.slice(0, -1);
}

/** Resumo da etapa de dobras: "3 dobras · última 15:02" (hora SP). Null se vazio. */
export function resumoDobras(dobras: DobraRegistro[]): string | null {
  if (dobras.length === 0) return null;
  const ultima = dobras[dobras.length - 1];
  const plural = dobras.length === 1 ? 'dobra' : 'dobras';
  return `${dobras.length} ${plural} · última ${formataHoraSp(ultima.at)}`;
}

// ---- Registro (Estado C / fatia 1) — previsto x realizado ----

/**
 * Delta relativo (realizado - previsto) / previsto. Null quando qualquer lado
 * falta OU previsto == 0 (sem base de comparacao) — a UI so exibe delta com
 * ambos preenchidos.
 */
export function calcDelta(previsto: number | null, realizado: number | null): number | null {
  if (previsto == null || realizado == null || previsto === 0) return null;
  return (realizado - previsto) / previsto;
}

/**
 * Delta relativo legivel com sinal EXPLICITO: "+4%" / "-3,2%" / "+0%".
 * Produzir menos nao e erro — o sinal e informacao, nao julgamento.
 */
export function fmtDeltaPct(delta: number): string {
  const pct = delta * 100;
  const s = Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return pct < 0 ? `-${s}%` : `+${s}%`;
}

/** Delta absoluto em unidades com sinal explicito: "+2 un" / "-5 un" / "+0 un". */
export function fmtDeltaUn(previstoUn: number, realizadoUn: number): string {
  const d = realizadoUn - previstoUn;
  return d < 0 ? `${d} un` : `+${d} un`;
}

/**
 * Duracao em minutos entre dois timestamps ISO. Null se algum falta, e
 * invalido ou o fim vem antes do inicio (carimbo inconsistente).
 */
export function duracaoMin(
  iniciadaAt: string | null,
  concluidaAt: string | null
): number | null {
  if (!iniciadaAt || !concluidaAt) return null;
  const a = new Date(iniciadaAt).getTime();
  const b = new Date(concluidaAt).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

/** Duracao legivel: "45 min" / "1h" / "1h05". */
export function fmtDuracaoMin(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

// ---- Contexto (B2b-1) ----

export interface DiaContexto {
  dia: number; // D-index: 0=entrega, 1=vespera, 2=2 dias antes
  data: string; // YYYY-MM-DD
  label: string; // "D2 . ter 9 jun"
}

/**
 * Os 3 dias do ciclo em ordem cronologica (D2, D1, D0). `dia` e o D-index
 * (0 = entrega), batendo com a coluna INT de contextos_dia (0024). `data` =
 * entrega - dia dias; `label` = "D{dia} . {dia-semana dia mes}".
 */
export function diasContexto(dataEntrega: string): DiaContexto[] {
  return [2, 1, 0].map((dia) => {
    const data = ymdMenosDias(dataEntrega, dia);
    return { dia, data, label: `D${dia} . ${formataDiaSemanaDiaMes(data)}` };
  });
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

/**
 * Etapas em que a agua entra como HIDRATACAO DA MASSA — a agua que conta no
 * percentual de hidratacao do padeiro e que uma variacao de receita reescala.
 *
 * CRITERIO pra decidir se uma etapa nova entra aqui: a agua daquela etapa
 * termina dentro da massa que vai ao forno, e mudar a hidratacao alvo tem que
 * mudar essa agua junto.
 *   - Preparo que VOLTA pra massa entra. O escaldo das sementes (Multigraos) e
 *     o tangzhong (Brioche) sao feitos na vespera e dormem na geladeira, mas
 *     entram na massa no dia seguinte — sao hidratacao.
 *   - Preparo e cobertura que ficam FORA da massa nao entram. A salamoia da
 *     Focaccia e salmoura de superficie: pedir 80% de hidratacao nao pode
 *     diluir a salmoura junto, nem contar a agua dela como hidratacao.
 *
 * Na duvida: se a agua nao conta na conta de hidratacao do padeiro, nao entra.
 *
 * A lista e aberta de proposito, igual a coluna `etapa` (0036): etapa nova nao
 * quebra nada, so nao e reescalada ate ser adicionada aqui de propria vontade.
 */
export const ETAPAS_DE_MASSA: readonly string[] = [
  'autolise_mistura',
  'batimento',
  'escaldo',
  'tangzhong',
];

/**
 * Soma os baker que compoem a MASSA, ignorando cobertura, crosta e preparo de
 * superficie. E o denominador de `farinhaPorPaoG` e o espelho exato do filtro
 * de `peso_farinha_por_pao()` (0037) — os dois tem que concordar, senao a tela
 * mostra uma farinha e o banco calcula outra.
 */
export function somaBakerDaMassa(
  linhas: { etapa: string | null; percentual: number }[],
): number {
  return linhas.reduce((s, l) => (ehEtapaDeMassa(l.etapa) ? s + l.percentual : s), 0);
}

/** `true` se a etapa e uma das que contam como hidratacao da massa. */
export function ehEtapaDeMassa(etapa: string | null | undefined): boolean {
  return etapa != null && ETAPAS_DE_MASSA.includes(etapa);
}

export interface LinhaAgua {
  etapa: string | null;
  percentual: number;
}

/**
 * Distribui a hidratacao alvo entre as linhas de agua DA MASSA, preservando a
 * proporcao que elas ja tinham entre si.
 *
 * Desde a 0036 a agua pode estar dividida em etapas, e desde a remodelagem da
 * Focaccia nem toda linha de agua e massa. Gravar o alvo em cada linha
 * multiplicaria a hidratacao pelo numero de etapas; distribuir entre TODAS as
 * linhas diluiria a salmoura da Focaccia junto e ainda erraria a massa (o alvo
 * seria repartido com agua que nao e hidratacao).
 *
 * Retorna um valor por linha, na MESMA ordem da entrada. Linha fora das etapas
 * de massa volta com o percentual original — nao e tocada.
 *
 * `percentual_baker` e NUMERIC(6,4): arredonda em 4 casas aqui em vez de deixar
 * o Postgres arredondar linha a linha, e o resto cai na ultima linha de massa
 * pra soma fechar o alvo. Sem nenhuma linha de massa (receita sem agua na
 * massa, ex.: Brioche) devolve tudo intocado.
 */
export function distribuiHidratacaoPorEtapa(linhas: LinhaAgua[], alvo: number): number[] {
  const daMassa = linhas.map((l) => ehEtapaDeMassa(l.etapa));
  const total = linhas.reduce((s, l, i) => (daMassa[i] ? s + l.percentual : s), 0);
  const qtd = daMassa.filter(Boolean).length;
  if (qtd === 0) return linhas.map((l) => l.percentual);

  const q4 = (n: number) => Math.round(n * 10000) / 10000;
  const ultimoDaMassa = daMassa.lastIndexOf(true);

  const out: number[] = [];
  let acumulado = 0;
  for (let i = 0; i < linhas.length; i++) {
    if (!daMassa[i]) {
      out.push(linhas[i].percentual);
      continue;
    }
    const fatia = total > 0 ? linhas[i].percentual / total : 1 / qtd;
    const valor = i === ultimoDaMassa ? q4(alvo - acumulado) : q4(alvo * fatia);
    acumulado += valor;
    out.push(valor);
  }
  return out;
}
