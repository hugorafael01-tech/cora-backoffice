-- 0026_entregas.sql
-- Expedicao E1: snapshot de entregas por ciclo (semana). Cada linha CONGELA
-- nome/endereco/itens no momento da geracao e carrega o status da entrega.
--
-- Origem dupla:
--   'assinatura' -> weekly_orders (legacy, pre-governanca: SEM FK rigida, ref logica)
--   'avulso'     -> pedidos_pontuais (nossa: tambem SEM FK, por simetria do snapshot)
-- Exatamente UMA das duas origens preenchida por linha (check entregas_origem_exatamente_um).
--
-- Idempotencia do gerador: UNIQUE (semana_id, weekly_order_id) e
-- UNIQUE (semana_id, pedido_pontual_id). No Postgres NULL nao e igual a NULL em
-- UNIQUE, entao multiplos NULL convivem -> regerar nao duplica e cada origem entra
-- no maximo uma vez por ciclo.
--
-- RLS admin_all + trigger set_updated_at: padrao das tabelas de producao (0012).
--
-- Aplicar pelo SQL Editor do Supabase (NAO db push: historico local dessincronizado
-- com a CLI desde a 0018). Probes em 0026_entregas.verificacao.sql.

CREATE TABLE entregas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id          UUID NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,

  origem             TEXT NOT NULL CHECK (origem IN ('assinatura', 'avulso')),

  -- Refs logicas (SEM FK): weekly_orders e pre-governanca; pedidos_pontuais segue
  -- a simetria do snapshot. Exatamente uma preenchida (check abaixo).
  weekly_order_id    UUID,
  pedido_pontual_id  UUID,
  CONSTRAINT entregas_origem_exatamente_um CHECK (
    (weekly_order_id IS NOT NULL)::int + (pedido_pontual_id IS NOT NULL)::int = 1
  ),

  -- Snapshot do destinatario (congelado na geracao)
  nome               TEXT NOT NULL,
  whatsapp           TEXT,
  cep                TEXT,
  rua                TEXT NOT NULL,
  numero             TEXT,
  complemento        TEXT,
  bairro             TEXT NOT NULL,
  cidade             TEXT NOT NULL,
  regiao             TEXT NOT NULL CHECK (regiao IN ('niteroi', 'rio')),

  itens              JSONB NOT NULL,   -- array [{slug, nome, qty}]
  observacao         TEXT,             -- editavel na tela; nao existe na origem

  status             TEXT NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente', 'em_rota', 'entregue')),
  em_rota_at         TIMESTAMPTZ,
  entregue_at        TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (semana_id, weekly_order_id),
  UNIQUE (semana_id, pedido_pontual_id)
);

CREATE INDEX idx_entregas_semana ON entregas(semana_id);
CREATE INDEX idx_entregas_status ON entregas(status);

ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_entregas"
  ON entregas FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_entregas_updated_at
  BEFORE UPDATE ON entregas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
