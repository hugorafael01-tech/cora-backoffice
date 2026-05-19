-- ============================================================
-- Cora Backoffice — Migration 0007: policies admin em tabelas do Portal
-- ============================================================
-- Tabelas alvo: app_settings, capacity_waitlist, weekly_orders.
-- Todas têm policy "deny all" do Portal. RLS aplica policies em OR,
-- então adicionar admin_read_* não bloqueia o Portal (que usa service role).
-- Idempotente via DROP IF EXISTS + CREATE.

ALTER TABLE app_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacity_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_orders     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_app_settings"      ON app_settings;
CREATE POLICY "admin_read_app_settings"
  ON app_settings FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "admin_read_capacity_waitlist" ON capacity_waitlist;
CREATE POLICY "admin_read_capacity_waitlist"
  ON capacity_waitlist FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "admin_read_weekly_orders"     ON weekly_orders;
CREATE POLICY "admin_read_weekly_orders"
  ON weekly_orders FOR SELECT TO authenticated
  USING (is_admin());
