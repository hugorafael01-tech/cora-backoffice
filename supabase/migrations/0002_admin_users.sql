-- ============================================================
-- Cora Backoffice — Migration 0002: admin_users
-- ============================================================

CREATE TABLE admin_users (
  email       TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Função helper para checar se o usuário autenticado é admin.
-- Usada em todas as RLS policies do Backoffice.
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE email = auth.jwt()->>'email'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS: admin_users só pode ser lida por admins (referência circular resolvida
-- por SECURITY DEFINER acima).
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_users select" ON admin_users
  FOR SELECT TO authenticated
  USING (is_admin());

-- Seed inicial: Hugo. Trocar para hugo@acora.com.br quando o Workspace ativar.
INSERT INTO admin_users (email, nome) VALUES
  ('hugorafael01@gmail.com', 'Hugo Rafael');
