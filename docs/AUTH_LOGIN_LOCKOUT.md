# Bloqueio progressivo de login

O bloqueio é persistido no Supabase e aplicado pela Edge Function `auth-bridge`.

## Política
- 5 tentativas de senha inválida consecutivas: bloqueio de 5 minutos.
- Após o bloqueio expirar, mais 5 erros: bloqueio de 10 minutos.
- Os bloqueios seguintes aumentam em 5 minutos por ciclo (15, 20, 25...).
- Um login validado remove o contador e o nível de bloqueio.
- Erros de infraestrutura (RPC indisponível, falha de banco) não são contabilizados como senha errada.
- Respostas bloqueadas usam HTTP 429 e o cabeçalho `Retry-After`.

## Privacidade e persistência
A matrícula não é armazenada na tabela de bloqueio. A Edge Function calcula um HMAC-SHA256 usando `AUTH_LOCKOUT_SECRET`, com segredo mínimo de 32 caracteres, e envia somente o identificador derivado. A tabela fica no schema `private`, com RLS e permissões restritas a `service_role`; as RPCs são executáveis somente por `service_role`.

## Configuração necessária antes de implantar
Configure `AUTH_LOCKOUT_SECRET` como secret da Edge Function (gere um valor aleatório forte, com pelo menos 32 bytes; não compartilhe no chat nem coloque no frontend/repositório). A função também requer os secrets de Supabase e, para a migração de credenciais AES antigas, `LEGACY_ENCRYPTION_KEY`.

A migration `20261121000100_auth_login_lockout.sql` cria a tabela e as RPCs. Não aplicar em produção até revisão e teste em ambiente isolado.
