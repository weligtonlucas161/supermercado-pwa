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

## Segurança e Isolamento Multi-Tenant

- **Isolamento de Tenants via Supabase Auth + RLS Estrita:**
  - O aplicativo autentica nativamente no Supabase Auth (`signInWithPassword`) gerando sessão JWT com claims em `app_metadata` (`loja_id`, `cargo`, `matricula`).
  - Todas as tabelas operacionais possuem Row Level Security (RLS) habilitada com predicados rígidos baseados em `fn_jwt_loja_id()` e `fn_is_saas_admin()`. Acesso anônimo indiscriminado (`qual = true`) foi totalmente eliminado.
  - As senhas dos usuários utilizam hash bcrypt (`crypt(..., gen_salt('bf'))`), e senhas em texto claro foram purgadas do banco.
- **Cifragem Ponta a Ponta (Zero-Knowledge):**
  - Campos sensíveis (nome do produto, EAN/código de barras, PLU, fornecedor, CNPJ e auditorias) são cifrados com AES-256 (CryptoJS) antes de trafegar na rede.
  - A descriptografia ocorre estritamente na memória RAM do cliente para exibição.
  - A chave mestra é lida exclusivamente de `VITE_ENCRYPTION_KEY` no ambiente (qualquer fallback hardcoded no código foi removido).
  - O acervo legado foi 100% recriptografado e indexado via hash determinístico `ean_hash` (HMAC-SHA256) através do utilitário `scripts/recrypt-acervo.mjs`.
- **Prevenção de Injeção:** sanitização anti-injeção em todas as entradas (`src/utils/security.ts`).
