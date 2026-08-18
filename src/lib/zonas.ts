// Zonas de entrega e sequenciamento por onda (briefing de logistica 17/08/2026).
// Helpers puros, sem Supabase — schema em 0032_zonas_entrega.sql.
//
// ZONA e SEQUENCIA sao coisas diferentes e nenhuma substitui a outra:
//   - Zona e estavel, vive no cadastro do assinante, agrupa a montagem e diz em
//     que bag o pacote vai.
//   - Sequencia e semanal, vive na entrega, ordena as paradas da onda e a ordem
//     de carregar a bag.
//
// A zona NUNCA e derivada do bairro em tempo de execucao: Lagoa cai em R1 e em
// R3 (um endereco e quase Jardim Botanico). `sugereZonaPorBairro` serve so pro
// momento do cadastro, como sugestao sobrescrivel.
import { normalize } from './normalize';

export type Onda = 'niteroi' | 'rio';
export type FormaZona = 'circulo' | 'triangulo' | 'quadrado' | 'losango' | 'hexagono';

/** Linha de `zonas_entrega`. */
export interface Zona {
  codigo: string;
  nome: string;
  cidade: string;
  onda: Onda;
  ordem: number;
  corHex: string;
  forma: FormaZona;
  /** false = entrega propria: fora da numeracao da onda e da capacidade da bag. */
  entraNaOnda: boolean;
  ativo: boolean;
}

/** Linha de `bairro_zona_default` — sugestao, nao fonte da verdade. */
export interface BairroZonaDefault {
  cidade: string;
  bairro: string;
  zona: string;
}

/**
 * Grupo de exibicao da expedicao: as duas ondas de rota, mais 'propria' pras
 * zonas com `entra_na_onda = false` (nao viajam na bag).
 *
 * Entrega SEM zona nao ganha grupo proprio de proposito: ela cai na onda pela
 * `regiao` do snapshot, recebe sequencia e e carregada como qualquer outra — so
 * fica marcada na tela e na etiqueta. Pacote que existe e precisa ser entregue
 * nao pode ficar num limbo fora da lista de carregamento por causa de um campo
 * de cadastro vazio.
 */
export type GrupoOnda = Onda | 'propria';

const PREFIXO: Record<Onda, string> = { niteroi: 'N', rio: 'R' };

export const ONDA_LABEL: Record<Onda, string> = { niteroi: 'Niterói', rio: 'Rio' };

export const GRUPO_LABEL: Record<GrupoOnda, string> = {
  niteroi: 'Niterói',
  rio: 'Rio',
  propria: 'Entrega própria',
};

/** Mapa codigo -> zona, pra resolver zona de entrega sem varrer a lista. */
export function indexaZonas(zonas: Zona[]): Map<string, Zona> {
  return new Map(zonas.map((z) => [z.codigo, z]));
}

/**
 * Codigo de sequencia impresso na etiqueta: 'N-07', 'R-01'. Zero-pad em 2
 * digitos ate 99 e cresce sozinho depois — a onda do Rio ja tem 19 paradas e a
 * base so aumenta.
 */
export function codigoSequencia(onda: Onda, sequencia: number): string {
  return `${PREFIXO[onda]}-${String(sequencia).padStart(2, '0')}`;
}

/**
 * Sugestao de zona pro cadastro a partir do bairro. Match tolerante a acento e
 * caixa (o cadastro tem "Icaraí" e "Icarai", "Niterói" e "Niteroi"). Devolve
 * null quando o bairro nao tem default — bairro novo NAO ganha zona por chute.
 */
export function sugereZonaPorBairro(
  cidade: string | null | undefined,
  bairro: string | null | undefined,
  defaults: BairroZonaDefault[]
): string | null {
  const c = normalize(cidade);
  const b = normalize(bairro);
  if (!c || !b) return null;
  const hit = defaults.find((d) => normalize(d.cidade) === c && normalize(d.bairro) === b);
  return hit ? hit.zona : null;
}

/** Campos que o sequenciamento le de uma entrega. */
export interface EntregaSequenciavel {
  id: string;
  zona: string | null;
  sequencia: number | null;
  regiao: string;
  bairro: string;
  rua: string;
  numero: string | null;
  nome: string;
}

/** Zona resolvida da entrega, ou null (sem zona no cadastro / codigo desativado). */
export function zonaDaEntrega(
  e: Pick<EntregaSequenciavel, 'zona'>,
  porCodigo: Map<string, Zona>
): Zona | null {
  return (e.zona ? porCodigo.get(e.zona) : undefined) ?? null;
}

/**
 * Em que grupo a entrega aparece. Preferencia pela zona gravada; sem zona, cai
 * na onda pela `regiao` do snapshot — ver a nota em `GrupoOnda`.
 */
export function grupoDaEntrega(
  e: Pick<EntregaSequenciavel, 'zona' | 'regiao'>,
  porCodigo: Map<string, Zona>
): GrupoOnda {
  const z = zonaDaEntrega(e, porCodigo);
  if (!z) return e.regiao === 'niteroi' ? 'niteroi' : 'rio';
  return z.entraNaOnda ? z.onda : 'propria';
}

/**
 * Onda de rota da entrega, pra formar o codigo de sequencia. null so pra quem
 * nao viaja na bag (zona com `entra_na_onda = false`).
 */
