# Briefing Claude Code — Janelas de Entrega (design defensivo)

*Schema desacoplamento de `data_entrega` da `semanas`. Maio 2026.*

**Repositório:** `cora-backoffice`
**Branch sugerida:** `feat/janelas-entrega` (a partir de `main` atualizada)
**Escopo:** migration única + atualização de documentação do schema. Sem mudança em UI nem em código de aplicação ainda.

---

## Contexto

Hoje o schema acopla a entrega na semana:

```sql
CREATE TABLE semanas (
  ...
  data_entrega   date NOT NULL,        -- ← uma data por semana
  cutoff_at      timestamptz NOT NULL, -- ← um cutoff por semana
  ...
);
```

Isso travaria evoluções já previstas:

- Rio quinta, Niterói sexta (segmentação geográfica)
- Capacidade dividida em dias quando o volume de assinantes não couber numa fornada/expedição só

Como a Fase 1 Etapa 0 (schema) acabou de fechar e a UI Semana ainda não foi construída em cima desses campos, este é o último momento barato pra desacoplar. Refatorar depois (com UI Semana, UI Produção, UI Pedidos e Portal lendo `semanas.data_entrega`) seria 3 a 5 dias de trabalho com risco operacional. Fazer agora é uma migration.

**Princípio:** schema rígido envelhece, schema desacoplado escala. A flexibilidade futura (Rio/Niterói, capacidade dividida) vira `INSERT` de linha, não migration.

---

## Objetivo

Introduzir o conceito de **janela de entrega** como entidade própria, ligada à semana. No MVP segue funcionando como hoje (uma janela por semana, mesma data e cutoff). Mas o schema fica preparado pra N janelas por semana sem migration adicional.

**O que muda no comportamento visível:** nada. Portal e Backoffice continuam mostrando "Quinta, 21/05" e cutoff "Terça 12h". Internamente vem da janela, não da semana.

---

## Pré-requisito de leitura (CC executa antes de propor plano)

Rodar e me trazer no chat antes de codar:

```sql
-- Estrutura completa de pedidos_pontuais
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pedidos_pontuais'
ORDER BY ordinal_position;

-- FKs que apontam pra semanas
SELECT
  tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'semanas';

-- Conteúdo atual de semanas (pra dimensionar backfill)
SELECT id, iso_year, iso_week, data_entrega, cutoff_at, status FROM semanas ORDER BY data_entrega;
```

Sem esses resultados, não dá pra finalizar o SQL da migration (especialmente o trecho de `pedidos_pontuais.janela_entrega_id` e o backfill).

---

## Escopo

### Dentro

- Criar tabela `janelas_entrega`
- Criar enum `janela_status_enum`
- Backfill: 1 janela por semana existente, copiando `data_entrega` e `cutoff_at`
- Adicionar `janela_entrega_id` em `pedidos_pontuais` (NOT NULL após backfill)
- Trigger ou função pra gerar 1 janela automaticamente ao criar uma `semana` (mantém comportamento atual sem fricção)
- Marcar `semanas.data_entrega` e `semanas.cutoff_at` como **DEPRECATED** em comentário SQL (não dropar agora)
- Atualizar `CORA_Briefing_Backoffice_Fase1_Schema_v3.md` com a nova entidade

### Fora

- UI no Backoffice pra gerenciar janelas (vem só quando o segundo cenário virar real)
- Alteração em Portal (Portal lê via cadeia subscription → semana → data, continua funcionando enquanto `semanas.data_entrega` existe como deprecated)
- Alteração em `subscriptions` (não ganha `janela_padrao_id` agora — vem quando o ciclo da assinatura for materializado em pedidos semanais)
- Drop dos campos deprecated em `semanas` (vira migration separada depois que todos os consumidores migrarem)
- Lógica de capacidade por janela
- Lógica de roteamento (assinante → janela por região)

---

## Schema proposto

