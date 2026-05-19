-- ============================================================
-- Cora Backoffice — Migration 0013: view planejamento_semana
-- ============================================================
-- Agrega quantidades por produto por semana a partir de 3 fontes:
--   1. weekly_orders.composition   (objeto { slug: qty }, qty=0 = removido)
--   2. weekly_orders.extras        (array [{ id, qty, ... }])
--   3. pedidos_pontuais.composicao (objeto { slug: qty })
-- Considera apenas registros 'confirmado'.

CREATE OR REPLACE VIEW planejamento_semana AS
WITH
  recorrentes_base AS (
    SELECT
      s.id AS semana_id,
      elem.key AS slug,
      (elem.value)::int AS qty
    FROM weekly_orders w
    JOIN semanas s ON w.delivery_date = s.data_entrega
    CROSS JOIN LATERAL jsonb_each_text(w.composition) AS elem
    WHERE w.status = 'confirmado'
      AND (elem.value)::int > 0
  ),
  recorrentes_extra AS (
    SELECT
      s.id AS semana_id,
      (elem->>'id') AS slug,
      (elem->>'qty')::int AS qty
    FROM weekly_orders w
    JOIN semanas s ON w.delivery_date = s.data_entrega
    CROSS JOIN LATERAL jsonb_array_elements(w.extras) AS elem
    WHERE w.status = 'confirmado'
      AND (elem->>'qty')::int > 0
  ),
  pontuais AS (
    SELECT
      p.semana_id,
      elem.key AS slug,
      (elem.value)::int AS qty
    FROM pedidos_pontuais p
    CROSS JOIN LATERAL jsonb_each_text(p.composicao) AS elem
    WHERE p.status = 'confirmado'
      AND (elem.value)::int > 0
  ),
  unified AS (
    SELECT semana_id, slug, qty, 'recorrente_base'  AS origem FROM recorrentes_base
    UNION ALL
    SELECT semana_id, slug, qty, 'recorrente_extra'           FROM recorrentes_extra
    UNION ALL
    SELECT semana_id, slug, qty, 'pontual'                    FROM pontuais
  )
SELECT
  semana_id,
  slug,
  SUM(qty)                                                              AS qty_total,
  COALESCE(SUM(qty) FILTER (WHERE origem = 'recorrente_base'),  0)       AS qty_recorrente_base,
  COALESCE(SUM(qty) FILTER (WHERE origem = 'recorrente_extra'), 0)       AS qty_recorrente_extra,
  COALESCE(SUM(qty) FILTER (WHERE origem = 'pontual'),          0)       AS qty_pontual
FROM unified
GROUP BY semana_id, slug;
