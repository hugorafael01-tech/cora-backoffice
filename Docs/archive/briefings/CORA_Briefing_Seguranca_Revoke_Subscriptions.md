# Briefing — Seguranca: revogar escrita direta em subscriptions/profiles

**Repo:** `cora-backoffice` (governanca de schema)
**Task:** 86e1mcyuz (Seguranca: travar escrita direta em subscriptions antes do Alpha pago)
**Correlata:** D.3 (cora-portal). Recomendado aplicar ESTA migration ANTES de a D.3 ir pra producao, porque a D.3 passa a criar subscriptions reais ligadas a usuarios.
**Sessao de origem:** 30/mai/2026

---

## Contexto / o furo

Confirmado por SQL no banco vivo em 29/mai:
- `subscriptions` tem `GRANT ALL` pra `authenticated` E `anon` (INSERT/UPDATE/DELETE/etc).
- Tem a policy `subscriptions_update_own` (UPDATE, USING/WITH CHECK `auth.uid() = user_id`).
- A policy `deny all` e PERMISSIVE (no-op assim que outras permissivas existem).

Efeito: um usuario autenticado consegue dar UPDATE em QUALQUER coluna da PROPRIA linha
de assinatura direto do client (supabase-js/PostgREST). RLS restringe a LINHA, nao a
COLUNA. Isso inclui `status` (auto-marcar como pago = bypass de pagamento),
`asaas_customer_id`/`asaas_subscription_id` e `qty_*`. `anon` tem o grant mas nao
passa nas policies (sem auth.uid()), entao nao acessa por ali — mas o grant amplo e
sujeira que vale remover.

Hoje a exposicao e baixa (sem assinante real). A partir da D.3 havera subscriptions
reais, entao fecha-se agora.

---

## A correcao

Toda escrita em subscriptions/profiles passa pelo servidor (service_role, que faz
bypass de RLS e tem grants proprios). O client (authenticated/anon) deve ter **leitura
own apenas, zero escrita**. A migration:

1. Revoga escrita de `authenticated` e `anon` em `subscriptions` e `profiles`.
2. Revoga SELECT de `anon` nas duas (nao ha caminho legitimo de leitura anonima;
   o portal le autenticado).
3. Mantem SELECT de `authenticated` (gated por `select_own`/`profiles_select_own`) —
   e disso que a D.2 depende.
4. Dropa a policy `subscriptions_update_own`, que fica sem sentido (sem privilegio de
   UPDATE pro authenticated, a policy nao concede nada e so confunde).

`service_role` NAO e afetado por REVOKE de authenticated/anon — os endpoints `/api`
continuam escrevendo normalmente.

---

## PRE-REQUISITO obrigatorio (verificar ANTES de aplicar)

Confirmar que **nenhuma escrita do portal hoje depende de write direto do client** em
subscriptions/profiles (o esperado, pelo principio "escrita via endpoint", e que tudo
passe por `/api` com service_role). Verificacao no repo `cora-portal`:

```
grep -rn "from('subscriptions')" src | grep -E "\.update|\.insert|\.delete|\.upsert"
grep -rn 'from("subscriptions")' src | grep -E "\.update|\.insert|\.delete|\.upsert"
grep -rn "from('profiles')" src | grep -E "\.update|\.insert|\.delete|\.upsert"
grep -rn 'from("profiles")' src | grep -E "\.update|\.insert|\.delete|\.upsert"
```

Se aparecer qualquer escrita client-side (supabase-js no browser), PARAR: ela vai
quebrar com o revoke e precisa ser migrada pra endpoint antes. Se so aparecer leitura
(`.select`) e escritas via `/api`, seguir.

---

## Numero da migration

Determinar o proximo numero sequencial na pasta de migrations do `cora-backoffice`
via `git fetch` + `git log origin/main` + listagem da pasta. D.1 foi a 0018; esta
provavelmente e 0019, mas **confirmar no repo, nao assumir**.

---

## Migration proposta

Conferir nomes/grants reais antes (queries de verificacao abaixo). Ajustar header ao
estilo do repo.

```sql
-- Migration 00XX: revoke escrita direta de authenticated/anon em subscriptions e profiles
-- Fecha o furo update_own (RLS restringe linha, nao coluna). Toda escrita passa a ser
-- exclusivamente via service_role (endpoints /api). Leitura own do authenticated mantida.

-- subscriptions
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.subscriptions FROM authenticated, anon;
REVOKE SELECT ON public.subscriptions FROM anon;

-- profiles
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles FROM authenticated, anon;
REVOKE SELECT ON public.profiles FROM anon;

-- policy de UPDATE own deixa de fazer sentido (sem privilegio de UPDATE no client)
DROP POLICY IF EXISTS subscriptions_update_own ON public.subscriptions;

-- Mantidas: subscriptions_select_own, subscriptions admin read, profiles_select_own.
-- service_role nao e afetado (grants proprios + bypass de RLS).
```

---

## Aplicacao

1. CC autora o arquivo na pasta de migrations do cora-backoffice, branch propria, PR draft apos primeiro push.
2. CC NAO aplica. Entrega o SQL pronto + as verificacoes pre/pos pro Hugo rodar no SQL Editor.
3. Hugo aplica, roda as verificacoes, confirma. Depois ready + squash merge. CC deleta a branch local.

### Verificacao pre (Hugo roda)
```sql
-- grants atuais
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_name IN ('subscriptions','profiles') AND grantee IN ('authenticated','anon')
ORDER BY table_name, grantee, privilege_type;

-- policies atuais
SELECT tablename, policyname, permissive, cmd FROM pg_policies
WHERE tablename IN ('subscriptions','profiles') ORDER BY tablename, policyname;
```

### Verificacao pos (Hugo roda)
```sql
-- authenticated/anon nao devem ter mais INSERT/UPDATE/DELETE; authenticated mantem SELECT em ambas; anon sem nada
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_name IN ('subscriptions','profiles') AND grantee IN ('authenticated','anon')
ORDER BY table_name, grantee, privilege_type;

-- subscriptions_update_own nao deve mais aparecer
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('subscriptions','profiles') ORDER BY tablename, policyname;
```

Esperado pos: `authenticated` so com SELECT em subscriptions e profiles; `anon` sem
nenhum privilegio; sem a policy `subscriptions_update_own`; `select_own` e
`profiles_select_own` intactas.

### Smoke pos-merge (opcional, prova o fechamento)
Logado como o usuario dev no portal/preview, tentar um update direto via supabase-js
no console (`supabase.from('subscriptions').update({status:'active'}).eq(...)`) deve
falhar por permissao. A leitura (`select`) continua funcionando.

---

## Pontos de parada obrigatorios (adicionais aos do template, seguem apos o item 8)

9. Nao aplicar a migration. Hugo aplica.
10. Nao aplicar sem antes confirmar (grep no cora-portal) que nao ha escrita client-side em subscriptions/profiles.
11. Nao revogar SELECT de authenticated (a D.2 depende). So anon perde SELECT.
12. Nao mexer em service_role.

---

## Refs

- Task 86e1mcyuz (descricao + comentario com a confirmacao do furo em 29/mai).
- Migration 0018 (D.1) — origem das colunas e policies.
- D.2 — depende do SELECT own do authenticated (nao quebrar).
- D.3 (cora-portal) — passa a criar subscriptions reais; aplicar este revoke antes de D.3 em prod.
