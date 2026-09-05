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
  /**
   * Impressao digital do conteudo (periodoReferencia + entrada + saida).
   *
   * O fixture esta commitado nos DOIS repos e cada lado afirma contra a propria
   * copia — entao, se alguem regenerar de um lado so, os dois ficam verdes
   * enquanto ja divergiram. O hash nao impede isso; torna VISIVEL. Os dois
   * testes imprimem o hash ao rodar, e comparar as duas saidas leva um segundo.
   *
   * Consequencia pratica: **copiar o fixture faz parte de espelhar o gemeo, no
   * MESMO PR.** O JSON e o `previa.js` viajam juntos, sempre.
   */
  hash: string;
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

/**
 * cyrb53. Nao e criptografico e nem precisa ser: o que se quer e um numero que
 * muda quando o conteudo muda e que da o MESMO resultado nos dois runtimes.
 *
 * Escrito a mao, sem `node:crypto`, por dois motivos: o tsconfig do app limita
 * os types a `vite/client` de proposito, e o gemeo do portal precisa da mesma
 * conta — uma funcao de 12 linhas atravessa, um import de node nao.
 *
 * ESTA FUNCAO TAMBEM E GEMEA (scripts/test-previa.mjs no portal). Se as duas
 * divergirem, os hashes divergem e o alarme dispara sem motivo — que e o lado
 * seguro de errar.
 */
export function hashGolden(conteudo: unknown): string {
  const texto = JSON.stringify(conteudo);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** O que entra no hash: tudo menos o proprio hash e a nota de leitura. */
export function conteudoParaHash(golden: Golden) {
  return {
    periodoReferencia: golden.periodoReferencia,
    entrada: golden.entrada,
    saida: golden.saida,
  };
}
