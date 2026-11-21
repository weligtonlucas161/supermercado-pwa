# Bloqueio progressivo de login

## Regra
- Até 4 falhas consecutivas: sem bloqueio.
- A 5ª falha: bloqueia por 5 minutos.
- Após expirar, mais 5 falhas: bloqueia por 10 minutos.
- Cada ciclo posterior de 5 falhas aumenta o bloqueio em mais 5 minutos (15, 20, 25...).
- Login válido apaga o contador e o nível de bloqueio.
- Tentativas durante bloqueio não são processadas nem incrementam o contador.

## Segurança e armazenamento
- O identificador de matrícula é normalizado (case-insensitive e com/sem @) e SHA-256 é calculado no banco; matrícula não fica armazenada na tabela.
- Tabela e funções não são acessíveis por anon/authenticated; apenas service_role, chamada pela Edge Function.
- Estado persistido no PostgreSQL, portanto refresh, dispositivo diferente e reinício da função não removem o bloqueio.
- A operação de falha usa advisory lock e row lock para contagem concorrente consistente.
- Edge Function retorna HTTP 429 e mensagem com minutos restantes quando bloqueado; o frontend exibe essa mensagem.

## Implantação
Esta migração deve ser aplicada antes de publicar/ativar auth-bridge. Não aplicar diretamente em produção sem o teste em ambiente isolado e validação de backup/restauração conforme checklist de migração.
