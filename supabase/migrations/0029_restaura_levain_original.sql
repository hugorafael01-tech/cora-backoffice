-- ============================================================
-- Migration 0029 - Restaura levain do Original v1
-- ============================================================
-- A 0028 usou DELETE+INSERT e removeu a linha de levain (ordem 0, 0.20)
-- que a 0021 criou. O trigger producoes_set_prevista depende dela para
-- calcular levain_previsto_kg. O blend de farinha da 0028 esta correto.
-- Esta migration so restaura o levain. Idempotente (ON CONFLICT DO NOTHING).
-- ============================================================

DO $$
DECLARE
  v_versao_id UUID;
BEGIN
  SELECT vr.id INTO v_versao_id
  FROM versoes_receita vr
  JOIN receitas r ON vr.receita_id = r.id
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'original' AND vr.numero_versao = 1;

  IF v_versao_id IS NULL THEN
    RAISE EXCEPTION 'Versao 1 da receita Original nao encontrada';
  END IF;

  INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
  SELECT v_versao_id, i.id, 0.20, 0, 'Prefermento. Build 1:2:2. Restaurado apos remocao indevida na 0028.'
  FROM ingredientes i WHERE i.slug = 'levain'
  ON CONFLICT (versao_receita_id, ingrediente_id) DO NOTHING;
END $$;
