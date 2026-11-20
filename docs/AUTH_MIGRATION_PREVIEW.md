# Migração gradual para Supabase Auth (Preview)

## O que foi preparado

- O login pode usar a Edge Function `auth-bridge` quando `VITE_AUTH_BRIDGE_ENABLED=true`; sem a flag, o login atual permanece inalterado.
- A ponte valida credenciais legadas no servidor, cria/vincula o usuário Auth e devolve uma sessão JWT real.
- Senhas legadas AES podem ser migradas no primeiro login, desde que `LEGACY_ENCRYPTION_KEY` esteja configurada como secret privado da Edge Function.
- Ao cadastrar um funcionário pela tela administrativa, o cliente chama a ação `provision` da mesma função. Ela exige sessão Auth válida, confirma o cargo do administrador e impede gerente de provisionar usuários de outra loja.
- A função usa `SUPABASE_SERVICE_ROLE_KEY` exclusivamente no servidor; ela nunca é incluída no bundle React.
- O cadastro em `public.usuarios` e seu ID de negócio são preservados. A conta Auth é vinculada por `auth_user_id`.

## Ativação somente em ambiente de teste

1. Crie/use um projeto Supabase de desenvolvimento separado. Não use o projeto de produção.
2. Configure os secrets da Edge Function: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `LEGACY_ENCRYPTION_KEY` (a mesma chave histórica que cifrou os campos `usuarios.senha`).
3. Faça deploy da função `auth-bridge` no projeto de desenvolvimento com `verify_jwt=false`. O modo `login` é público por natureza; o modo `provision` valida JWT e cargo no corpo da função.
4. Configure variáveis exclusivas do ambiente Preview da Vercel: `VITE_AUTH_BRIDGE_ENABLED=true`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` apontando para o projeto de desenvolvimento. Não altere variáveis Production.
5. Teste primeiro um administrador de teste; depois usuários de cada cargo. Confirme que o cadastro de funcionário cria e vincula a conta Auth sem apagar nem recriar a linha de `usuarios`.
6. Revise rate limiting e autorização da RPC de verificação antes de qualquer ativação de produção.

## Limites deliberados desta etapa

- Nenhuma Edge Function foi implantada no Supabase.
- Nenhuma tabela, política RLS, RPC, senha, usuário ou permissão do Supabase foi alterada.
- A variável de ativação não foi habilitada; a branch Preview mantém o fluxo atual até que o projeto Supabase de teste e seus secrets estejam configurados.
- O login usa temporariamente a RPC legada `rpc_login_usuario` para verificar hashes bcrypt. Para AES legado, a Edge Function compara o valor descriptografado no servidor e então atualiza o hash via RPC privilegiada chamada apenas com service role.
- A RPC `rpc_sync_user_password` ainda existe no banco de produção e suas permissões não foram alteradas nesta etapa. Antes de produção, é necessário revogar EXECUTE de `anon`/PUBLIC e permitir a chamada somente por um caminho administrativo controlado.
- Não teste a conta real `saas_admin` neste Preview. Use credenciais administrativas fictícias em um projeto isolado.
