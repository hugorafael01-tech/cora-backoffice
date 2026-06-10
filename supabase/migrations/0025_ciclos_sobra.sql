-- 0025_ciclos_sobra.sql
-- P1a: a producao deixa de ser 1 ciclo por semana ISO e passa a CICLOS — N por
-- semana, sobrepostos, com entrega em qualquer dia. A identidade do ciclo vira a
-- data_entrega; numero/ano de semanas viram informativos (nao mais identidade).
--
-- Motivacao: o UNIQUE (numero, ano) era a UNICA trava de schema amarrando 1 ciclo
-- por semana ISO. Removido, varios ciclos podem coexistir na mesma semana ISO.
--
-- Carona: persiste a sobra desejada de levain por ciclo (g). Hoje e useState(400)
-- local na tela de volume; vira coluna pra sobreviver a reload e virar fonte unica
-- (a UI passa a ler/gravar isso na P1b).
--
-- Aplicar pelo SQL Editor do Supabase (NAO db push: historico local dessincronizado
-- com a CLI desde a 0018). Probes em 0025_ciclos_sobra.verificacao.sql.
--
-- ATENCAO: o DROP abaixo assume o auto-nome padrao do Postgres pra UNIQUE (numero,
-- ano): semanas_numero_ano_key. Se o PRE.1 da verificacao revelar outro nome,
-- ajustar este arquivo antes de aplicar (fail loud, padrao 0024).

-- Ciclos: remove a trava de 1 ciclo por semana ISO.
ALTER TABLE semanas DROP CONSTRAINT semanas_numero_ano_key;

-- Sobra desejada de levain por ciclo (g). Default 400 espelha o useState atual.
ALTER TABLE semanas ADD COLUMN sobra_levain_g NUMERIC NOT NULL DEFAULT 400
  CHECK (sobra_levain_g >= 0);
