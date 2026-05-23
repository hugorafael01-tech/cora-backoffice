-- ============================================================
-- Cora Backoffice — Migration 0016: janelas_entrega
-- Desacopla data_entrega / cutoff de `semanas`, introduzindo a
-- entidade "janela de entrega". MVP: 1 janela por semana (mesma
-- data e cutoff). Schema preparado pra N janelas/semana sem nova
-- migration (Rio/Niterói, capacidade dividida).
--
-- Pré-validado contra staging em 2026-05-20:
--   - 2 semanas (21 e 22/2026), ambas status 'congelada'
--   - 0 pedidos_pontuais (UPDATE no-op, SET NOT NULL seguro)
--   - 0 violações de data_entrega fora de [data_inicio, data_fim]
-- Ver Docs/CORA_Briefing_Backoffice_Janelas_Entrega.md.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enum de status da janela
-- ------------------------------------------------------------
CREATE TYPE janela_status_enum AS ENUM (
  'planejamento',   -- janela criada, sem produção atrelada ainda
  'congelada',      -- cutoff_at passou, pedidos fechados
  'em_expedicao',   -- dia da entrega, em rota
  'concluida',      -- todas entregas finalizadas
  'cancelada'       -- não vai rolar (feriado, problema operacional)
);

-- ------------------------------------------------------------
-- 2. Tabela janelas_entrega
--    (o range de data_entrega vira trigger no passo 5 — Postgres
--     não aceita subquery em CHECK constraint.)
-- ------------------------------------------------------------
CREATE TABLE janelas_entrega (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id         UUID NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,

  data_entrega      DATE NOT NULL,
  cutoff_at         TIMESTAMPTZ NOT NULL,   -- backfill copia de semanas.data_corte

  -- Identidade livre da janela (Hugo nomeia no futuro)
  label             TEXT NOT NULL DEFAULT 'Padrão',
  -- Ex.: "Padrão", "Niterói quinta", "Rio sexta", "Manhã", "Tarde"

  -- Reservados pra evolução, nullable no MVP
  regiao            TEXT,                   -- 'niteroi' | 'rio' | NULL
  capacidade_alvo   INTEGER,                -- meta de pedidos pra essa janela

  status            janela_status_enum NOT NULL DEFAULT 'planejamento',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_janelas_entrega_semana       ON janelas_entrega(semana_id);
CREATE INDEX idx_janelas_entrega_data_entrega ON janelas_entrega(data_entrega);
CREATE INDEX idx_janelas_entrega_status       ON janelas_entrega(status);

COMMENT ON TABLE janelas_entrega IS
  'Janela de entrega: data + cutoff desacoplados de semanas. 1 por semana no MVP, N no futuro (segmentação geográfica, capacidade dividida).';

-- ------------------------------------------------------------
-- 3. RLS — mesma política admin-only das demais tabelas operacionais
-- ------------------------------------------------------------
ALTER TABLE janelas_entrega ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_janelas_entrega"
  ON janelas_entrega FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ------------------------------------------------------------
-- 4. Trigger de updated_at (reutiliza set_updated_at() existente)
-- ------------------------------------------------------------
CREATE TRIGGER trg_janelas_entrega_updated_at
  BEFORE UPDATE ON janelas_entrega
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 5. Validação de range (substitui o CHECK com subquery do briefing)
--    data_entrega precisa cair dentro de [data_inicio, data_fim] da semana.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION valida_janela_dentro_semana()
RETURNS TRIGGER AS $$
DECLARE
  v_data_inicio DATE;
  v_data_fim    DATE;
BEGIN
  SELECT data_inicio, data_fim
    INTO v_data_inicio, v_data_fim
  FROM semanas
  WHERE id = NEW.semana_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Semana % não encontrada para a janela de entrega', NEW.semana_id;
  END IF;

  IF NEW.data_entrega < v_data_inicio OR NEW.data_entrega > v_data_fim THEN
    RAISE EXCEPTION
      'data_entrega % fora do intervalo da semana % (% a %)',
      NEW.data_entrega, NEW.semana_id, v_data_inicio, v_data_fim;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_valida_janela_dentro_semana
  BEFORE INSERT OR UPDATE ON janelas_entrega
  FOR EACH ROW EXECUTE FUNCTION valida_janela_dentro_semana();

-- ------------------------------------------------------------
-- 6. Backfill: 1 janela por semana existente.
--    Roda APÓS o trigger de validação (dados já confirmados limpos no
--    staging). Copia data_corte -> cutoff_at e mapeia o status textual
--    da semana para o enum da janela.
-- ------------------------------------------------------------
INSERT INTO janelas_entrega (semana_id, data_entrega, cutoff_at, label, status)
SELECT
  s.id,
  s.data_entrega,
  s.data_corte,
  'Padrão',
  CASE s.status
    WHEN 'rascunho'  THEN 'planejamento'::janela_status_enum
    WHEN 'aberta'    THEN 'planejamento'::janela_status_enum
    WHEN 'congelada' THEN 'congelada'::janela_status_enum
    WHEN 'concluida' THEN 'concluida'::janela_status_enum
    ELSE 'planejamento'::janela_status_enum
  END
FROM semanas s;

-- ------------------------------------------------------------
-- 7. Conectar pedidos_pontuais à janela
--    (staging hoje: 0 pedidos -> UPDATE é no-op; SET NOT NULL seguro)
-- ------------------------------------------------------------
ALTER TABLE pedidos_pontuais
  ADD COLUMN janela_entrega_id UUID REFERENCES janelas_entrega(id) ON DELETE RESTRICT;

UPDATE pedidos_pontuais p
SET janela_entrega_id = (
  SELECT je.id
  FROM janelas_entrega je
  WHERE je.semana_id = p.semana_id
  ORDER BY je.created_at
  LIMIT 1
);

ALTER TABLE pedidos_pontuais
  ALTER COLUMN janela_entrega_id SET NOT NULL;

CREATE INDEX idx_pedidos_pontuais_janela ON pedidos_pontuais(janela_entrega_id);

-- ------------------------------------------------------------
-- 8. Auto-criar janela padrão ao criar uma semana
--    (preserva o fluxo atual: toda semana nasce com 1 janela)
--    O trigger de validação (passo 5) garante que data_entrega da
--    semana esteja dentro do próprio range; senão o INSERT da semana
--    é rejeitado em cascata.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION cria_janela_padrao_para_semana()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO janelas_entrega (semana_id, data_entrega, cutoff_at, label)
  VALUES (NEW.id, NEW.data_entrega, NEW.data_corte, 'Padrão');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cria_janela_padrao
  AFTER INSERT ON semanas
  FOR EACH ROW EXECUTE FUNCTION cria_janela_padrao_para_semana();

-- ------------------------------------------------------------
-- 9. Marcar campos legados de semanas como DEPRECATED (não dropar)
--    Drop vira migration separada quando UI Semana/Produção/Pedidos
--    e Portal lerem todos de janelas_entrega.
-- ------------------------------------------------------------
COMMENT ON COLUMN semanas.data_entrega IS
  'DEPRECATED desde maio 2026. Usar janelas_entrega.data_entrega. Mantido por compatibilidade até todos os consumidores migrarem (Portal ainda lê este campo).';
COMMENT ON COLUMN semanas.data_corte IS
  'DEPRECATED desde maio 2026. Usar janelas_entrega.cutoff_at. Mantido por compatibilidade até todos os consumidores migrarem.';
