-- ============================================================
-- Verificacao da Migration 0035 (cardapio_publico) — rodar no SQL Editor
-- ============================================================
-- Uma query por vez: o SQL Editor so mostra o output do ULTIMO SELECT.
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — a coluna e a view ainda NAO existem (esperado: 0 linhas)
SELECT 'coluna' AS objeto, table_name AS nome FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'cardapios' AND column_name = 'destaque'
UNION ALL
SELECT 'view', table_name FROM information_schema.views
WHERE table_schema = 'public' AND table_name = 'cardapio_publico';

-- PRE.2 — estado do cardapio das semanas que o backfill toca.
--   Esperado, exatamente 3 linhas: 2026-08-06 focaccia / 2026-08-20 multigraos
--   / 2026-08-27 brioche. Se vier menos de 3, o mapa e o banco divergiram mais
--   do que o esperado — PARAR e conferir antes de aplicar.
SELECT s.data_entrega, s.numero, s.status, p.slug
FROM cardapios c
JOIN semanas s ON s.id = c.semana_id
JOIN produtos p ON p.id = c.produto_id
WHERE (s.data_entrega, p.slug) IN (
  (DATE '2026-08-06', 'focaccia'), (DATE '2026-08-20', 'multigraos'), (DATE '2026-08-27', 'brioche')
)
ORDER BY s.data_entrega;

-- PRE.3 — nenhuma data_entrega duplicada hoje (esperado: 0 linhas). O
--   DISTINCT ON da view existe pro caso de um dia duplicar; se ja houver
--   duplicata agora, conferir qual semana a view vai eleger antes de seguir.
SELECT data_entrega, count(*) FROM semanas GROUP BY data_entrega HAVING count(*) > 1;

-- PRE.4 — `cardapios` nao tem linha de produto inativo (esperado: 0). A view
--   filtra por `p.ativo`; se ja houver linha inativa, ela some da vitrine.
SELECT s.data_entrega, p.slug FROM cardapios c
JOIN semanas s ON s.id = c.semana_id JOIN produtos p ON p.id = c.produto_id
WHERE NOT p.ativo;

-- PRE.5 — a semana 36 (03/09) e o caso com prazo: hoje so Original e Integral.
--   Guardar este "antes"; e o que o portal vai anunciar depois de terca 25/08
--   ao meio-dia, no lugar da ciabatta que o menu.js promete.
SELECT p.slug, c.tipo, c.preco_avulso FROM cardapios c
JOIN semanas s ON s.id = c.semana_id JOIN produtos p ON p.id = c.produto_id
WHERE s.data_entrega = DATE '2026-09-03' ORDER BY c.tipo, p.slug;


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — coluna criada com o tipo certo (esperado: 1 linha, boolean NOT NULL
--   com default false)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'cardapios' AND column_name = 'destaque';

-- POS.2 — indice unico PARCIAL criado (esperado: 1 linha, e o `indexdef` tem
--   que terminar em `WHERE destaque`. Sem o WHERE, o indice estaria proibindo
--   duas linhas sem destaque na mesma semana — o caso normal.)
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'ux_cardapios_destaque_por_semana';

-- POS.3 — o backfill marcou exatamente 3 linhas, uma por semana.
--   Esperado: 2026-08-06 focaccia / 2026-08-20 multigraos / 2026-08-27 brioche.
--   Conferir contra PRE.2 — tem que ser as MESMAS 3 linhas.
SELECT s.data_entrega, s.numero, s.status, p.slug, c.preco_avulso
FROM cardapios c
JOIN semanas s ON s.id = c.semana_id JOIN produtos p ON p.id = c.produto_id
WHERE c.destaque ORDER BY s.data_entrega;

-- POS.4 — nenhuma semana ficou com mais de um destaque (esperado: 0 linhas).
--   Redundante com o indice, e de proposito: prova o dado, nao a constraint.
SELECT semana_id, count(*) FROM cardapios WHERE destaque GROUP BY semana_id HAVING count(*) > 1;

