/**
 * Normaliza string pra comparacao tolerante: lowercase + remove
 * diacriticos (acentos, cedilha, etc.).
 *
 * Espelha src/utils/normalize.js do Portal. Manter sincronizado.
 * Ex: "Sao Francisco" -> "sao francisco", "Icarai" -> "icarai".
 */
export const normalize = (s: string | null | undefined): string =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

export const equalsLoose = (
  a: string | null | undefined,
  b: string | null | undefined
): boolean => normalize(a) === normalize(b);
