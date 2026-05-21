-- Migration: 0015_bairros_atendidos
-- Origem: Fase 1 Etapa 1 - card de Entregas por bairro (Modulo Semana)
-- Objetivo: fonte unica de bairros atendidos consultavel por Backoffice
--           e (futuramente) Portal. Substitui hardcoded em
--           src/config/coverage.js do Portal quando a Frente D do Portal
--           fechar (fora desta etapa).
--
-- NAO confundir com coverage_whitelist (existente): aquela tabela e
-- whitelist individual por cpf/email/cep, conceito distinto.

CREATE TABLE bairros_atendidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade text NOT NULL,
  bairro text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cidade, bairro)
);

CREATE INDEX idx_bairros_atendidos_ativo
  ON bairros_atendidos(ativo) WHERE ativo = true;

ALTER TABLE bairros_atendidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_bairros_atendidos"
  ON bairros_atendidos FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "anon_read_bairros_atendidos_ativos"
  ON bairros_atendidos FOR SELECT
  USING (ativo = true);

CREATE TRIGGER trg_bairros_atendidos_updated_at
  BEFORE UPDATE ON bairros_atendidos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed (espelha src/config/coverage.js do Portal nesta data)
INSERT INTO bairros_atendidos (cidade, bairro) VALUES
  ('Niterói',        'Icaraí'),
  ('Niterói',        'Ingá'),
  ('Niterói',        'São Francisco'),
  ('Rio de Janeiro', 'Botafogo'),
  ('Rio de Janeiro', 'Humaitá'),
  ('Rio de Janeiro', 'Copacabana');
