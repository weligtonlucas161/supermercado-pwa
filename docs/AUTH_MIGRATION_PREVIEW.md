# Migração gradual para Supabase Auth (Preview)

## O que foi preparado

- A função `supabase/functions/auth-bridge/index.ts` valida a matrícula/senha pela RPC legada e, somente após validação positiva, cria ou atualiza a conta no Supabase Auth.
- A função vincula o UUID Auth em `public.usuarios.auth_user_id` sem recriar nem apagar o cadastro de negócio.
- O e-mail sintético respeita o formato já utilizado pela função SQL atual: matrícula normalizada + os seis primeiros caracteres de MD5 do ID do usuário.
- O cliente React pode usar o fluxo novo quando `VITE_AUTH_BRIDGE_ENABLED=true`; sem essa variável, mantém o fluxo atual.

## Ativação somente em ambiente de teste

1. Use um projeto Supabase de desenvolvimento separado, nunca o projeto de produção.
2. Faça deploy da Edge Function `auth-bridge` nesse projeto com verificação JWT desativada, pois o endpoint recebe o login antes de existir uma sessão.
3. Confirme que os secrets padrão `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` estão disponíveis no ambiente da função. A service role fica exclusivamente no servidor.
4. Configure `VITE_AUTH_BRIDGE_ENABLED=true` apenas nas variáveis de Preview da Vercel e aponte o Preview para o Supabase de desenvolvimento.
5. Teste primeiro a conta administrativa de teste; depois usuários de cada cargo. Não copie dados de produção nem tente migrar o `saas_admin` real em um ambiente de teste.
6. Só depois de revisão de segurança e validação dos testes deve ser planejada a ativação em produção.

## Limites deliberados desta etapa

- Nenhuma Edge Function foi implantada no Supabase.
- Nenhuma tabela, política RLS, RPC, senha, usuário ou permissão foi alterada.
- A variável de ativação não foi habilitada. O Preview continua no fluxo atual até que exista um Supabase de teste configurado.
- O endpoint de login depende da RPC legada para verificar a senha. A RPC pública de sincronização de senha não é chamada por esta função.
- A criação de novas contas Auth ocorre no primeiro login válido após o cadastro do usuário na tabela `usuarios`; não exige acesso ao painel Supabase pelo funcionário.
