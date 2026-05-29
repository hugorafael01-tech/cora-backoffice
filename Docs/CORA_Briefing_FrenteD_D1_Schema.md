# Briefing — Frente D / D.1: profiles + expand de subscriptions

**Repo:** `cora-backoffice` (governance de schema)
**Task ancora:** 86e1mba7c (Frente D — Subscription no DB)
**Sub-etapa:** D.1 (schema), isolada. D.2 a D.5 sao sessoes separadas.
**Task de cleanup correlata:** 86e1mc0ta (migration de contract, roda depois do cutover D.2/D.3/D.4)
**Sessao de origem:** 29/mai/2026

---

## Contexto

O portal ja autentica via magic link Supabase (Auth-B, concluida e deployada em
producao em 29/mai). Mas a assinatura ainda nasce de um Onboarding fake e vive
como flag `cora_subscription` em localStorage. A Frente D move a assinatura pro
banco, linkada a `auth.users`. Esta D.1 e so o schema.

**Abordagem: expand-contract.** A tabela `subscriptions` ja existe em producao
(migration `0001_initial` do portal) com shape antigo, e os endpoints
`/api/subscriptions` (POST/GET) ainda leem esse shape. Por isso a D.1 SO ADICIONA:
cria `profiles` e acrescenta colunas novas em `subscriptions`, sem dropar nem
renomear nada. Os endpoints antigos continuam funcionando ignorando as colunas
novas. O drop das colunas mortas e uma migration de contract separada (task
86e1mc0ta), que so roda depois que D.2/D.3/D.4 tiverem feito o cutover do codigo.

Principio guia do projeto: "evoluir, nao revolucionar." A migration nao pode
derrubar o que esta vivo em producao.

---

## Decisoes ja tomadas (nao redesenhar)

1. **Profile separado**, nao `user_metadata`. Tabela `profiles` com `user_id` FK
   pra `auth.users`.
2. **Endereco embutido** em `subscriptions` como colunas planas. Ja existe assim
   no shape legado (cep, rua, numero, complemento, bairro, cidade, estado); so
   falta `zona_entrega`.
3. **`status` continua enum** `subscription_status` ja existente. Valores
   confirmados: `pending_payment`, `active`, `paused`, `cancelled` (grafia com
   dois L). Nao mexer no enum.
4. **`zona_entrega` e `text`, nao enum.** As zonas (Niteroi Z1/Z2/Z3, Rio
   Conde/Sul/Outras) vao ser recalibradas apos os primeiros pedidos e admitem
   ajuste manual, conforme `CORA_Zoneamento_Entregas_v1.md`. Enum no Postgres e
   chato de alterar; texto e o certo aqui. Validacao fica na aplicacao.
5. **RLS deny-all** em `profiles` e `subscriptions` nesta D.1. Sem policy de
   `SELECT`-own. Motivo: o caminho de leitura (query direta do client com a sessao
   JWT vs endpoint service_role) e decisao da D.2, nao da D.1. Adicionar policy
   depois e barato e nao-quebra-nada.
6. **`user_id` entra nullable** nas duas tabelas (em `subscriptions` ja existe
   nullable, da migration 0017 do portal). Vira NOT NULL so na contract, apos
   backfill.
7. **Sem user dev / sem seed de auth nesta D.1.** O `?dev=1` com
   `signInWithPassword` e assunto de D.2 em diante.

---

## Estado atual de `subscriptions` (confirmado via SQL Editor em 29/mai)

Colunas existentes: `id` (uuid PK), `nome`, `whatsapp`, `email`, `cpf`, `cep`,
`rua`, `numero`, `complemento` (nullable), `bairro`, `cidade`, `estado`, `itens`
(jsonb), `total_paes` (int), `valor_paes` (numeric), `valor_frete` (numeric),
`valor_mensal` (numeric), `status` (enum, default pending_payment),
`coverage_unconfirmed` (bool default false), `created_at`, `updated_at`,
`next_billing_change_date` (nullable), `next_billing_value` (nullable),
`user_id` (uuid nullable).

RLS: deny-all desde o `0001_initial`.

Enum `subscription_status`: pending_payment, active, paused, cancelled.

---

## Escopo desta migration (o que mexe / o que NAO mexe)

**Mexe:**
- Cria tabela `profiles` + RLS + trigger de updated_at.
- ADD COLUMN (nullable) em `subscriptions`: qty_total, qty_original,
  qty_integral, zona_entrega, asaas_customer_id, asaas_subscription_id,
  activated_at, paused_at, cancelled_at.
- ADD CONSTRAINT (CHECKs NULL-tolerant de qty) em `subscriptions`.
- Trigger de updated_at em `subscriptions`, SE ainda nao existir um.

**NAO mexe (fica pra contract, task 86e1mc0ta):**
- Nao dropa nem renomeia nenhuma coluna legada (nome, email, whatsapp, cpf,
  itens, total_paes, valor_paes, valor_mensal, valor_frete, coverage_unconfirmed,
  next_billing_change_date, next_billing_value).
- Nao recria `user_id` (ja existe).
- Nao cria policy de RLS alem de deny-all.
- Nao mexe no enum `subscription_status`.
- Nao toca em `app_settings` (ja existe e correta desde o 0002).

---

## Verificacoes antes de escrever a migration

Rodar via `git fetch` + `git log origin/main`:
- Confirmar o proximo numero sequencial da pasta de migrations do `cora-backoffice`.
  NAO assumir o numero a partir de branch local. O nome do arquivo segue a
  convencao existente da pasta.

