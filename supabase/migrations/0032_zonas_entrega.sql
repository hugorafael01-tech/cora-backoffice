-- 0032_zonas_entrega.sql
-- Zonas de entrega + sequenciamento por onda (briefing de logistica 17/08/2026).
--
-- Dois conceitos DIFERENTES, os dois vao pra etiqueta, nenhum substitui o outro:
--   ZONA      e estavel, vive no CADASTRO (subscriptions / pedidos_pontuais).
--             Agrupa a montagem e diz em que bag o pacote vai.
--   SEQUENCIA e semanal, vive na EXPEDICAO (entregas). Ordena as paradas dentro
--             da onda e a ordem de carregamento da bag.
--
-- Por que a zona NAO pode ser derivada do bairro em tempo de execucao: Lagoa
-- aparece em R1 e em R3 (um dos enderecos e quase Jardim Botanico). A
-- `bairro_zona_default` existe SO pra SUGERIR o valor no cadastro; o valor
-- gravado em subscriptions.zona / pedidos_pontuais.zona e a fonte da verdade.
--
-- Por que NAO ha enum de zonas (pedido explicito do briefing): as zonas mudam
-- quando a operacao cresce. `zonas_entrega` e tabela de dados; as colunas `zona`
-- sao FK pra ela com ON UPDATE CASCADE, entao criar zona nova = INSERT e
-- renomear codigo = UPDATE, sem migration.
--
-- Governanca: `subscriptions` e legacy (Portal-era). Esta migration so ACRESCENTA
-- coluna nullable, mesmo padrao expand-only das 0017/0018/0020 — nao repara nem
-- reformata o shape legado. `entregas` ganha so as duas colunas novas
-- (zona snapshot + sequencia): CHECKs, UNIQUEs, origem e a semantica do gerador
-- ficam intocados.
--
-- Aplicar pelo SQL Editor do Supabase (padrao 0019+: historico local
-- dessincronizado da CLI, db push nao enxerga migrations novas como pendentes).
-- Probes PRE/POS em 0032_zonas_entrega.verificacao.sql.


-- ============================================================
-- 1) normalizacao de texto (espelha src/lib/normalize.ts)
-- ============================================================
-- IMMUTABLE de proposito: `unaccent` nao esta instalado neste projeto e, mesmo
-- instalado, e STABLE (depende de dicionario) — nao serve pra indice de
-- expressao. `translate` cobre os diacriticos que aparecem em bairro/cidade
-- daqui ("Icarai"/"Icaraí", "Niteroi"/"Niterói", "Gloria"/"Glória").
CREATE OR REPLACE FUNCTION normaliza_texto(t TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT lower(btrim(translate(
    t,
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
    'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'
  )));
$$;


-- ============================================================
-- 2) zonas_entrega — cadastro das zonas
-- ============================================================
CREATE TABLE zonas_entrega (
  codigo        TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  cidade        TEXT NOT NULL,

  -- Onda de rota. H mora em Niteroi mas nao viaja na bag: quem controla isso e
  -- `entra_na_onda`, nao o codigo — codigo literal em codigo de aplicacao seria
  -- a rigidez que o briefing pediu pra evitar.
  onda          TEXT NOT NULL CHECK (onda IN ('niteroi', 'rio')),
  ordem         INTEGER NOT NULL,          -- sequencia das zonas dentro da onda

  -- A FORMA e obrigatoria e a COR e complementar: a impressora atual e colorida,
  -- a proxima sera termica monocromatica. O layout tem que sobreviver a troca.
  cor_hex       TEXT NOT NULL CHECK (cor_hex ~ '^#[0-9A-Fa-f]{6}$'),
  forma         TEXT NOT NULL CHECK (forma IN ('circulo', 'triangulo', 'quadrado', 'losango', 'hexagono')),

  -- false = entrega propria: nao entra na numeracao da onda nem conta pra
  -- capacidade da bag.
  entra_na_onda BOOLEAN NOT NULL DEFAULT true,
  ativo         BOOLEAN NOT NULL DEFAULT true,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (onda, ordem)
);

