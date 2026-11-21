-- Progressive login lockout. Identifier is hashed server-side and never stored in clear text.
create table if not exists public.auth_login_lockouts (
  identifier_hash text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  lock_level integer not null default 0 check (lock_level >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.auth_login_lockouts enable row level security;
revoke all on public.auth_login_lockouts from public, anon, authenticated;
grant all on public.auth_login_lockouts to service_role;

create or replace function public.auth_login_lock_check(p_identifier text)
returns table(allowed boolean, seconds_remaining integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_hash text;
  v_until timestamptz;
begin
  v_hash := encode(sha256(convert_to(regexp_replace(lower(trim(coalesce(p_identifier, ''))), '^@', ''), 'UTF8')), 'hex');
  if v_hash = encode(sha256(convert_to('', 'UTF8')), 'hex') then
    return query select false, 1;
    return;
  end if;
  select l.locked_until into v_until
  from public.auth_login_lockouts l
  where l.identifier_hash = v_hash;
  if v_until is not null and v_until > now() then
    return query select false, greatest(1, ceil(extract(epoch from (v_until - now())))::integer);
  else
    return query select true, 0;
  end if;
end;
$$;

create or replace function public.auth_login_lock_failure(p_identifier text)
returns table(failed_attempts integer, lock_seconds integer, locked_until timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_hash text;
  v_row public.auth_login_lockouts%rowtype;
  v_seconds integer := 0;
begin
  v_hash := encode(sha256(convert_to(regexp_replace(lower(trim(coalesce(p_identifier, ''))), '^@', ''), 'UTF8')), 'hex');
  if v_hash = encode(sha256(convert_to('', 'UTF8')), 'hex') then
    return query select 0, 0, null::timestamptz;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_hash, 0));
  insert into public.auth_login_lockouts(identifier_hash)
  values (v_hash)
  on conflict (identifier_hash) do nothing;

  select * into v_row
  from public.auth_login_lockouts
  where identifier_hash = v_hash
  for update;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    return query select v_row.failed_attempts, greatest(1, ceil(extract(epoch from (v_row.locked_until - now())))::integer), v_row.locked_until;
    return;
  end if;

  v_row.failed_attempts := v_row.failed_attempts + 1;
  v_row.locked_until := null;

  if v_row.failed_attempts >= 5 then
    v_row.lock_level := v_row.lock_level + 1;
    v_seconds := v_row.lock_level * 300;
    v_row.failed_attempts := 0;
    v_row.locked_until := now() + make_interval(secs => v_seconds);
  end if;

  update public.auth_login_lockouts
  set failed_attempts = v_row.failed_attempts,
      lock_level = v_row.lock_level,
      locked_until = v_row.locked_until,
      updated_at = now()
  where identifier_hash = v_hash;

  return query select v_row.failed_attempts, v_seconds, v_row.locked_until;
end;
$$;

create or replace function public.auth_login_lock_success(p_identifier text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_hash text;
begin
  v_hash := encode(sha256(convert_to(regexp_replace(lower(trim(coalesce(p_identifier, ''))), '^@', ''), 'UTF8')), 'hex');
  if v_hash = encode(sha256(convert_to('', 'UTF8')), 'hex') then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_hash, 0));
  delete from public.auth_login_lockouts where identifier_hash = v_hash;
  return true;
end;
$$;

revoke all on function public.auth_login_lock_check(text) from public, anon, authenticated;
revoke all on function public.auth_login_lock_failure(text) from public, anon, authenticated;
revoke all on function public.auth_login_lock_success(text) from public, anon, authenticated;
grant execute on function public.auth_login_lock_check(text) to service_role;
grant execute on function public.auth_login_lock_failure(text) to service_role;
grant execute on function public.auth_login_lock_success(text) to service_role;