Entregar pro Hugo rodar no SQL Editor (read-only, Hugo executa, CC nunca roda):

```sql
-- 1. Existe funcao de set_updated_at reaproveitavel no projeto?
SELECT proname, pg_get_functiondef(oid)
FROM pg_proc
WHERE proname ILIKE '%updated_at%' OR proname ILIKE '%set_timestamp%';

-- 2. subscriptions ja tem trigger de updated_at?
SELECT tgname, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'public.subscriptions'::regtype AND NOT tgisinternal;
```

Regras de decisao a partir do resultado:
- Se ja existir uma funcao equivalente (ex.: `set_updated_at`,
  `trigger_set_timestamp`), REUSAR pelo nome existente, nao criar outra.
- Se `subscriptions` ja tiver trigger de updated_at, NAO adicionar outro.
- So criar funcao/trigger ausentes.

---

## Migration proposta (expand)

Ajustar o cabecalho ao numero/nome real da pasta. Funcao de updated_at
condicional ao resultado das verificacoes acima.

```sql
-- ============================================================
-- Migration 00XX — Frente D / D.1: profiles + expand subscriptions
-- ============================================================
-- Expand phase do expand-contract da Frente D (Subscription no DB).
-- Cria profiles e adiciona colunas novas em subscriptions SEM dropar
-- nada do shape legado (0001_initial), pra nao quebrar os endpoints
-- /api/subscriptions que ainda leem o shape antigo em producao.
-- Drop das colunas mortas fica pra migration de contract (task 86e1mc0ta),
-- depois do cutover de codigo (D.2/D.3/D.4).
-- ============================================================

-- 1. profiles (1:1 com auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  whatsapp   text NOT NULL,
  cpf        text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- deny-all: nenhuma policy. service_role faz bypass de RLS.
-- SELECT-own (user_id = auth.uid()) fica pra D.2, quando o read-path for decidido.

-- 2. subscriptions: colunas novas, todas nullable (expand)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS qty_total             smallint,
  ADD COLUMN IF NOT EXISTS qty_original          smallint,
  ADD COLUMN IF NOT EXISTS qty_integral          smallint,
  ADD COLUMN IF NOT EXISTS zona_entrega          text,
  ADD COLUMN IF NOT EXISTS asaas_customer_id     text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
  ADD COLUMN IF NOT EXISTS activated_at          timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at             timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at          timestamptz;
-- user_id ja existe (nullable, migration 0017 do portal). Nao recriar.

-- CHECKs NULL-tolerant: em Postgres, um CHECK passa quando a expressao da NULL.
-- Linhas legadas tem qty_* = NULL, entao os checks nao mordem ate o cutover (D.3)
-- popular os valores. Viram trava real quando as colunas forem NOT NULL na contract.
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_qty_total_range
    CHECK (qty_total IS NULL OR qty_total BETWEEN 1 AND 3),
  ADD CONSTRAINT subscriptions_qty_composition
    CHECK (qty_original + qty_integral = qty_total);

-- 3. updated_at automatico
-- SO INCLUIR este bloco se as verificacoes mostrarem que a funcao nao existe.
-- Se existir, reusar a funcao do projeto pelo nome dela.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- subscriptions: SO criar se a verificacao mostrar que ainda nao tem trigger.
-- CREATE TRIGGER subscriptions_set_updated_at
--   BEFORE UPDATE ON public.subscriptions
--   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

Nota sobre o CHECK de composicao: a forma simples
`qty_original + qty_integral = qty_total` ja e NULL-tolerant (qualquer operando
NULL faz a expressao virar NULL, e o CHECK passa). Nao precisa de guardas
explicitas IS NULL no expand.

---

## Como aplicar

1. CC autora o arquivo de migration na pasta do `cora-backoffice`, commita numa
   branch propria.
2. CC NAO aplica a migration. Entrega o SQL pronto num bloco separado.
3. Hugo aplica via SQL Editor do Supabase.
4. Apos aplicar, Hugo roda as queries de verificacao pos-migration (abaixo) e
   confirma. So entao abre PR e faz squash merge.

Verificacao pos-migration (Hugo roda):

```sql
-- profiles existe com o shape certo
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' ORDER BY ordinal_position;

-- colunas novas entraram em subscriptions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'subscriptions'
  AND column_name IN ('qty_total','qty_original','qty_integral','zona_entrega',
                      'asaas_customer_id','asaas_subscription_id',
                      'activated_at','paused_at','cancelled_at')
ORDER BY column_name;

-- RLS ligada nas duas, sem policy nova
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('profiles','subscriptions');
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('profiles','subscriptions');
```

---

## Pontos de parada obrigatorios (adicionais aos do template, seguem apos o item 8)

9. Nao aplicar a migration. Hugo aplica via dashboard.
10. Nao dropar/renomear nenhuma coluna legada de subscriptions. Drop e da contract.
11. Nao recriar `user_id`. Ja existe.
12. Nao criar policy de RLS. Deny-all e o alvo desta etapa.
13. Nao tocar no enum `subscription_status` nem em `app_settings`.
14. Nao criar funcao/trigger de updated_at sem antes confirmar pelas verificacoes
    que nao existe equivalente.

---

## Refs

- `CORA_Precos_e_Planos_v1.md` — 1 a 3 paes, R$99/pao, so Original e Integral na
  assinatura. Base das constraints de qty.
- `CORA_Zoneamento_Entregas_v1.md` — zonas e justificativa de zona_entrega ser text.
- Migration `0001_initial` (portal) — origem do shape legado de subscriptions.
- Migration `0017` (portal) — origem do `user_id` nullable.
