-- Migration 0017: add user_id to subscriptions
-- Habilita autenticação real no Portal do Assinante via Supabase Auth
-- Data: 23/05/2026

-- 1. Adiciona coluna user_id como FK pra auth.users
ALTER TABLE public.subscriptions
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Index pra performance em lookups por dono
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id)
WHERE user_id IS NOT NULL;

-- 3. RLS policy: usuário autenticado lê sua própria subscription
CREATE POLICY "subscriptions_select_own"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 4. RLS policy: usuário autenticado atualiza sua própria subscription
CREATE POLICY "subscriptions_update_own"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Comentário documental
COMMENT ON COLUMN public.subscriptions.user_id IS
  'FK para auth.users. NULLABLE até cutover do auth real (ago/2026). '
  'Subscriptions criadas via fluxo de onboarding novo já populam essa coluna.';