ALTER TABLE zonas_entrega ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_zonas_entrega"
  ON zonas_entrega FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_zonas_entrega_updated_at
  BEFORE UPDATE ON zonas_entrega
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Zonas vigentes em 17/08/2026 (briefing). Cores/formas sao um ponto de partida:
-- Niteroi em tons frios, Rio em tons quentes, forma unica DENTRO de cada onda.
-- Editar por UPDATE, nao por migration.
INSERT INTO zonas_entrega (codigo, nome, cidade, onda, ordem, cor_hex, forma, entra_na_onda) VALUES
  ('H',  'Entrega própria',                          'Niterói',        'niteroi', 0, '#111827', 'hexagono',  false),
  ('N1', 'Fonseca / Vital Brazil',                   'Niterói',        'niteroi', 1, '#2563EB', 'circulo',   true),
  ('N2', 'São Francisco / Charitas',                 'Niterói',        'niteroi', 2, '#0D9488', 'triangulo', true),
  ('N3', 'Icaraí / Boa Viagem',                      'Niterói',        'niteroi', 3, '#7C3AED', 'quadrado',  true),
  ('R1', 'Cosme Velho / Lagoa / Humaitá',            'Rio de Janeiro', 'rio',     1, '#EA580C', 'circulo',   true),
  ('R2', 'Botafogo / Flamengo / Glória',             'Rio de Janeiro', 'rio',     2, '#DC2626', 'triangulo', true),
  ('R3', 'Urca / Copacabana / Lagoa (JB) / Gávea',   'Rio de Janeiro', 'rio',     3, '#CA8A04', 'quadrado',  true);


-- ============================================================
-- 3) bairro_zona_default — SUGESTAO por bairro (nao e a fonte da verdade)
-- ============================================================
CREATE TABLE bairro_zona_default (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade     TEXT NOT NULL,
  bairro     TEXT NOT NULL,
  zona       TEXT NOT NULL REFERENCES zonas_entrega(codigo) ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cidade, bairro)
);

-- Impede "Icaraí" e "Icarai" convivendo como sugestoes diferentes: o cadastro
-- vem digitado a mao e os dados de hoje ja tem as duas grafias.
CREATE UNIQUE INDEX ux_bairro_zona_default_normalizado
  ON bairro_zona_default (normaliza_texto(cidade), normaliza_texto(bairro));

ALTER TABLE bairro_zona_default ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_bairro_zona_default"
  ON bairro_zona_default FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_bairro_zona_default_updated_at
  BEFORE UPDATE ON bairro_zona_default
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Lagoa entra so uma vez, como R1 (2 dos 3 enderecos de hoje). O endereco do
-- lado do Jardim Botanico e R3 e vira override no cadastro — e exatamente o
-- caso que prova que sugestao != fonte da verdade.
INSERT INTO bairro_zona_default (cidade, bairro, zona) VALUES
  ('Niterói',        'Fonseca',       'N1'),
  ('Niterói',        'Vital Brazil',  'N1'),
  ('Niterói',        'São Francisco', 'N2'),
  ('Niterói',        'Charitas',      'N2'),
  ('Niterói',        'Icaraí',        'N3'),
  ('Niterói',        'Boa Viagem',    'N3'),
  ('Rio de Janeiro', 'Cosme Velho',   'R1'),
  ('Rio de Janeiro', 'Lagoa',         'R1'),
  ('Rio de Janeiro', 'Humaitá',       'R1'),
  ('Rio de Janeiro', 'Botafogo',      'R2'),
  ('Rio de Janeiro', 'Flamengo',      'R2'),
  ('Rio de Janeiro', 'Glória',        'R2'),
  ('Rio de Janeiro', 'Urca',          'R3'),
  ('Rio de Janeiro', 'Copacabana',    'R3'),
  ('Rio de Janeiro', 'Gávea',         'R3');


-- ============================================================
-- 4) coluna `zona` no cadastro (expand-only, nullable)
-- ============================================================
-- ATENCAO ao nome: `subscriptions` JA TEM uma coluna `zona_entrega`, legacy
-- Portal-era, que na pratica guarda o BAIRRO ("Icaraí", "Botafogo") — nao a zona
-- de rota. Ela nao e tocada aqui: renomear/reaproveitar coluna legado e
-- exatamente o "reparar legado" que a governanca proibe, e o Portal escreve
-- nela. `zona` (nova) e o codigo de zona de rota; `zona_entrega` (velha) e
-- bairro com nome infeliz. Nao confundir na hora de ler.
ALTER TABLE subscriptions
  ADD COLUMN zona TEXT REFERENCES zonas_entrega(codigo) ON UPDATE CASCADE;

ALTER TABLE pedidos_pontuais
  ADD COLUMN zona TEXT REFERENCES zonas_entrega(codigo) ON UPDATE CASCADE;


-- ============================================================
-- 5) entregas: zona (snapshot) + sequencia (ordem na onda)
-- ============================================================
-- `zona` aqui e SNAPSHOT, igual a nome/endereco/itens: congela o que valia na
-- geracao. Por isso e ref logica SEM FK, mesmo criterio da 0026 pras outras
-- refs de snapshot — apagar uma zona nao pode reescrever historico de entrega.
ALTER TABLE entregas ADD COLUMN zona TEXT;