export function ondaDaEntrega(
  e: Pick<EntregaSequenciavel, 'zona' | 'regiao'>,
  porCodigo: Map<string, Zona>
): Onda | null {
  const g = grupoDaEntrega(e, porCodigo);
  return g === 'propria' ? null : g;
}

const cmpTexto = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
const cmpNumero = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true });

/**
 * Ordem canonica dentro da onda: `ordem` da zona primeiro, depois criterio
 * estavel (bairro, logradouro, numero, nome). NAO e otimizacao de rota — e
 * previsibilidade: rodar de novo com os mesmos dados da sempre o mesmo
 * resultado, entao o ajuste manual do Hugo nunca briga com um recalculo.
 * Entrega sem zona vai pro fim da onda (ordem infinita).
 */
export function comparaCanonico(
  a: EntregaSequenciavel,
  b: EntregaSequenciavel,
  porCodigo: Map<string, Zona>
): number {
  const oa = zonaDaEntrega(a, porCodigo)?.ordem ?? Number.POSITIVE_INFINITY;
  const ob = zonaDaEntrega(b, porCodigo)?.ordem ?? Number.POSITIVE_INFINITY;
  return (
    oa - ob ||
    cmpTexto(a.bairro, b.bairro) ||
    cmpTexto(a.rua, b.rua) ||
    cmpNumero(a.numero ?? '', b.numero ?? '') ||
    cmpTexto(a.nome, b.nome)
  );
}

/** Entregas que participam da numeracao de uma onda. */
function daOnda<T extends EntregaSequenciavel>(
  entregas: T[],
  onda: Onda,
  porCodigo: Map<string, Zona>
): T[] {
  return entregas.filter((e) => grupoDaEntrega(e, porCodigo) === onda);
}

/** Uma sequencia a gravar. */
export interface AtribuicaoSequencia {
  id: string;
  sequencia: number;
}

/**
 * Sequencia que FALTA, sem mexer no que ja existe. Entregas que ja tem numero
 * ficam exatamente onde estao — inclusive as que o Hugo reordenou na mao — e as
 * novas entram no fim da onda, em ordem canonica. E o que roda junto com
 * "Atualizar da demanda": assinante que entrou no meio da semana ganha numero
 * sem embaralhar a bag que ja foi montada.
 *
 * Devolve so o que mudou (lista vazia = nada a fazer).
 */
export function atribuiSequenciasFaltantes<T extends EntregaSequenciavel>(
  entregas: T[],
  porCodigo: Map<string, Zona>
): AtribuicaoSequencia[] {
  const saida: AtribuicaoSequencia[] = [];

  for (const onda of ['niteroi', 'rio'] as const) {
    const doGrupo = daOnda(entregas, onda, porCodigo);
    const usadas = doGrupo
      .map((e) => e.sequencia)
      .filter((s): s is number => typeof s === 'number');
    let proxima = usadas.length > 0 ? Math.max(...usadas) + 1 : 1;

    for (const e of doGrupo
      .filter((e) => e.sequencia == null)
      .sort((a, b) => comparaCanonico(a, b, porCodigo))) {
      saida.push({ id: e.id, sequencia: proxima });
      proxima += 1;
    }
  }

  return saida;
}

/**
 * Renumera a onda inteira 1..n em ordem canonica, DESCARTANDO o arranjo manual.
 * So roda por acao explicita ("Recalcular sequência"): recalculo automatico e
 * exatamente o "sistema desfazendo o ajuste" que o briefing proibe.
 */
export function recalculaSequencias<T extends EntregaSequenciavel>(
  entregas: T[],
  porCodigo: Map<string, Zona>,
  onda: Onda
): AtribuicaoSequencia[] {
  return daOnda(entregas, onda, porCodigo)
    .sort((a, b) => comparaCanonico(a, b, porCodigo))
    .map((e, i) => ({ id: e.id, sequencia: i + 1 }));
}

/**
 * Move uma entrega uma posicao na onda, trocando de numero com a vizinha.
 * Troca (em vez de reinserir e renumerar) e o que mantem o resto da bag parado:
 * so duas linhas mudam, e o Hugo consegue prever o efeito de cada clique.
 * Lista vazia quando ja esta na ponta.
 */
export function moveNaSequencia<T extends EntregaSequenciavel>(
  entregas: T[],
  porCodigo: Map<string, Zona>,
  id: string,
  direcao: 'cima' | 'baixo'
): AtribuicaoSequencia[] {
  const alvo = entregas.find((e) => e.id === id);
  if (!alvo || alvo.sequencia == null) return [];

  const onda = ondaDaEntrega(alvo, porCodigo);
  if (!onda) return [];

  const ordenadas = daOnda(entregas, onda, porCodigo)
    .filter((e) => e.sequencia != null)
    .sort((a, b) => (a.sequencia ?? 0) - (b.sequencia ?? 0));

  const i = ordenadas.findIndex((e) => e.id === id);
  const j = direcao === 'cima' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ordenadas.length) return [];

  const vizinha = ordenadas[j];
  return [
    { id: alvo.id, sequencia: vizinha.sequencia as number },
    { id: vizinha.id, sequencia: alvo.sequencia as number },
  ];
}
