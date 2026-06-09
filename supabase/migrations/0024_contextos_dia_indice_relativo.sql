-- 0024_contextos_dia_indice_relativo.sql
-- B2a: contextos_dia.dia deixa de ser dia-da-semana e vira INDICE RELATIVO
-- (contagem regressiva ate a entrega: D0=entrega, D1=vespera, D2=2 dias antes).
--
-- Motivacao: o CHECK (dia IN ('terca','quarta','quinta')) da 0012 era o UNICO lock
-- de dia-da-semana no schema. Trocar por indice relativo destrava ciclos comecando
-- em qualquer dia, de 2 a N dias, e feriados. O frontend deriva o rotulo das datas.
--
-- Tambem dropa as 2 colunas de temperatura mortas de contextos_producao: a temperatura
-- passou a viver em etapas_producao.temp_c na B1 (por etapa). Mante-las aqui seria
-- entrada dupla. Nenhum codigo funcional referencia essas colunas (verificado).
--
-- Aplicar pelo SQL Editor do Supabase (NAO db push: historico local dessincronizado
-- com a CLI desde a 0018). Probes em 0024_contextos_dia_indice_relativo.verificacao.sql.

-- contextos_dia.dia: dia-da-semana (terca/quarta/quinta) -> indice relativo.
-- O CHECK inline da 0012 tem o auto-nome padrao do Postgres: contextos_dia_dia_check.
ALTER TABLE contextos_dia DROP CONSTRAINT contextos_dia_dia_check;

ALTER TABLE contextos_dia
  ALTER COLUMN dia TYPE INT USING (
    CASE dia WHEN 'quinta' THEN 0 WHEN 'quarta' THEN 1 WHEN 'terca' THEN 2 END
  );

ALTER TABLE contextos_dia ADD CONSTRAINT contextos_dia_dia_check CHECK (dia >= 0);

-- UNIQUE (semana_id, dia) sobrevive a troca de tipo (o indice reconstroi sozinho).

-- contextos_producao: dropar as colunas de temp mortas (temp vive em etapa.temp_c, B1).
ALTER TABLE contextos_producao DROP COLUMN temp_agua_autolise_c;
ALTER TABLE contextos_producao DROP COLUMN temp_massa_pos_batimento_c;
