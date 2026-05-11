-- ============================================================
-- Cora — Migration inicial (Fase 7 do refactor de Onboarding)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE subscription_status AS ENUM (
  'pending_payment', 'active', 'paused', 'cancelled'
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                  TEXT NOT NULL,
  whatsapp              TEXT NOT NULL,
  email                 TEXT NOT NULL,
  cpf                   TEXT NOT NULL,
  cep                   TEXT NOT NULL,
  rua                   TEXT NOT NULL,
  numero                TEXT NOT NULL,
  complemento           TEXT,
  bairro                TEXT NOT NULL,
  cidade                TEXT NOT NULL,
  estado                TEXT NOT NULL,
  itens                 JSONB NOT NULL,
  total_paes            INT  NOT NULL,
  valor_paes            NUMERIC(10,2) NOT NULL,
  valor_frete           NUMERIC(10,2) NOT NULL,
  valor_mensal          NUMERIC(10,2) NOT NULL,
  status                subscription_status NOT NULL DEFAULT 'pending_payment',
  coverage_unconfirmed  BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_valor_mensal_check
    CHECK (valor_mensal = valor_paes + valor_frete)
);

CREATE INDEX subscriptions_email_idx  ON subscriptions(email);
CREATE INDEX subscriptions_cpf_idx    ON subscriptions(cpf);
CREATE INDEX subscriptions_status_idx ON subscriptions(status);
CREATE INDEX subscriptions_coverage_unconfirmed_idx
  ON subscriptions(coverage_unconfirmed)
  WHERE coverage_unconfirmed = true;

-- ADICIONADO: idempotência — 1 só pending por CPF
CREATE UNIQUE INDEX subscriptions_cpf_pending_uniq
  ON subscriptions(cpf)
  WHERE status = 'pending_payment';

CREATE TRIGGER subscriptions_set_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE coverage_waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf         TEXT,
  nome        TEXT,
  whatsapp    TEXT NOT NULL,
  email       TEXT,
  cep         TEXT NOT NULL,
  bairro      TEXT,
  cidade      TEXT,
  estado      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE coverage_whitelist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf         TEXT,
  email       TEXT,
  cep         TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_waitlist   ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_whitelist  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny all" ON subscriptions
  FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY "deny all" ON coverage_waitlist
  FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY "deny all" ON coverage_whitelist
  FOR ALL TO public USING (false) WITH CHECK (false);
