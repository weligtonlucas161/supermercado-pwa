# Otimização da comunicação com o Supabase

## Alterações

- Leituras do índice de produtos e do catálogo universal agora usam paginação por intervalos de 1.000 registros e ordenação estável. Isso evita truncamento no limite padrão do PostgREST e evita montar um índice incompleto em lojas com muitos produtos.
- Falhas ao carregar páginas agora são propagadas. Antes, uma falha podia ser tratada como uma lista vazia e armazenada em cache, aumentando o risco de duplicação em importações.
- A importação reutiliza o índice de produtos em memória dentro do TTL de 60 segundos, em vez de forçar uma leitura completa da loja em toda importação.
- O fetch compartilhado repete apenas requisições GET/HEAD em falhas de rede ou respostas 5xx. POST/RPC não é repetido automaticamente, pois a primeira operação pode ter sido concluída mesmo que a resposta tenha se perdido; repetir uma escrita poderia duplicar efeitos.
- Respostas 429 não são repetidas automaticamente; o cliente deve respeitar a limitação do servidor e tratar o erro.
- Ao trocar a configuração do Supabase, os canais Realtime antigos são encerrados antes de substituir o cliente singleton, evitando conexões órfãs e eventos duplicados.

## Segurança e compatibilidade

- Nenhuma alteração de schema, credenciais, políticas RLS ou dados foi feita.
- Nenhuma alteração foi aplicada diretamente ao projeto Supabase de produção.
- A chave pública anon continua sendo apenas a chave pública do cliente; nenhuma service-role foi adicionada ao frontend.

## Verificações pendentes antes de produção

1. Executar `npm run lint` e `npm run build`.
2. Testar importação com mais de 1.000 e mais de 10.000 produtos, incluindo EANs repetidos.
3. Simular falha de leitura em uma página intermediária e confirmar que a importação falha sem cachear índice parcial.
4. Simular 5xx em GET e confirmar retry; simular falha em POST/RPC e confirmar que não há repetição automática.
5. Trocar a configuração do projeto e confirmar que não permanecem canais Realtime antigos.
6. Comparar tempo, número de requisições e volume transferido antes/depois em ambiente de homologação.

## Observação

A otimização reduz leituras repetidas e evita respostas truncadas. Ela não substitui a revisão de consultas específicas das telas, índices SQL e políticas RLS. O Supabase Performance Advisor também apontou uma chave estrangeira sem índice em `public.feedbacks.loja_id`; isso deve ser avaliado separadamente antes de qualquer alteração de schema.
