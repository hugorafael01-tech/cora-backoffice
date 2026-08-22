-- ============================================================
-- Verificacao da Migration 0034 (revoke_views_publicas) — rodar no SQL Editor
-- ============================================================
-- Uma query por vez: o SQL Editor so mostra o output do ULTIMO SELECT.
--
-- ⚠️ SEM BLOCO PRE. A 0034 ja foi aplicada em produçao em 22/08/2026, como
-- hotfix, antes de virar arquivo — nao existe "antes" pra medir. Estas probes
-- CONFIRMAM O ESTADO, nao autorizam uma aplicacao.
--
-- Se alguma delas falhar, a leitura NAO e "falta rodar a migration": e que
-- alguem reconcedeu o grant depois, ou o banco nao e o que se pensa. Investigar
-- antes de rodar qualquer REVOKE.
--
-- O registro do "antes" fica no comentario do PR #77 (o curl com a anon key
-- devolvendo as 36 linhas de `v_assinatura_itens`, com CEP).
-- ============================================================


-- POS.1 — nenhum grant sobrou nas duas views pra anon/authenticated
--   (esperado: 0 linhas). E a probe central deste arquivo.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('v_assinatura_itens', 'planejamento_semana')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- POS.2 — as views CONTINUAM existindo e utilizaveis pelo SQL Editor
--   (esperado: 2 linhas, `postgres` e `service_role` com os privilegios
--   intactos em cada uma = 4 combinacoes). Nao era pra ser DROP: o REVOKE
--   tirou o acesso do client, nao a ferramenta de consulta.
SELECT table_name, grantee, count(*) AS privilegios
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('v_assinatura_itens', 'planejamento_semana')
  AND grantee IN ('postgres', 'service_role')
GROUP BY table_name, grantee ORDER BY table_name, grantee;

-- POS.3 — as tabelas por baixo nao foram tocadas. Esperado, como sempre foi:
--   `subscriptions` so com SELECT pra authenticated (a 0019 revogou o resto),
--   `weekly_orders` e `pedidos_pontuais` com o grant default + RLS.
--   Nenhuma delas pode ter ganhado ou perdido privilegio nesta migration.
SELECT table_name, grantee, string_agg(DISTINCT privilege_type, ',' ORDER BY privilege_type) AS privs
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('subscriptions', 'weekly_orders', 'pedidos_pontuais')
  AND grantee IN ('anon', 'authenticated')
GROUP BY table_name, grantee ORDER BY table_name, grantee;

-- POS.4 — VARREDURA: nenhuma OUTRA view de `public` com grant pro client
--   (esperado: 0 linhas ANTES da 0035; depois da 0035, exatamente 1 linha —
--   `cardapio_publico`, que e publica de proposito).
--   E a probe que prova que a classe de problema esta vazia, nao so os dois
--   casos que apareceram.
SELECT c.relname AS view, string_agg(DISTINCT g.grantee, '+' ORDER BY g.grantee) AS quem
FROM information_schema.role_table_grants g
JOIN pg_class c ON c.relname = g.table_name
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE g.table_schema = 'public' AND g.grantee IN ('anon', 'authenticated')
  AND c.relkind = 'v'
GROUP BY c.relname ORDER BY c.relname;

-- POS.5 — VARREDURA: nenhuma TABELA com grant pro client e RLS desligada
--   (esperado: 0 linhas). As ~32 tabelas que tem grant sao o modelo normal do
--   Supabase — quem decide ali e a RLS. Uma linha aqui seria leitura livre.
SELECT c.relname, c.relrowsecurity AS rls_ligada,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE c.relkind = 'r' AND NOT c.relrowsecurity
  AND EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'public' AND g.table_name = c.relname
                AND g.grantee IN ('anon', 'authenticated'))
ORDER BY c.relname;


-- ============================================================
-- POS.6 — PROVA DE FOGO: ler como o portal le, do lado de fora
-- ============================================================
-- As queries acima rodam como `postgres` e passariam mesmo com o grant errado.
-- Esta e a unica que testa o caminho real. Rodar no terminal (a anon key esta
-- em .env.local; e chave publica de client, mas nao colar o valor em lugar
-- nenhum):
--
--   set -a && . ./.env.local && set +a
--   for v in v_assinatura_itens planejamento_semana; do
--     curl -s "$VITE_SUPABASE_URL/rest/v1/$v?select=*&limit=1" \
--       -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
--   done
--
-- Esperado nas duas:
--   {"code":"42501", ... "message":"permission denied for view <nome>"}
--
-- Conferido assim em 22/08/2026, depois do hotfix. `42501` e o codigo de grant
-- revogado; se voltar JSON com linhas, o grant foi reconcedido.
--
-- Nao da pra testar o caso `authenticated` so com curl (precisa de um JWT de
-- assinante). O grant e por ROLE e a POS.1 ja prova a ausencia nos dois — o
-- curl cobre o caminho anonimo, que era o mais exposto.
