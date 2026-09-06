-- ============================================================
-- Verificacao da Migration 0049 (indice parcial: uma em voo por periodo)
-- — rodar no SQL Editor
-- ============================================================
-- IMPORTANTE: rode UMA query por vez (o SQL Editor so mostra o ultimo SELECT).
-- ============================================================


-- ============================================================
-- PRE (rodar ANTES de aplicar)
-- ============================================================

-- PRE.1 — a 0048 ja tem que estar aplicada (esperado: 1 linha)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'geracao_execucoes';

-- PRE.2 — o indice ainda NAO deve existir (esperado: 0 linhas)
SELECT indexname
FROM pg_indexes
WHERE tablename = 'geracao_execucoes' AND indexname = 'geracao_execucoes_uma_em_voo';


-- ============================================================
-- POS (rodar DEPOIS de aplicar)
-- ============================================================

-- POS.1 — o indice existe E e parcial (esperado: 1 linha, e a definicao tem
--   que terminar em "WHERE (terminada_em IS NULL)". Se o WHERE nao aparecer, o
--   indice ficou UNIQUE total e a segunda geracao legitima do periodo ficaria
--   impossivel — nao siga.)
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'geracao_execucoes' AND indexname = 'geracao_execucoes_uma_em_voo';

-- POS.2 — PROVA DE COMPORTAMENTO, desfeita no fim.
--   Rode o bloco INTEIRO de uma vez. Ele abre transacao, insere duas execucoes
--   em voo do mesmo periodo, e a segunda TEM que falhar com 23505
--   (unique_violation). O ROLLBACK desfaz tudo.
--
--   Esperado: erro "duplicate key value violates unique constraint
--   geracao_execucoes_uma_em_voo". O erro AQUI e o sucesso do teste.
BEGIN;
  INSERT INTO geracao_execucoes (periodo_referencia, por)
  VALUES ('2099-01', 'probe@acora.com.br');

  INSERT INTO geracao_execucoes (periodo_referencia, por)
  VALUES ('2099-01', 'probe@acora.com.br');
ROLLBACK;

-- POS.3 — o inverso: com a primeira ENCERRADA, a segunda entra. E o caso da
--   segunda tentativa legitima depois de um erro resolvido.
--   Esperado: nenhum erro, e o SELECT no fim mostra 2 linhas.
BEGIN;
  INSERT INTO geracao_execucoes (periodo_referencia, por, terminada_em, ok)
  VALUES ('2099-01', 'probe@acora.com.br', now(), false);

  INSERT INTO geracao_execucoes (periodo_referencia, por)
  VALUES ('2099-01', 'probe@acora.com.br');

  SELECT periodo_referencia, terminada_em, ok FROM geracao_execucoes;
ROLLBACK;

-- POS.4 — nada sobrou das provas (esperado: 0)
SELECT count(*) AS linhas FROM geracao_execucoes;
