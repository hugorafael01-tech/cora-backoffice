-- ============================================================
-- Cora Backoffice — Migration 0018: profiles + expand subscriptions
-- ============================================================
-- Frente D / D.1 — fase EXPAND do expand-contract (Subscription no DB).
-- A tabela `subscriptions` existe em produção desde a 0001_initial (portal)
-- e os endpoints /api/subscriptions ainda leem o shape antigo. Por isso
-- esta migration SÓ ADICIONA: cria `profiles` e acrescenta colunas novas
-- em `subscriptions`, sem dropar nem renomear nada. O drop das colunas
-- mortas é uma migration de CONTRACT separada (ClickUp 86e1mc0ta), que só
-- roda após o cutover de código (D.2/D.3/D.4).
--
-- Reúsos confirmados no DDL do projeto:
--   - set_updated_at()           — função de 0001_initial, NÃO recriar.
--   - subscriptions_set_updated_at — trigger de 0001_initial, NÃO duplicar.
--
-- Ver Docs/CORA_Briefing_FrenteD_D1_Schema.md.
-- Data: 2026-05-29
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles — 1:1 com auth.users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  whatsapp   TEXT NOT NULL,
  cpf        TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS
  'Perfil 1:1 com auth.users (Frente D). Read-only no portal; insert do cadastro acontece server-side via service_role. user_id NULLABLE-free aqui (é PK); a coluna espelho em subscriptions vira NOT NULL só na contract.';

-- ------------------------------------------------------------
-- 2. RLS de profiles — SELECT-own apenas
--    Sem policy de INSERT/UPDATE: cadastro é server-side (service_role
--    faz bypass de RLS). Perfil é read-only no portal. Alinha com o
--    padrão de subscriptions (select_own desde 0017).
-- ------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- 3. Trigger de updated_at em profiles (reutiliza set_updated_at())
-- ------------------------------------------------------------
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 4. subscriptions — colunas novas (EXPAND), todas nullable.
--    user_id já existe (0017), não recriar.
-- ------------------------------------------------------------
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS qty_total             SMALLINT,
  ADD COLUMN IF NOT EXISTS qty_original          SMALLINT,
  ADD COLUMN IF NOT EXISTS qty_integral          SMALLINT,
  ADD COLUMN IF NOT EXISTS zona_entrega          TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS activated_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at          TIMESTAMPTZ;

COMMENT ON COLUMN subscriptions.zona_entrega IS
  'Zona de entrega como TEXT (não enum): zonas serão recalibradas após os primeiros pedidos e admitem ajuste manual (CORA_Zoneamento_Entregas_v1). Validação fica na aplicação.';

-- ------------------------------------------------------------
-- 5. CHECKs de qty — NULL-tolerant.
--    Em Postgres, um CHECK passa quando a expressão dá NULL. Linhas
--    legadas têm qty_* = NULL, então os checks não mordem até o cutover
--    (D.3) popular os valores. Viram trava real quando as colunas forem
--    NOT NULL na contract.
--    Faixa 1..3 e composição Original+Integral: CORA_Precos_e_Planos_v1.
-- ------------------------------------------------------------
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_qty_total_range
    CHECK (qty_total IS NULL OR qty_total BETWEEN 1 AND 3),
  ADD CONSTRAINT subscriptions_qty_composition
    CHECK (qty_original + qty_integral = qty_total);
