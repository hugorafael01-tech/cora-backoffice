-- ============================================================
-- Verificacao da Migration 0050 (RLS em geracao_execucoes)
-- — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: rode UMA query por vez (o SQL Editor so mostra o ultimo SELECT).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — RLS ainda DESLIGADO (esperado: 1 linha, rls = false)
SELECT relname, relrowsecurity AS rls
FROM pg_class
WHERE oid = 'public.geracao_execucoes'::regclass;


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — RLS LIGADO (esperado: 1 linha, rls = true)
SELECT relname, relrowsecurity AS rls
FROM pg_class
WHERE oid = 'public.geracao_execucoes'::regclass;

-- POS.2 — NENHUMA policy (esperado: 0 linhas). E o ponto da migration: sem
--   policy, RLS ligado nega para anon e authenticated, e o service_role do
--   portal bypassa. Se aparecer policy aqui, alguem abriu a tabela sem querer.
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'geracao_execucoes';

-- POS.3 — quem tem GRANT na tabela (esperado: as roles do padrao da base;
--   confira que `anon` NAO aparece com nada alem do que as demais tabelas
--   fechadas tem. O GRANT nao substitui a policy: com RLS ligado e sem policy,
--   grant nenhum devolve linha para anon/authenticated.)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'geracao_execucoes'
ORDER BY grantee, privilege_type;
