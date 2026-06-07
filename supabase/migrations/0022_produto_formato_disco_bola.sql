-- 0022_produto_formato_disco_bola.sql
-- Adiciona 'disco' e 'bola' ao enum produto_formato (formatos de venda da pizza).
--
-- GOTCHA (lição pro STATUS): ALTER TYPE ... ADD VALUE nao pode ser usado na MESMA
-- transacao em que o valor foi adicionado (Postgres). Por isso esta migration SO
-- adiciona os valores; o seed da Pizza que os USA fica na 0023, em transacao separada.
-- APLICAR 0022 PRIMEIRO, COMMITAR, e SO ENTAO 0023.

ALTER TYPE produto_formato ADD VALUE IF NOT EXISTS 'disco';
ALTER TYPE produto_formato ADD VALUE IF NOT EXISTS 'bola';

-- Verificacao:
--   SELECT enum_range(NULL::produto_formato);  -- deve listar disco e bola
