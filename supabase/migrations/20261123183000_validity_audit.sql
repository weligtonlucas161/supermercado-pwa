create table public.validity_audit_counts (
  store_id text not null references public.lojas(id) on delete cascade,
  product_id text not null references public.produtos(id) on delete cascade,
  expires_on date not null,
  quantity integer not null check (quantity between 1 and 10000000),
  primary key (store_id, product_id, expires_on)
);

alter table public.validity_audit_counts enable row level security;
revoke all on table public.validity_audit_counts from public, anon, authenticated;
grant select, insert, update (quantity) on public.validity_audit_counts to authenticated;

create policy validity_audit_visible_products on public.validity_audit_counts
  for all to authenticated
  using (exists (
    select 1 from public.produtos p where p.id = product_id and p.loja_id = store_id
  ))
  with check (exists (
    select 1 from public.produtos p where p.id = product_id and p.loja_id = store_id
  ));

create function public.save_validity_audit_count(
  p_store text, p_product text, p_date date, p_quantity integer,
  p_expected integer, p_add boolean
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  saved integer;
begin
  if p_quantity is null or p_quantity not between 1 and 10000000
     or p_expected is null or p_expected < 0 or p_add is null then
    raise exception 'Quantidade inválida' using errcode = '22023';
  end if;

  if p_expected = 0 then
    insert into public.validity_audit_counts (store_id, product_id, expires_on, quantity)
      values (p_store, p_product, p_date, p_quantity)
      on conflict do nothing returning quantity into saved;
  else
    update public.validity_audit_counts
      set quantity = case when p_add then quantity + p_quantity else p_quantity end
      where store_id = p_store and product_id = p_product and expires_on = p_date
        and quantity = p_expected
      returning quantity into saved;
  end if;
  return saved;
end;
$$;

revoke all on function public.save_validity_audit_count(text,text,date,integer,integer,boolean) from public, anon;
grant execute on function public.save_validity_audit_count(text,text,date,integer,integer,boolean) to authenticated;
