-- ============================================================
-- Cora Backoffice — Migration 0003: view_assinatura_itens
-- ============================================================

-- Desagrega subscriptions.itens (JSONB no formato {slug: qty}) em rows.
-- Permite queries do tipo "quantos Originais ativos" sem mexer em JSONB.
CREATE VIEW v_assinatura_itens AS
SELECT
  s.id          AS subscription_id,
  s.bairro,
  s.cidade,
  s.cep,
  s.status,
  produto_slug,
  quantidade::INT AS quantidade
FROM subscriptions s,
LATERAL jsonb_each_text(s.itens) AS t(produto_slug, quantidade)
WHERE quantidade::INT > 0;

-- RLS na view: herda da subscriptions (RLS de tabela base aplica).
-- Mas como subscriptions tem deny-all pra public, vamos adicionar
-- policy de admin pra Backoffice ler.
CREATE POLICY "subscriptions admin read" ON subscriptions
  FOR SELECT TO authenticated
  USING (is_admin());
