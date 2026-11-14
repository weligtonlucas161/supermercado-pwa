# SuperPWA OpSys — Gestão de Supermercado

PWA operacional para supermarkets: controle de validades, gestão de estoque com
alertas de ruptura, auditoria de presença/inventário, chat da loja e operação
offline sincronizável.

## Stack

- **Front-end:** React 19 + TypeScript + Vite 8 + Tailwind 4 (PWA com Workbox)
- **Banco:** Supabase (PostgreSQL / PostgREST + Realtime)
- **Criptografia:** AES-256 (CryptoJS) nos campos sensíveis + HMAC-SHA256
  determinístico para indexação de EAN

## Como rodar

**Pré-requisitos:** Node.js 20+ (ou Bun)

1. Instalar dependências:
   ```bash
   npm install      # ou: bun install
   ```
2. Configurar o ambiente — copie `.env.example` para `.env` e preencha:
   ```bash
   VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
   VITE_SUPABASE_ANON_KEY="SUA_SUPABASE_ANON_KEY"
   ```
   > Nenhuma credencial é versionada. Sem `.env` o app opera em modo local e
   > permite configurar o projeto pela interface (tela de importação).
3. Rodar:
   ```bash
   npm run dev      # http://localhost:3000
   npm run build    # build de produção
   npm run lint     # verificação de tipos (tsc --noEmit)
   ```

## Estrutura do banco de dados

A estrutura (schema, migrations, RLS, seeds) **não é versionada**: vive em
`supabase/` e `database/`, que estão no `.gitignore`. Cada ambiente mantém a
sua cópia local e aplica as migrations pelo Supabase CLI/MCP.

Migrations relevantes aplicadas:

| Migration | Objetivo |
|---|---|
| `13_hash_determinista_ean.sql` | Coluna `ean_hash` (HMAC do EAN) + índices de busca |
| `14_upsert_em_lote.sql` | Funções `fn_upsert_produtos` / `fn_upsert_catalogo_universal` (upsert atômico em lote) |
| `15_dedup_por_hash_ean.sql` | Deduplicação real por EAN + constraints corretas |

### Por que `ean_hash`?

`codigo_barras` é gravado cifrado com salt aleatório. Consequentemente:

- dois produtos com o **mesmo EAN** geram ciphertexts diferentes;
- índices únicos sobre a coluna cifrada **nunca** são acionados;
- deduplicar exigia decifrar a tabela inteira a cada importação.

`ean_hash` é um HMAC-SHA256 **determinístico** do EAN: indexável, permite
`upsert` atômico em lote e elimina o N+1 de escrita.

## Arquitetura de acesso ao banco

```
src/services/db/
  client.ts        Cliente único (singleton), config segura, timeout/retry/backoff
  productIndex.ts  Índice EAN→id por loja (com backfill e cache em memória)
  productWrite.ts  Escrita em lote (RPC atômica + fallback seguro)
src/services/supabaseService.ts   Camada de domínio (API única do app)
```

- **Conexão única** com timeout, retry com backoff exponencial e jitter.
- **Leitura:** projeção explícita de colunas (nunca `SELECT *`) e paginação em
  blocos de 1.000 registros.
- **Escrita:** 1 requisição HTTP por lote de 500 produtos (antes: 1 por linha).
- **Realtime:** aplica apenas o **delta** da linha alterada, em vez de recarregar
  a loja inteira.

## Segurança

- Sem credenciais no código-fonte; URL e anon key vêm do ambiente ou da
  configuração da interface (localStorage).
- URL do projeto validada (https obrigatório; http apenas em loopback).
- Sanitização anti-injeção em todas as entradas (`src/utils/security.ts`).
- Campos sensíveis cifrados com AES-256; descriptografia somente em RAM.

> **Pendente (recomendado):** as políticas RLS atuais são permissivas
> (`qual = true`) em todas as tabelas. Para isolamento multi-tenant de fato, é
> necessário migrar a autenticação para o Supabase Auth e vincular o `loja_id`
> ao JWT (`auth.jwt() ->> 'loja_id'`).
