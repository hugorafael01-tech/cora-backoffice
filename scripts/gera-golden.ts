/**
 * Regenera a saida esperada do golden fixture do gemeo.
 *
 *   npx vite-node scripts/gera-golden.ts
 *
 * Vive fora de `src/` de proposito: usa `node:fs`, e o tsconfig do app limita
 * os types a `vite/client` pra que ninguem escreva `process.env` dentro de um
 * componente por acidente. Aqui e codigo de desenvolvimento, tipado pelo
 * tsconfig.node.
 *
 * A ORDEM quando uma regra muda:
 *   1. muda `src/lib/previa.ts` e os testes de regra
 *   2. roda este script
 *   3. copia `src/lib/previa.golden.json` pra `cora-portal/api/_lib/`
 *   4. `npm run test:previa` no portal
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { montaPrevia } from '../src/lib/previa';
import { montaEntradaGolden, type Golden } from '../src/lib/previaGolden';

const caminho = new URL('../src/lib/previa.golden.json', import.meta.url);
const bruto = JSON.parse(readFileSync(caminho, 'utf8')) as Golden;

bruto.saida = montaPrevia(montaEntradaGolden(bruto), bruto.periodoReferencia);
writeFileSync(caminho, `${JSON.stringify(bruto, null, 2)}\n`);

console.log('golden regenerado:', caminho.pathname);
