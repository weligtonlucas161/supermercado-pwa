insert into public.setores_loja (loja_id, nome)
select loja.id, 'PREVENÇÃO'
from public.lojas loja
where not exists (
  select 1 from public.setores_loja setor
  where setor.loja_id = loja.id and upper(btrim(setor.nome)) = 'PREVENÇÃO'
)
on conflict do nothing;
