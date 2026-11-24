set local lock_timeout = '2s';

drop policy cargos_loja_store_isolation on public.cargos_loja;

create policy cargos_loja_read
  on public.cargos_loja for select to authenticated
  using (private.is_store_member(loja_id));

create policy cargos_loja_insert
  on public.cargos_loja for insert to authenticated
  with check (private.is_store_manager(loja_id));

create policy cargos_loja_update
  on public.cargos_loja for update to authenticated
  using (private.is_store_manager(loja_id))
  with check (private.is_store_manager(loja_id));