```sql
-- ============================================================
-- Migration: 00XX_janelas_entrega.sql
-- Cria a entidade janela_entrega, desacoplando data/cutoff de semanas.
-- ============================================================

-- 1. Enum de status
CREATE TYPE janela_status_enum AS ENUM (
  'planejamento',   -- janela criada, sem produção atrelada ainda
  'congelada',      -- cutoff_at passou, pedidos fechados
  'em_expedicao',   -- dia da entrega, em rota
  'concluida',      -- todas entregas finalizadas
  'cancelada'       -- não vai rolar (feriado, problema operacional)
);

-- 2. Tabela
CREATE TABLE janelas_entrega (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id         uuid NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,

  data_entrega      date NOT NULL,
  cutoff_at         timestamptz NOT NULL,

  -- Identidade da janela (livre, pra Hugo nomear no futuro)
  label             text NOT NULL DEFAULT 'Padrão',
  -- Ex: "Padrão", "Niterói quinta", "Rio sexta", "Manhã", "Tarde"

  -- Reservados pra evolução, nullable no MVP
  regiao            text,                     -- 'niteroi' | 'rio' | NULL
  capacidade_alvo   integer,                  -- meta de pedidos pra essa janela

  status            janela_status_enum NOT NULL DEFAULT 'planejamento',

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT janelas_entrega_data_dentro_semana
    CHECK (data_entrega >= (SELECT starts_on FROM semanas WHERE id = semana_id)
       AND data_entrega <= (SELECT ends_on   FROM semanas WHERE id = semana_id))
  -- ⚠ CHECK com subquery não é suportado em alguns Postgres. Se falhar,
  -- mover essa validação pra trigger (mais robusto, sugiro fazer assim).
);

CREATE INDEX idx_janelas_semana       ON janelas_entrega(semana_id);
CREATE INDEX idx_janelas_data_entrega ON janelas_entrega(data_entrega);
CREATE INDEX idx_janelas_status       ON janelas_entrega(status);

-- 3. Backfill: 1 janela por semana existente
INSERT INTO janelas_entrega (semana_id, data_entrega, cutoff_at, label, status)
SELECT
  s.id,
  s.data_entrega,
  s.cutoff_at,
  'Padrão',
  CASE
    WHEN s.status = 'planejamento' THEN 'planejamento'::janela_status_enum
    WHEN s.status = 'producao'     THEN 'congelada'::janela_status_enum
    WHEN s.status = 'concluida'    THEN 'concluida'::janela_status_enum
    ELSE 'planejamento'::janela_status_enum
  END
FROM semanas s;
-- ⚠ Ajustar o CASE conforme o enum real de semanas.status (CC valida no pré-requisito).

-- 4. Conectar pedidos_pontuais à janela
ALTER TABLE pedidos_pontuais
  ADD COLUMN janela_entrega_id uuid REFERENCES janelas_entrega(id);

UPDATE pedidos_pontuais p
SET janela_entrega_id = (
  SELECT je.id FROM janelas_entrega je WHERE je.semana_id = p.semana_id LIMIT 1
);

ALTER TABLE pedidos_pontuais
  ALTER COLUMN janela_entrega_id SET NOT NULL;

CREATE INDEX idx_pedidos_pontuais_janela ON pedidos_pontuais(janela_entrega_id);

-- 5. Trigger pra criar janela default ao criar semana (preserva fluxo atual)
CREATE OR REPLACE FUNCTION cria_janela_padrao_para_semana()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO janelas_entrega (semana_id, data_entrega, cutoff_at, label)
  VALUES (NEW.id, NEW.data_entrega, NEW.cutoff_at, 'Padrão');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cria_janela_padrao
  AFTER INSERT ON semanas
  FOR EACH ROW EXECUTE FUNCTION cria_janela_padrao_para_semana();

-- 6. Trigger de updated_at na janela
CREATE TRIGGER set_updated_at BEFORE UPDATE ON janelas_entrega
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 7. Marcar campos deprecated em semanas (só comentário, não dropa)
COMMENT ON COLUMN semanas.data_entrega IS
  'DEPRECATED desde maio 2026. Usar janelas_entrega.data_entrega. Mantido por compatibilidade até todos os consumidores migrarem.';
COMMENT ON COLUMN semanas.cutoff_at IS
  'DEPRECATED desde maio 2026. Usar janelas_entrega.cutoff_at. Mantido por compatibilidade até todos os consumidores migrarem.';
```

**Ressalvas pro CC:**

- O CHECK constraint com subquery em `janelas_entrega_data_dentro_semana` provavelmente vai falhar (Postgres não aceita subquery em CHECK). Substituir por trigger `BEFORE INSERT OR UPDATE` se necessário.
- O CASE de mapeamento de status assume valores específicos do enum `semana_status`. CC valida no pré-requisito antes de aplicar.
- Trigger de updated_at: reutilizar a função `trigger_set_updated_at()` que já existe no schema (Rodada 2 documenta).

---

## Plano em fases

**Fase 1 — Pré-validação (10min)**

CC roda as 3 queries do pré-requisito, posta resultado no chat. Eu valido antes de seguir.

**Fase 2 — Migration (1h)**

