-- ============================================================
-- Migration 0048 - tabela geracao_execucoes
-- ============================================================
-- Fase 3, bloco C (ligar o botao). Registro de execucao da geracao de
-- cobrancas: existe para ser a TRAVA contra duas geracoes simultaneas do mesmo
-- periodo.
--
-- POR QUE ELA PRECISA EXISTIR
-- --------------------------
-- O desfecho `criar` ja esta protegido pela constraint
-- (subscription_id, periodo_referencia): duas execucoes simultaneas disputam o
-- insert das faturas e a segunda leva 23505 ANTES de chamar o Asaas.
--
-- O `rechamar` NAO tem essa protecao, e nao pode ter: ele existe justamente
-- para o caso em que as faturas ja foram inseridas e so a chamada faltou,
-- entao ele nao insere nada. Duas execucoes simultaneas nesse estado criam
-- DUAS cobrancas para o mesmo grupo, e o segundo update sobrescreve o
-- asaas_payment_id do primeiro: fica uma cobranca orfa no Asaas — existente,
-- visivel para o assinante, e sem fatura que a referencie.
--
-- Registrado no BACKOFFICE_STATUS.md em 06/09 como pendencia do bloco C. Esta
-- e a resolucao.
--
-- POR QUE TABELA, E NAO ADVISORY LOCK
-- -----------------------------------
-- `pg_advisory_xact_lock` so vale dentro de uma transacao, e o PostgREST nao
-- da transacao entre chamadas. `pg_advisory_lock` (de sessao) morreria com o
-- pool de conexoes, sem garantia de qual conexao segura o que. A trava tem que
-- sobreviver a varias chamadas HTTP, entao ela e uma LINHA.
--
-- A exclusao mutua em si nao esta aqui: esta no indice parcial da 0049. Esta
-- migration so cria a tabela. Uma coisa por statement, como as anteriores.
--
-- SEM `updated_at` e SEM trigger: a linha e escrita duas vezes na vida (abre e
-- fecha) e `terminada_em` ja diz quando a segunda aconteceu.
--
-- `por` guarda o email do admin que disparou. E o unico jeito de responder
-- "quem gerou isso" quando a geracao de outubro for revisitada em novembro.
-- NOT NULL: o endpoint so chega aqui depois de autenticar contra admin_users,
-- entao nunca ha execucao sem dono.
--
-- `ok` e `erro` sao nullable de proposito: enquanto em voo nao ha desfecho.
-- Uma linha com terminada_em preenchida e ok = null e uma execucao que fechou
-- sem registrar desfecho — nao deve acontecer, e se acontecer e sintoma.
--
-- Aplicar pelo SQL Editor do Supabase (padrao 0019+).
-- Probes PRE/POS em 0048_geracao_execucoes.verificacao.sql.
--
-- Data: 2026-09-06
-- ============================================================

CREATE TABLE geracao_execucoes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_referencia text NOT NULL,
  por                text NOT NULL,
  iniciada_em        timestamptz NOT NULL DEFAULT now(),
  terminada_em       timestamptz NULL,
  ok                 boolean NULL,
  erro               text NULL
);
