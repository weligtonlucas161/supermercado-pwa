create table public.offline_stock_receipts (
  actor_id uuid not null,
  operation_id uuid not null,
  loja_id text not null,
  primary key (actor_id, operation_id)
);

alter table public.offline_stock_receipts enable row level security;
revoke all on table public.offline_stock_receipts from public, anon, authenticated;
grant select, insert on public.offline_stock_receipts to authenticated;

create policy own_offline_receipt_read on public.offline_stock_receipts
  for select to authenticated using (actor_id = (select auth.uid()));
create policy own_offline_receipt_insert on public.offline_stock_receipts
  for insert to authenticated with check (actor_id = (select auth.uid()));

create function public.apply_offline_stock_change(
  p_operation_id uuid, p_owner_id text, p_loja_id text, p_product_id text, p_exact integer, p_delta integer
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or p_operation_id is null
     or (p_exact is null) = (p_delta is null)
     or p_exact < 0 then
    raise exception 'Dados inválidos para sincronização' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid() and u.id = p_owner_id
      and u.ativo is true and u.loja_id = p_loja_id
  ) then
    raise exception 'Sessão incompatível com a ação offline' using errcode = '42501';
  end if;

  insert into public.offline_stock_receipts (actor_id, operation_id, loja_id)
    values (auth.uid(), p_operation_id, p_loja_id)
    on conflict (actor_id, operation_id) do nothing;
  if not found then return; end if;

  update public.produtos
    set quantidade = least(10000000, greatest(0, coalesce(p_exact::bigint, quantidade::bigint + p_delta))),
        updated_at = now()
    where loja_id = p_loja_id and id = p_product_id;
  if not found then
    raise exception 'Produto indisponível para sincronização' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.apply_offline_stock_change(uuid, text, text, text, integer, integer) from public, anon;
grant execute on function public.apply_offline_stock_change(uuid, text, text, text, integer, integer) to authenticated;
