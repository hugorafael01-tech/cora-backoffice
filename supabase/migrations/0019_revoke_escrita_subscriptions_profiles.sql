-- ============================================================
-- Cora Backoffice — Migration 0019: revoke escrita direta em subscriptions/profiles
-- ============================================================
-- Fecha o furo de seguranca da policy subscriptions_update_own (ClickUp 86e1mcyuz).
-- A 0017 deixou GRANT ALL default do Supabase pra authenticated/anon em subscriptions,
-- e uma policy update_own. RLS restringe a LINHA, nao a COLUNA: um assinante logado
-- conseguia dar UPDATE em qualquer coluna da propria linha direto do client
-- (supabase-js/PostgREST), incluindo status (auto-marcar pago = bypass de pagamento),
-- asaas_customer_id/asaas_subscription_id e qty_* (colunas adicionadas na 0018).
--
-- Correcao: toda escrita em subscriptions/profiles passa a ser exclusivamente via
-- service_role (endpoints /api, que fazem bypass de RLS e tem grants proprios). O client
-- (authenticated/anon) fica com leitura own apenas, zero escrita.
--
-- PONTOS DE PARADA (ver briefing):
--   - SELECT de authenticated MANTIDO nas duas tabelas (D.2 depende). So anon perde SELECT.
--   - service_role NAO e tocado (REVOKE de authenticated/anon nao o afeta).
--   - Pre-req confirmado: nenhuma escrita client-side em subscriptions/profiles no cora-portal.
--
-- Ver Docs/CORA_Briefing_Seguranca_Revoke_Subscriptions.md.
-- Data: 2026-05-30
-- ============================================================

-- ------------------------------------------------------------
-- 1. subscriptions — revoga escrita de authenticated e anon.
--    Idempotente: REVOKE de privilegio ausente e no-op.
-- ------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.subscriptions FROM authenticated, anon;

-- anon nao tem caminho legitimo de leitura (portal le autenticado).
REVOKE SELECT ON public.subscriptions FROM anon;

-- ------------------------------------------------------------
-- 2. profiles — mesmo tratamento (cadastro e server-side via service_role).
-- ------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles FROM authenticated, anon;

REVOKE SELECT ON public.profiles FROM anon;

-- ------------------------------------------------------------
-- 3. policy update_own deixa de fazer sentido: sem privilegio de UPDATE no
--    client, a policy nao concede nada e so confunde quem audita.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS subscriptions_update_own ON public.subscriptions;

-- ------------------------------------------------------------
-- Mantidas: subscriptions_select_own (0017), profiles_select_own (0018),
-- e a leitura admin de subscriptions. SELECT de authenticated permanece nas
-- duas tabelas. service_role inalterado.
-- ------------------------------------------------------------
