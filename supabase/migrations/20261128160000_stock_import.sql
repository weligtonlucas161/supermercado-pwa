alter table public.produtos add column last_stock_import jsonb;

create table private.stock_imports (
  id uuid primary key,
  store_id text not null references public.lojas(id) on delete cascade,
  actor_id uuid not null,
  filename text not null,
  mode text not null check (mode in ('baseline', 'update')),
  expected integer not null check (expected between 1 and 100000),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  reverted_at timestamptz,
  preview_version text,
  applied_version text,
  summary jsonb
);

create index stock_imports_store_history on private.stock_imports (store_id, applied_at desc)
  where applied_at is not null;

create table private.stock_import_rows (
  import_id uuid not null references private.stock_imports(id) on delete cascade,
  ean_hash text not null check (ean_hash ~ '^h[01]:[a-f0-9]{64}$'),
  quantity integer not null check (quantity between 0 and 10000000),
  payload jsonb not null,
  primary key (import_id, ean_hash)
);

create table private.stock_import_movements (
  import_id uuid not null references private.stock_imports(id) on delete cascade,
  product_id text not null,
  previous integer,
  current integer not null,
  movement text not null,
  primary key (import_id, product_id)
);

create index stock_import_movements_product on private.stock_import_movements (product_id, import_id);

alter table private.stock_imports enable row level security;
alter table private.stock_import_rows enable row level security;
alter table private.stock_import_movements enable row level security;
revoke all on private.stock_imports, private.stock_import_rows, private.stock_import_movements
  from public, anon, authenticated;

create function private.stock_import_version(p_store text)
returns text language sql stable set search_path = '' as $$
  select md5(coalesce(string_agg(jsonb_build_array(id, xmin::text, quantidade, ean_hash)::text,
    ',' order by id), ''))
  from public.produtos where loja_id = p_store
$$;

create function private.compare_stock_import(p_id uuid, p_store text, p_mode text)
returns table (product_id text, ean_hash text, previous integer, current integer, movement text, absent boolean)
language sql stable set search_path = '' as $$
  select p.id, coalesce(r.ean_hash, p.ean_hash), p.quantidade, coalesce(r.quantity, 0),
    case
      when p_mode = 'baseline' then 'baseline'
      when p.id is null then 'new'
      when coalesce(r.quantity, 0) = 0 and coalesce(p.quantidade, 0) > 0 then 'zeroed'
      when coalesce(r.quantity, 0) = 0 then 'still_zero'
      when coalesce(p.quantidade, 0) = 0 then 'restocked'
      when r.quantity < p.quantidade then 'out'
      when r.quantity > p.quantidade then 'in'
      else 'unchanged'
    end, r.ean_hash is null
  from (select id, ean_hash, quantidade from public.produtos where loja_id = p_store) p
  full join (select ean_hash, quantity from private.stock_import_rows where import_id = p_id) r
    on p.ean_hash = r.ean_hash
$$;

