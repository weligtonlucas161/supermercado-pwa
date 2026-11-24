set local lock_timeout = '2s';

create function private.can_read_store_team(p_store text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.usuarios actor
    join public.lojas loja on loja.id = actor.loja_id
    where actor.auth_user_id = (select auth.uid())
      and actor.ativo is true and loja.ativa is true
      and actor.loja_id = p_store
      and lower(btrim(actor.cargo)) in (
        'gerente', 'gerente de loja', 'subgerente', 'sub-gerente', 'sub gerente',
        'subgerente de loja', 'sub-gerente de loja', 'sub gerente de loja',
        'subgerente da loja', 'sub-gerente da loja', 'sub gerente da loja'
      )
  );
$$;

revoke all on function private.can_read_store_team(text) from public, anon;
grant execute on function private.can_read_store_team(text) to authenticated;

create policy usuarios_read_store_team
  on public.usuarios for select to authenticated
  using (lower(btrim(cargo)) <> 'saas_admin' and private.can_read_store_team(loja_id));
