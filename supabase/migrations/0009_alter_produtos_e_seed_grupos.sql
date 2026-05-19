-- ============================================================
-- Cora Backoffice — Migration 0009: tipo_cardapio em produtos + seed grupos
-- ============================================================

CREATE TYPE tipo_cardapio_enum AS ENUM ('base', 'fixo', 'rotativo');

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS tipo_cardapio tipo_cardapio_enum;

-- Seed dos tipos de cardápio (slugs validados em 18/mai/2026).
UPDATE produtos SET tipo_cardapio = 'base'
  WHERE slug IN ('original', 'integral') AND ativo = TRUE;

UPDATE produtos SET tipo_cardapio = 'rotativo'
  WHERE slug IN ('focaccia', 'multigraos', 'brioche', 'ciabatta') AND ativo = TRUE;

-- 'fixo' fica sem default — Hugo marca via UI quando algum produto virar
-- "sempre disponível como extra".

-- Seed dos grupos das receitas (corrige defaults — todos vêm como 2).
--   1 = G1 (frio — Focaccia)
--   2 = G2 (ferm. longa — Original)    [default da coluna]
--   3 = G3 (simples — Integral, Multigrãos)
-- Brioche e Ciabatta ficam no default (2) — decisão técnica pendente com Alex.
UPDATE receitas SET grupo_sugerido = 1
  WHERE produto_id IN (SELECT id FROM produtos WHERE slug = 'focaccia');

UPDATE receitas SET grupo_sugerido = 3
  WHERE produto_id IN (SELECT id FROM produtos WHERE slug IN ('integral', 'multigraos'));
