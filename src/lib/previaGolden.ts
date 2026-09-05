import type { EntradaPrevia, PrecosPorQuinta, Previa } from './previa';

/**
 * Leitura do golden fixture do gemeo, compartilhada pelo teste e pelo script
 * que o regenera.
 *
 * O JSON nao tem Map, e `EntradaPrevia.precos` e um. A reconstrucao mora aqui
 * pra que o teste e o gerador nunca facam isso de dois jeitos — e o gemeo do
 * portal repete exatamente esta forma do outro lado.
 */
export interface Golden {
  periodoReferencia: string;
  entrada: Omit<EntradaPrevia, 'precos'> & { precos: Record<string, Record<string, number>> };
  saida: Previa | null;
}

export function montaPrecos(cru: Record<string, Record<string, number>>): PrecosPorQuinta {
  const precos: PrecosPorQuinta = new Map();
  for (const [quinta, porSlug] of Object.entries(cru)) {
    precos.set(quinta, new Map(Object.entries(porSlug)));
  }
  return precos;
}

export function montaEntradaGolden(golden: Golden): EntradaPrevia {
  return { ...golden.entrada, precos: montaPrecos(golden.entrada.precos) };
}