-- Ordem da parada DENTRO da onda (1..n). Sempre contigua; a etiqueta imprime
-- 'N-07' / 'R-07' derivando o prefixo da onda da zona. NULL = ainda nao
-- sequenciada (zona 'H' e entregas sem zona conhecida podem ficar NULL).
ALTER TABLE entregas ADD COLUMN sequencia INTEGER
  CONSTRAINT entregas_sequencia_positiva CHECK (sequencia IS NULL OR sequencia > 0);

CREATE INDEX idx_entregas_semana_sequencia ON entregas(semana_id, sequencia);


-- ============================================================
-- 6) capacidade de transporte (comparacao por onda na tela de expedicao)
-- ============================================================
-- Nullable de proposito: nenhum numero real de capacidade de bag foi informado,
-- e chutar um faria a tela alertar (ou deixar de alertar) por invencao. Enquanto
-- for NULL a tela mostra so o total de pacotes, sem comparacao.
-- Configurar com: UPDATE app_settings SET capacidade_bag = <n> WHERE id = 1;
ALTER TABLE app_settings ADD COLUMN capacidade_bag INTEGER
  CONSTRAINT app_settings_capacidade_bag_positiva CHECK (capacidade_bag IS NULL OR capacidade_bag > 0);


-- ============================================================
-- 7) backfill do cadastro a partir da sugestao por bairro
-- ============================================================
-- Match tolerante a acento/caixa: o cadastro tem "Icaraí" e "Icarai",
-- "Niterói" e "Niteroi".
UPDATE subscriptions s
SET zona = d.zona
FROM bairro_zona_default d
WHERE s.zona IS NULL
  AND normaliza_texto(s.cidade) = normaliza_texto(d.cidade)
  AND normaliza_texto(s.bairro) = normaliza_texto(d.bairro);

UPDATE pedidos_pontuais p
SET zona = d.zona
FROM bairro_zona_default d
WHERE p.zona IS NULL
  AND normaliza_texto(p.endereco_cidade) = normaliza_texto(d.cidade)
  AND normaliza_texto(p.endereco_bairro) = normaliza_texto(d.bairro);


-- ============================================================
-- 8) OVERRIDES MANUAIS — PREENCHER ANTES DE RODAR (Hugo)
-- ============================================================
-- O backfill do bloco 7 acerta 29 dos 30 assinantes ativos por construcao, mas
-- NAO tem como acertar dois casos. Nenhum dos dois pode ser adivinhado por
-- codigo: o desenho de rota e do Hugo.
--
-- (a) ZONA H — entrega propria. A tabela do briefing diz H = 1 parada e N1 = 2
--     paradas, mas Fonseca + Vital Brazil tem 3 assinantes ativos hoje. Um dos
--     tres mora na rua do Hugo e e H, nao N1:
--       Abdala Farah — Rua Riodades, 145 (Fonseca)
--       Douglas      — Travessa Ari Pinto Lima, 41 (Fonseca)
--       Geísa        — Rua Vital Brasil Filho, 35 (Vital Brazil)
--
-- (b) LAGOA lado Jardim Botanico — R3, nao R1. Os tres enderecos de Lagoa hoje:
--       Suzana       — Rua Frei Leandro, 26   (a rua que sai no Jardim Botanico)
--       Bruno Israel — Rua Sacopã, 250
--       Luiza        — Rua Sacopã, 499
--
-- Descomentar e completar. Sem isso, (a) sai como N1 e (b) sai como R1 — a
-- etiqueta imprime, mas com a zona errada.
--
-- UPDATE subscriptions SET zona = 'H'  WHERE nome = '<quem mora na sua rua>';
-- UPDATE subscriptions SET zona = 'R3' WHERE nome = '<quem e lado Jardim Botanico>';


-- ============================================================
-- 9) backfill do snapshot das entregas ja geradas
-- ============================================================
-- So preenche o que esta vazio; nunca reescreve zona ja gravada na entrega.
-- Ciclos em voo (semana 34, entrega 20/08) passam a imprimir a marca de zona
-- sem precisar regerar. A SEQUENCIA nao e backfillada aqui de proposito: quem
-- atribui e o "Atribuir sequência" / "Atualizar da demanda" da tela, pra a regra
-- de ordenacao viver num lugar so (src/lib/zonas.ts) em vez de duplicada em SQL.
UPDATE entregas e
SET zona = s.zona
FROM subscriptions s
WHERE e.subscription_id = s.id
  AND e.zona IS NULL
  AND s.zona IS NOT NULL;

UPDATE entregas e
SET zona = p.zona
FROM pedidos_pontuais p
WHERE e.pedido_pontual_id = p.id
  AND e.zona IS NULL
  AND p.zona IS NOT NULL;