create function public.stock_import(
  p_action text, p_store text, p_id uuid default null, p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer
set search_path = '' set statement_timeout = '45s' as $$
declare
  batch private.stock_imports%rowtype;
  version text;
  comparison_summary jsonb;
  actor uuid := auth.uid();
begin
  if actor is null or not private.is_store_manager(p_store) then
    raise exception 'A importação integral é restrita à gerência da loja.' using errcode = '42501';
  end if;

  if p_action = 'history' then
    return coalesce((
      select jsonb_agg(to_jsonb(h) order by h.applied_at desc) from (
        select id, filename, mode, applied_at, reverted_at, summary
        from private.stock_imports
        where store_id = p_store and applied_at is not null
        order by applied_at desc limit 30
      ) h
    ), '[]'::jsonb);
  end if;

  if p_action = 'product_history' then
    return coalesce((
      select jsonb_agg(to_jsonb(h) order by h.applied_at desc) from (
        select i.id, i.filename, i.applied_at, i.reverted_at, m.previous, m.current, m.movement,
          (select min(last_change.applied_at) from private.stock_imports last_change
            join private.stock_import_movements lm on lm.import_id = last_change.id
            where lm.product_id = m.product_id and last_change.store_id = p_store
              and last_change.reverted_at is null
              and last_change.applied_at > coalesce((
                select max(ch.applied_at) from private.stock_imports ch
                join private.stock_import_movements cm on cm.import_id = ch.id
                where cm.product_id = m.product_id and ch.store_id = p_store
                  and ch.reverted_at is null and ch.applied_at <= i.applied_at
                  and (cm.movement = 'baseline' or cm.previous is distinct from cm.current)
              ), '-infinity'::timestamptz)
              and last_change.applied_at <= i.applied_at) as unchanged_since
        from private.stock_import_movements m join private.stock_imports i on i.id = m.import_id
        where m.product_id = p_data->>'product_id' and i.store_id = p_store
        order by i.applied_at desc limit 30
      ) h
    ), '[]'::jsonb);
  end if;

  if p_action = 'begin' then
    delete from private.stock_imports where store_id = p_store and actor_id = actor
      and applied_at is null and created_at < now() - interval '1 day';
    insert into private.stock_imports (id, store_id, actor_id, filename, mode, expected)
      values (p_id, p_store, actor, left(p_data->>'filename', 255), p_data->>'mode', (p_data->>'count')::integer)
      on conflict (id) do nothing;
  end if;

  select * into batch from private.stock_imports where id = p_id and store_id = p_store for update;
  if not found or (p_action <> 'revert' and batch.actor_id <> actor) then
    raise exception 'Importação indisponível.' using errcode = '42501';
  end if;

  if p_action = 'begin' then return '{}'::jsonb; end if;

  if p_action = 'stage' then
    if batch.applied_at is not null or batch.preview_version is not null
      or jsonb_typeof(p_data) is distinct from 'array' or jsonb_array_length(p_data) not between 1 and 400 then
      raise exception 'Lote inválido ou já revisado.';
    end if;
    insert into private.stock_import_rows (import_id, ean_hash, quantity, payload)
      select p_id, r->>'ean_hash', (r->>'quantity')::integer, r - 'ean_hash' - 'quantity'
      from jsonb_array_elements(p_data) r
      where length(r->>'nome') between 1 and 2000 and length(r->>'codigo_barras') between 1 and 1000
        and length(r->>'setor') between 1 and 80 and length(r->>'ciphertext') between 1 and 12000
        and length(r->>'iv') between 1 and 100;
    if (select count(*) from private.stock_import_rows where import_id = p_id) > batch.expected then
      raise exception 'Quantidade de linhas diverge da planilha.';
    end if;
    return '{}'::jsonb;
  end if;

  if p_action = 'apply' and batch.applied_at is not null and batch.reverted_at is null then
    return batch.summary;
  end if;

  if p_action in ('apply', 'revert') then
    if not pg_try_advisory_xact_lock(hashtextextended(p_store, 16802)) then
      raise exception 'Já há uma importação sendo processada nesta loja.';
    end if;
    -- A FK dos produtos toma KEY SHARE na loja para novos cadastros.
    -- Trave a loja e os produtos existentes para impedir alterações após a prévia.
    perform id from public.lojas where id = p_store for update nowait;
    perform id from public.produtos where loja_id = p_store order by id for update nowait;
  end if;

  if p_action = 'revert' then
    if batch.reverted_at is not null then return batch.summary; end if;
    if batch.applied_at is null or batch.applied_version is distinct from private.stock_import_version(p_store)
      or exists (select 1 from private.stock_imports i
        where i.store_id = p_store and i.applied_at > batch.applied_at) then
      raise exception 'O estoque já mudou após esta importação. A reversão foi bloqueada.';
    end if;
    update public.produtos p set quantidade = coalesce(m.previous, 0), last_stock_import = null, updated_at = now()
      from private.stock_import_movements m
      where m.import_id = p_id and p.id = m.product_id and p.loja_id = p_store
        and (p.last_stock_import is not null or p.quantidade is distinct from coalesce(m.previous, 0));
    update private.stock_imports set reverted_at = clock_timestamp() where id = p_id;
    return batch.summary;
  end if;

  if p_action not in ('preview', 'apply') or batch.applied_at is not null then
    raise exception 'Ação de importação inválida.';
  end if;

  if (select count(*) from private.stock_import_rows where import_id = p_id) <> batch.expected then
    raise exception 'A planilha contém dados inválidos ou incompletos.';
  end if;
  if exists (select 1 from public.produtos where loja_id = p_store and ean_hash is null) then
    raise exception 'Há produtos sem código indexado na loja. Corrija o cadastro antes de importar.';
  end if;
  if exists (
    select distinct left(ean_hash, 3) from public.produtos where loja_id = p_store
    except
    select distinct left(ean_hash, 3) from private.stock_import_rows where import_id = p_id
  ) then
    raise exception 'O formato dos códigos da planilha não é compatível com o índice da loja.';
  end if;

  version := private.stock_import_version(p_store);

  if p_action = 'preview' then
    select jsonb_build_object(
      'total', count(*), 'new', count(*) filter (where product_id is null),
      'out', count(*) filter (where movement = 'out'),
      'in', count(*) filter (where movement = 'in'),
      'restocked', count(*) filter (where movement = 'restocked'),
      'unchanged', count(*) filter (where movement = 'unchanged'),
      'zeroed', count(*) filter (where previous > 0 and current = 0),
      'still_zero', count(*) filter (where product_id is not null and previous = 0 and current = 0),
      'absent', count(*) filter (where absent),
      'large_reduction', coalesce(sum(previous), 0) > 0
        and coalesce(sum(current), 0) < sum(previous) * 0.7
    ) into comparison_summary from private.compare_stock_import(p_id, p_store, batch.mode);
    if version is distinct from private.stock_import_version(p_store) then
      raise exception 'O estoque mudou durante a comparação. Recarregue a prévia.';
    end if;
    update private.stock_imports set preview_version = version, summary = comparison_summary where id = p_id;
    return comparison_summary;
  end if;

  if batch.preview_version is distinct from version then
    raise exception 'O estoque mudou desde a prévia. Gere uma nova comparação.';
  end if;

  with comparison as materialized (select * from private.compare_stock_import(p_id, p_store, batch.mode)),
  inserted as (
    insert into public.produtos (loja_id, ean_hash, nome, codigo_barras, plu, codigo_fornecedor,
      setor, departamento, quantidade, is_encrypted, ciphertext, iv, last_stock_import)
    select p_store, r.ean_hash, r.payload->>'nome', r.payload->>'codigo_barras',
      r.payload->>'plu', r.payload->>'codigo_fornecedor', r.payload->>'setor', r.payload->>'departamento',
      r.quantity, true, r.payload->>'ciphertext', r.payload->>'iv',
      jsonb_build_object('movement', c.movement, 'previous', c.previous, 'current', c.current)
    from comparison c join private.stock_import_rows r on r.import_id = p_id and r.ean_hash = c.ean_hash
    where c.product_id is null returning id, ean_hash
  )
  insert into private.stock_import_movements (import_id, product_id, previous, current, movement)
    select p_id, coalesce(c.product_id, i.id), c.previous, c.current, c.movement
    from comparison c left join inserted i on i.ean_hash = c.ean_hash;

  with details as (
    select product_id, current, jsonb_build_object('movement', movement, 'previous', previous, 'current', current) as badge
    from private.stock_import_movements where import_id = p_id
  )
  update public.produtos p set quantidade = m.current, last_stock_import = m.badge, updated_at = now()
    from details m where m.product_id = p.id and p.loja_id = p_store
      and (p.quantidade is distinct from m.current or p.last_stock_import is distinct from m.badge);

  insert into public.produtos_catalogo_universal (codigo_barras, nome, ean_hash, criado_em, atualizado_em)
    select p.codigo_barras, p.nome, p.ean_hash, now(), now()
    from private.stock_import_movements m
    join public.produtos p on p.id = m.product_id
    where m.import_id = p_id and m.previous is null
      and not exists (select 1 from public.produtos_catalogo_universal c where c.ean_hash = p.ean_hash)
    on conflict do nothing;

  update private.stock_imports set applied_at = clock_timestamp(), applied_version = private.stock_import_version(p_store)
    where id = p_id;
  delete from private.stock_import_rows where import_id = p_id;
  return batch.summary;
end
$$;

revoke all on function private.stock_import_version(text), private.compare_stock_import(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.stock_import(text, text, uuid, jsonb) from public, anon;
grant execute on function public.stock_import(text, text, uuid, jsonb) to authenticated;
