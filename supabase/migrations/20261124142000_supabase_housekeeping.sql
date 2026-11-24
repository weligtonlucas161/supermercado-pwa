set local lock_timeout = '2s';

-- The existing unique index covers the same btree expression.
do $$
begin
  if not exists (
    select 1 from pg_index i
    where i.indexrelid = 'public.usuarios_matricula_normalizada_key'::regclass
      and i.indisvalid and i.indisunique
      and i.indrelid = 'public.usuarios'::regclass
  ) then
    raise exception 'The normalized registration index must be valid before removing its duplicate';
  end if;
end $$;

drop index public.idx_usuarios_matricula_lower;

-- Matches the stock reconciliation range and its sort order.
create index idx_logs_produtos_loja_alterado_em
  on public.logs_alteracoes_geral (loja_id, alterado_em)
  where tabela = 'produtos';

-- Preserve the original relations and policies outside the application schema.
create schema if not exists superpwa_archive;
revoke usage on schema superpwa_archive from public, anon, authenticated;
lock table public.cores_loja, public.feedbacks in access exclusive mode;

do $$
begin
  if exists (select 1 from public.cores_loja limit 1)
     or exists (select 1 from public.feedbacks limit 1) then
    raise exception 'Archive candidates must be empty';
  end if;
end $$;

alter publication supabase_realtime drop table public.cores_loja;
alter table public.cores_loja set schema superpwa_archive;
alter table public.feedbacks set schema superpwa_archive;
