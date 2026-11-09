# 🗄️ Estrutura do Banco de Dados: Synk - Controle de Prevenção de Perdas

Este repositório contém a estrutura de banco de dados oficial **Synk (Versão 2026.1)** para PostgreSQL / Supabase, consolidada a partir dos scripts mestres de produção.

## 📋 Arquitetura das Tabelas

1. **`lojas` (Multi-Tenancy, Matriz e Filiais)**
   - Suporte hierárquico: lojas independentes, matrizes e filiais com isolamento por `loja_id`.
   - Inclui loja padrão inicial `loja_padrao_001` (Supermercado Silva - Matriz).

2. **`usuarios` & `sessoes_ativas`**
   - Controle por matrícula, cargo (`adm`, `master`, `operador`) e setor.
   - Prevenção em tempo real de login duplo simultâneo via heartbeat/ping.
   - Administrador SaaS global (`111111`) e Operador de Loja (`4092`).

3. **`produtos` (Estoque Isolado por Loja & 5 Colunas Estritas)**
   - `codigo_barras` (Código EAN)
   - `nome` (Descrição do produto)
   - `codigo_fornecedor` (Código de fornecedor)
   - `plu` (Código reduzido)
   - `quantidade` (Saldo em estoque)
   - `setor` & `data_vencimento` (YYYY-MM-DD)
   - `is_encrypted`, `ciphertext`, `iv` (Criptografia AES-GCM 256 bits em repouso)
   - `loja_id` (Chave estrangeira obrigatória para isolamento do estoque)

4. **`produtos_catalogo_universal` (Script 08)**
   - Catálogo global e compartilhado entre todas as lojas com `codigo_barras` e `nome`.
   - Alimentado automaticamente e de forma transparente durante importações de planilhas e cadastros para auto-completar dados nos leitores.

5. **`auditoria_presenca_sessoes`, `auditoria_presenca_bips`, `auditorias_finalizadas`, `auditoria_produtos`**
   - Sessões de presença ao vivo por setor.
   - Prevenção contra bip duplo (`sessao_id || '_' || produto_id`).
   - Relatórios consolidados e rastreabilidade de itens auditados.

6. **`app_logs` & `feedbacks`**
   - Trilha imutável de auditoria de operações (importações, ajustes de estoque).
   - Canal de comunicação e avaliações com o administrador do sistema.

7. **Procedures e Segurança RLS**
   - `rpc_ajustar_estoque_seguro`: ajuste atômico com verificação de tenant e log automático.
   - `import_products_bulk`: importação rápida das 5 colunas estritas, alimentando tanto a loja quanto o catálogo universal.

## 🚀 Como Aplicar no Supabase

1. Acesse o **SQL Editor** no painel do Supabase.
2. Abra e copie o conteúdo de `supabase/schema.sql`.
3. Execute o script.
4. As tabelas, índices de alta performance, triggers, procedures e regras de RLS estarão criadas e ativas.