- Criar arquivo `supabase/migrations/00XX_janelas_entrega.sql`
- Rodar localmente em branch (`supabase db reset` ou similar pra ambiente dev)
- Verificar que backfill criou 1 janela por semana
- Verificar que `pedidos_pontuais.janela_entrega_id` está NOT NULL e preenchida
- Testar trigger: inserir uma `semana` nova de teste e ver se janela é criada automaticamente

**Fase 3 — Push (15min)**

- `supabase db push` pra ambiente staging/prod
- Confirmar contagens: `SELECT COUNT(*) FROM janelas_entrega` deve igualar `SELECT COUNT(*) FROM semanas`
- Confirmar pedidos_pontuais: `SELECT COUNT(*) FROM pedidos_pontuais WHERE janela_entrega_id IS NULL` deve ser 0

**Fase 4 — Documentação (20min)**

- Atualizar `Docs/CORA_Briefing_Backoffice_Fase1_Schema_v3.md` (raiz do repo): adicionar seção "Janelas de Entrega" no domínio Operação, com schema completo, regras e ressalva sobre campos deprecated em `semanas`
- Atualizar diagrama ERD se houver
- Commit message: `feat(schema): introduce janelas_entrega for delivery decoupling`

---

## Critério de aceite

- [ ] Migration aplicada em staging sem erro
- [ ] Cada `semana` existente tem exatamente 1 `janela_entrega` correspondente
- [ ] Todo `pedido_pontual` existente tem `janela_entrega_id` preenchido
- [ ] Inserir nova semana de teste cria janela automaticamente via trigger
- [ ] Tentativa de criar `janela_entrega` com `data_entrega` fora do range da semana é rejeitada
- [ ] Comentários `DEPRECATED` aparecem em `semanas.data_entrega` e `semanas.cutoff_at` (visíveis em `\d+ semanas`)
- [ ] Doc canônico `CORA_Briefing_Backoffice_Fase1_Schema_v3.md` atualizado

---

## Decisões registradas pro futuro

**Quando dropar `semanas.data_entrega` e `semanas.cutoff_at`:**
- Quando UI Semana, UI Produção, UI Pedidos e Portal lerem todos da `janelas_entrega`
- Migration separada (`0XYZ_drop_semanas_delivery_legacy.sql`)
- Não fazer agora: portal está em produção e ainda lê esses campos

**Quando `subscriptions` ganha `janela_padrao_id`:**
- Quando o ciclo da assinatura for materializado em rows semanais (provavelmente quando UI Pedidos for construída no Backoffice)
- Hoje a entrega regular é implícita; quando virar explícita, cada pedido aponta pra uma janela específica e a subscription guarda a janela default

**Quando UI de gerenciamento de janelas entra:**
- Gatilho: Hugo decide separar Niterói/Rio em dias diferentes, ou volume passa de ~30 assinantes numa única expedição (estimativa, ajustar com dado real)
- Antes disso, segue 1 janela/semana automática via trigger

**Política de regiao:**
- Hoje nullable. Quando Niterói/Rio virarem janelas separadas, popular com `'niteroi'` ou `'rio'`
- No futuro pode virar enum ou FK pra tabela `regioes`, dependendo de quantas surgirem

---

## Tom de voz e regras (pra eventual UI futura)

Quando UI de janelas entrar (não agora), aplicar:

- Skill `cora-brand-voice`
- Sem travessões
- League Gothic em headers, Montagu Slab em corpo
- Microcopy "Janela de entrega" (não "slot", não "delivery window")

---

## Prompt pra colar no Claude Code

```
No cora-backoffice, aplicar migration de janelas_entrega conforme 
CORA_Briefing_Backoffice_Janelas_Entrega.md (salvo em Docs/ antes 
de executar).

Criar branch feat/janelas-entrega a partir da main atualizada.

ANTES de escrever a migration: rodar as 3 queries do pré-requisito 
e postar resultado pra mim validar. Não criar arquivo de migration 
sem essa validação.

Após aprovação:
1. Criar 00XX_janelas_entrega.sql conforme schema proposto
2. Validar CHECK constraint (provavelmente vira trigger)
3. Aplicar localmente com supabase db reset
4. Verificar backfill (contagens descritas no critério de aceite)
5. Aplicar em staging via supabase db push
6. Atualizar Docs/CORA_Briefing_Backoffice_Fase1_Schema_v3.md
7. Commit: feat(schema): introduce janelas_entrega for delivery decoupling

Não tocar em Portal, UI Backoffice nem em subscriptions nesta tarefa.
```

---

*Briefing · Janelas de Entrega · Backoffice Cora · Maio 2026*
