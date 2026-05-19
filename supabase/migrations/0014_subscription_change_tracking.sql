-- Migration: 0014_subscription_change_tracking
-- Origem: Frente C item 2 — Tela Sua Assinatura editável
-- Task ClickUp: 86e1ept7d
-- Data: 2026-05-19
--
-- Adiciona 2 colunas em subscriptions para rastrear mudanças de plano
-- agendadas (entram em vigor na próxima fatura mensal).
--
-- Modelo de cobrança decidido (Cenário A — Mês alinhado):
-- - Nova composição vale a partir da próxima entrega após cutoff (sem
--   alterar a próxima entrega já fechada).
-- - Valor mensal novo vale a partir do dia 01 do próximo mês.
-- - No MVP, Hugo atualiza o valor recorrente no Asaas manualmente após
--   o agendamento; as colunas servem para o frontend mostrar microcopy
--   "Vale a partir da entrega de DD/MM" e a linha futura na Cobrança.

ALTER TABLE subscriptions
  ADD COLUMN next_billing_change_date date NULL,
  ADD COLUMN next_billing_value numeric(10,2) NULL;

COMMENT ON COLUMN subscriptions.next_billing_change_date IS
  'Primeiro dia do mês >= today em que o valor recorrente novo passa a valer. NULL quando não há mudança pendente.';

COMMENT ON COLUMN subscriptions.next_billing_value IS
  'Valor mensal que a fatura recorrente vai assumir a partir de next_billing_change_date. NULL quando não há mudança pendente.';