-- POS.5 — o indice esta de pe (esperado: ERRO 'duplicate key value violates
--   unique constraint "ux_cardapios_destaque_por_semana"'). Rodar e conferir
--   que FALHA: tenta por um segundo destaque na semana 35, que ja tem brioche.
UPDATE cardapios SET destaque = true
WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'focaccia')
  AND semana_id = (SELECT id FROM semanas WHERE data_entrega = DATE '2026-08-27');

-- POS.6 — zero destaque continua permitido (esperado: sucesso, e depois o
--   SELECT devolve 0). A semana 36 e a que nasce assim.
--   NAO precisa desfazer: 03/09 ja esta sem destaque pelo backfill.
SELECT count(*) AS destaques_na_semana_36 FROM cardapios c
JOIN semanas s ON s.id = c.semana_id
WHERE s.data_entrega = DATE '2026-09-03' AND c.destaque;

-- POS.7 — a view devolve o cardapio certo das 3 semanas que importam.
--   Esperado:
--     2026-08-20  original/integral (base) + multigraos (rotativo, destaque)
--     2026-08-27  original/integral (base) + brioche (destaque), focaccia, multigraos
--     2026-09-03  original/integral (base), NENHUM destaque  <- o caso com prazo
SELECT data_entrega, tipo, slug, preco_avulso, destaque
FROM cardapio_publico WHERE data_entrega >= DATE '2026-08-20'
ORDER BY data_entrega, tipo, slug;

-- POS.8 — a view expoe SO as 5 colunas escolhidas. Esperado exatamente:
--   data_entrega, slug, tipo, preco_avulso, destaque.
--   `sobra_levain_g`, `status`, `numero` e os ids NAO podem aparecer.
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'cardapio_publico'
ORDER BY ordinal_position;

-- POS.9 — grants da view: SO SELECT pra anon e authenticated (esperado: 2
--   linhas, as duas com SELECT). Se aparecer INSERT/UPDATE/DELETE, o REVOKE
--   nao rodou — o Supabase concede GRANT default amplo em relacao nova.
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'cardapio_publico'
  AND grantee IN ('anon', 'authenticated') ORDER BY grantee, privilege_type;

-- POS.10 — a view e security definer DE PROPOSITO (esperado: reloptions
--   contendo `security_invoker=false`). E o que faz ela enxergar `cardapios` e
--   `semanas` por baixo da RLS. O Supabase Advisor vai sinalizar isso; ver a
--   justificativa no bloco 3 da migration.
SELECT relname, reloptions FROM pg_class
WHERE relname = 'cardapio_publico' AND relkind = 'v';

-- POS.11 — as tabelas continuam FECHADAS pro portal (esperado: 0 linhas).
--   A view e a unica porta; `semanas` e `cardapios` nao ganharam policy nova.
SELECT tablename, policyname, roles::text FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('semanas', 'cardapios')
  AND roles::text LIKE '%anon%';


-- ============================================================
-- POS.12 — PROVA DE FOGO: ler como o portal le, do lado de fora
-- ============================================================
-- As queries acima rodam como `postgres` no SQL Editor e passariam mesmo se o
-- GRANT estivesse errado. Esta e a unica que testa o caminho real. Rodar no
-- terminal (a anon key esta em cora-portal/.env.local; e chave publica de
-- client, mas nao colar o valor em lugar nenhum):
--
--   set -a && . ./.env.local && set +a
--   curl -s "$VITE_SUPABASE_URL/rest/v1/cardapio_publico?data_entrega=eq.2026-08-27&select=slug,tipo,preco_avulso,destaque" \
--     -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
--
-- Esperado: 5 linhas (original, integral, brioche, focaccia, multigraos), com
-- `destaque: true` SO no brioche.
--
-- E o controle negativo — `semanas` tem que continuar devolvendo `[]`:
--
--   curl -s "$VITE_SUPABASE_URL/rest/v1/semanas?select=id&limit=1" \
--     -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
--
-- `[]` = RLS de pe (a tabela existe e o anon tem GRANT, mas nenhuma policy o
-- alcanca). Se vier linha, a leitura publica vazou pra tabela inteira.
