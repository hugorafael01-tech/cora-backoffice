-- ============================================================
-- Verificacao da Migration 0031 (app_settings_max_subscriptions) — rodar
-- no SQL Editor
-- ============================================================
-- IMPORTANTE: o SQL Editor so mostra o output do ULTIMO SELECT quando se
-- cola varias queries. Rode UMA query por vez (cada bloco numerado) pra
-- ver tudo.
-- Aplicar a migration: colar o conteudo de
-- 0031_app_settings_max_subscriptions.sql no SQL Editor e rodar (NAO usar
-- supabase db push — historico local dessincronizado).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — coluna max_subscriptions ainda NAO deve existir (esperado: 0 linhas)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'app_settings' AND column_name = 'max_subscriptions';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — coluna criada: integer, not null, default 30
SELECT data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'app_settings' AND column_name = 'max_subscriptions';

-- POS.2 — linha unica de app_settings com o default aplicado (esperado:
--   1 linha, max_subscriptions = 30)
SELECT id, subscriptions_open, max_subscriptions
FROM app_settings;
