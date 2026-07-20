-- 0030_entregas_subscription_baseline.sql
-- Decisao de produto (20/07/2026): entrega por BASELINE da assinatura. Todo
-- assinante com subscriptions.status='active' recebe a composicao base
-- (qty_original + qty_integral) toda semana, sem precisar de acao nenhuma. O
-- weekly_order CONFIRMADO passa a ser o UNICO override valido (composicao
-- custom E extras); rascunho nao vale nada — nem composicao nem extras — cai
-- no baseline puro. pending_payment/paused/cancelled nao recebem.
-- payment_status='vencido' nao corta entrega (fora de escopo desta migration).
--
-- entregas (0026) exigia weekly_order_id como ancora da linha de assinatura —
-- assinante sem weekly_order nunca gerava entrega. Este ALTER da a entrega uma
-- ancora direta em subscriptions; weekly_order_id vira referencia OPCIONAL
-- (so presente quando houve override confirmado).
--
-- Aplicar pelo SQL Editor do Supabase (padrao 0019+: historico local
-- dessincronizado da CLI, db push nao enxerga migrations novas como
-- pendentes). Probes PRE/POS em 0030_entregas_subscription_baseline.verificacao.sql.

-- 1) nova coluna: ancora direta na assinatura (ref logica com FK — subscriptions
--    e legacy mas ja tem PK estavel; diferente de weekly_orders/pedidos_pontuais,
--    que ficaram sem FK na 0026 por serem pre-governanca / snapshot).
ALTER TABLE entregas ADD COLUMN subscription_id UUID REFERENCES subscriptions(id);

-- 2) backfill: toda linha origem='assinatura' existente ate aqui nasceu de um
--    weekly_order confirmado (regra antiga), entao sempre ha correspondencia.
UPDATE entregas e
SET subscription_id = wo.subscription_id
FROM weekly_orders wo
WHERE e.weekly_order_id = wo.id
  AND e.origem = 'assinatura'
  AND e.subscription_id IS NULL;

-- 3) novo CHECK: exatamente-um entre subscription_id e pedido_pontual_id.
--    weekly_order_id sai do CHECK (vira opcional, ver comentario acima).
ALTER TABLE entregas DROP CONSTRAINT entregas_origem_exatamente_um;
ALTER TABLE entregas ADD CONSTRAINT entregas_origem_exatamente_um CHECK (
  (subscription_id IS NOT NULL)::int + (pedido_pontual_id IS NOT NULL)::int = 1
);

-- 4) idempotencia do gerador pra linhas de assinatura: UNIQUE (semana_id,
--    subscription_id) — full constraint, NAO parcial. Mesmo padrao da 0026 pra
--    weekly_order_id/pedido_pontual_id: no Postgres NULL <> NULL em UNIQUE,
--    entao linhas de avulso (subscription_id sempre NULL) convivem sem precisar
--    de indice parcial. Isso importa pro upsert: `ON CONFLICT (semana_id,
--    subscription_id)` do supabase-js so acha um indice UNIQUE nao-parcial como
--    arbitro (inferencia de indice unico ignora indices parciais a menos que o
--    ON CONFLICT declare o mesmo WHERE, o que o client nao expressa) — um
--    UNIQUE INDEX ... WHERE subscription_id IS NOT NULL quebraria o upsert de
--    expedicaoActions.ts. Full constraint entrega a mesma idempotencia sem esse
--    risco.
ALTER TABLE entregas ADD CONSTRAINT entregas_semana_subscription_key UNIQUE (semana_id, subscription_id);

-- UNIQUE (semana_id, pedido_pontual_id) da 0026 mantido sem alteracao.
