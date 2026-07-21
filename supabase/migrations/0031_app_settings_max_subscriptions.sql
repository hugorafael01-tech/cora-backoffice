-- ============================================================
-- Migration 0031 - Capacidade maxima de assinaturas (app_settings)
-- ============================================================
-- Decisao de produto (20/07/2026): o gate de assinaturas era binario
-- (app_settings.subscriptions_open). Passa a ser uma trava de capacidade:
-- o Portal (repo cora-portal) conta assinaturas ocupadas e fecha sozinho
-- ao bater o limite. Este repo (Backoffice) so cria o schema; o
-- enforcement e client-side no Portal (api/subscriptions), NAO ha
-- trigger nem CHECK aqui.
--
-- Semantica de max_subscriptions: capacidade total de assinaturas
-- OCUPADAS, contando subscriptions.status IN ('active', 'pending_payment').
-- Default 30.
--
-- app_settings e tabela legacy/orfa (fora de schema_migrations, ver
-- BACKOFFICE_STATUS.md "Tabelas legacy NAO mexer") — coluna nova aqui e
-- excecao deliberada porque a coluna irma subscriptions_open ja vive
-- nessa mesma tabela e o Portal ja le de la; abrir tabela nova so pra
-- este campo forcaria o Portal a consultar duas fontes pro mesmo gate.
--
-- Aplicar pelo SQL Editor do Supabase (padrao 0019+: historico local
-- dessincronizado da CLI, db push nao enxerga migrations novas como
-- pendentes). Probes PRE/POS em
-- 0031_app_settings_max_subscriptions.verificacao.sql.

ALTER TABLE app_settings
  ADD COLUMN max_subscriptions integer NOT NULL DEFAULT 30;
