# Migração de autenticação — preflight de produção

## Status
Preparação somente leitura. Nenhuma alteração aplicada ao Supabase de produção, nenhum usuário removido, nenhum vínculo Auth criado e nenhuma política/RPC alterada.

Projeto Supabase: `senbgpiuhjtlpnhvpykh` (`supermercado_pwa`), status `ACTIVE_HEALTHY`.

## Inventário confirmado em 2026-11-21
- 1 loja existente; preservar seu ID.
- 6 registros em `public.usuarios`: 5 funcionários/gerentes vinculados à loja e 1 `saas_admin` sem `loja_id`.
- Nenhum registro tem `auth_user_id` preenchido.
- Credenciais: 5 registros em formato legado AES (precisam ser verificadas no servidor e migradas no primeiro login ou por reset); o `saas_admin` tem bcrypt e deve manter seu cadastro/ID.
- 8.633 produtos e 19.982 registros de auditoria previamente observados; manter os dados.
- Edge Functions: nenhuma implantada.
- Todas as 16 tabelas públicas inspecionadas têm RLS habilitado, mas cada uma tem política permissiva `PUBLIC FOR ALL USING(true) WITH CHECK(true)`; RLS atualmente não fornece isolamento.
- 10 funções `SECURITY DEFINER` estão executáveis por `anon` e `authenticated`, incluindo login, sincronização de senha, ajuste/importação de estoque e operações de loja.
- FK `usuarios.loja_id` → `lojas.id` tem `ON DELETE CASCADE`. Não apagar a loja nem usuários em lote.
- A RPC `rpc_sync_user_password` atualiza o hash e tenta criar/atualizar Auth, mas sua lógica ignora exceções na parte Auth; não usar como migração direta sem revisão.

## Bloqueios para executar em produção
1. Backup verificado (export lógico/schema + dados ou backup Supabase com confirmação de restauração).
2. Secrets configurados na Edge Function: service-role key e chave AES legada, além de URL e publishable/anon key. Nunca colocar service-role ou chave AES no frontend, repo, PR ou chat.
3. Revisar/reescrever auth bridge: proteção contra brute force/rate limit; validação matricula; evitar confiar em claims user_metadata; validar cargo/loja via registro servidor; consistência de email sintético; migração idempotente; log sem senha.
4. Implementar e testar políticas RLS específicas por tabela (loja, cargo, catálogo universal e SaaS admin). Não ativar políticas genéricas.
5. Substituir chamadas públicas privilegiadas por endpoints/RPC protegidas, depois revogar permissões públicas em etapas.
6. Testar no ambiente isolado: login SaaS com credencial atual, primeiro login legado, refresh/logout, reset senha, usuários/lojas, produtos, auditoria, sincronização offline e isolamento multi-loja.
7. Publicar frontend com feature flag desligada inicialmente; ativar apenas após smoke tests, manter rollback de app e banco documentado.

## Ordem recomendada
A. Backup e restore-test.
B. Implantar Edge Function revisada com secrets e rate limit, sem mudar permissões existentes.
C. Migrar e validar primeiro o `saas_admin` atual, mantendo seu ID/matrícula e sem reset de senha, e confirmar login/refresh/logout.
D. Migrar funcionários por login de transição ou redefinição de senha; manter os IDs, loja, cargos e histórico.
E. Aplicar políticas/RPC por lotes após testes e análise de cada função.
F. Ativar auth no frontend e remover os fallbacks locais/defaults, validando todos os fluxos.
G. Rodar Supabase security advisors, testes de regressão e registrar rollback.

## Proteção de administrador SaaS
- Não apagar, renomear, desativar ou redefinir senha do registro SaaS durante a migração.
- Confirmar vínculo `auth_user_id` e autenticação real antes de qualquer revogação da RPC antiga.
- Não executar exclusão em massa na tabela `usuarios`.
