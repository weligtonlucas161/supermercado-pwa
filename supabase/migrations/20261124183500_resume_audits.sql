set local lock_timeout = '2s';

create extension if not exists pg_cron;

alter table public.auditoria_presenca_sessoes add column retomada boolean not null default false;

alter table public.auditorias_finalizadas
  add column encerrada_por_tempo boolean not null default false;

create function private.archive_expired_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status <> 'ATIVA' or new.status <> 'CONCLUIDA'
     or old.tipo not in ('PRESENCA','INVENTARIO')
     or old.timestamp + 18000000 > (extract(epoch from now()) * 1000)::bigint then
    return new;
  end if;

  insert into public.auditorias_finalizadas (
    id,loja_id,setor,tipo,iniciada_por_nome,iniciada_por_matricula,finalizada_por_nome,
    finalizada_por_matricula,iniciada_em,finalizada_em,data_auditoria,hora_auditoria,chave_auditoria,
    encerrada_por_tempo
  ) values (old.id,old.loja_id,old.setor,old.tipo,old.iniciada_por_nome,old.iniciada_por_matricula,
    'Encerramento automático',old.iniciada_por_matricula,old.timestamp,old.timestamp+18000000,
    old.data_auditoria,old.hora_auditoria,old.chave_auditoria,true)
  on conflict (id) do nothing;

  insert into public.auditoria_produtos (
    id, sessao_id, loja_id, produto_id, codigo_barras, plu, nome, setor,
    quantidade_sistema, quantidade_fisica, divergencia, status_presenca,
    data_auditoria, hora_auditoria, chave_auditoria, operador_nome, operador_matricula, auditado_em
  )
  select old.id || ':timeout:' || coalesce(p.id,b.produto_id), old.id, old.loja_id,
    coalesce(p.id,b.produto_id), coalesce(b.codigo_barras,p.codigo_barras), p.plu,
    coalesce(b.produto_nome,p.nome), old.setor, coalesce(p.quantidade,0), b.quantidade_fisica,
    case when old.tipo='INVENTARIO' and b.quantidade_fisica is not null then b.quantidade_fisica-coalesce(p.quantidade,0) end,
    case when b.id is null then 'PENDENTE' else 'CONFIRMADO' end,
    old.data_auditoria, old.hora_auditoria, old.chave_auditoria, b.operador_nome, b.operador_matricula,
    coalesce(b.timestamp,old.timestamp + 18000000)
  from (
    select id,codigo_barras,nome,plu,quantidade
    from public.produtos where loja_id=old.loja_id and upper(btrim(setor))=upper(btrim(old.setor))
  ) p full join (
    select distinct on (produto_id) * from public.auditoria_presenca_bips
    where sessao_id=old.id and loja_id=old.loja_id
    order by produto_id,timestamp desc,id desc
  ) b on b.produto_id=p.id
  where not exists (select 1 from public.auditoria_produtos existing
    where existing.sessao_id=old.id and existing.loja_id=old.loja_id)
  on conflict (id) do nothing;

  -- For a reopened session, merge additional scans into the saved snapshot.
  update public.auditoria_produtos item
    set status_presenca='CONFIRMADO', quantidade_fisica=b.quantidade_fisica,
        divergencia=case when old.tipo='INVENTARIO' and b.quantidade_fisica is not null
          then b.quantidade_fisica-item.quantidade_sistema end,
        operador_nome=b.operador_nome, operador_matricula=b.operador_matricula, auditado_em=b.timestamp
  from public.auditoria_presenca_bips b
  where item.sessao_id=old.id and item.loja_id=old.loja_id and b.sessao_id=old.id
    and b.loja_id=old.loja_id and b.produto_id=item.produto_id
    and item.status_presenca <> 'CONFIRMADO';

  insert into public.auditorias_finalizadas (
    id,loja_id,setor,tipo,iniciada_por_nome,iniciada_por_matricula,finalizada_por_nome,
    finalizada_por_matricula,total_esperado,total_auditado,total_divergentes,iniciada_em,finalizada_em,
    data_auditoria,hora_auditoria,chave_auditoria,duracao_label,camera_scans_count,encerrada_por_tempo
  )
  select old.id,old.loja_id,old.setor,old.tipo,old.iniciada_por_nome,old.iniciada_por_matricula,
    'Encerramento automático',old.iniciada_por_matricula,count(*),
    count(*) filter(where status_presenca='CONFIRMADO'),count(*) filter(where status_presenca<>'CONFIRMADO'),
    old.timestamp,old.timestamp+18000000,old.data_auditoria,old.hora_auditoria,old.chave_auditoria,
    '5h',count(*) filter(where status_presenca='CONFIRMADO'),true
  from public.auditoria_produtos where sessao_id=old.id and loja_id=old.loja_id
  on conflict(id) do update set
    total_esperado=excluded.total_esperado,total_auditado=excluded.total_auditado,
    total_divergentes=excluded.total_divergentes,finalizada_em=excluded.finalizada_em,
    finalizada_por_nome=excluded.finalizada_por_nome,camera_scans_count=excluded.camera_scans_count,
    duracao_label=excluded.duracao_label,encerrada_por_tempo=true;
  return new;
end;
$$;

revoke all on function private.archive_expired_audit() from public, anon, authenticated;
create trigger archive_expired_audit before update of status on public.auditoria_presenca_sessoes
for each row execute function private.archive_expired_audit();

select cron.schedule('superpwa-close-expired-audits', '* * * * *', $job$
  update public.auditoria_presenca_sessoes set status='CONCLUIDA'
  where status='ATIVA' and tipo in ('PRESENCA','INVENTARIO')
    and timestamp <= (extract(epoch from now()) * 1000)::bigint - 18000000
$job$);

create function public.resume_audit_report(p_session text,p_store text)
returns public.auditoria_presenca_sessoes language plpgsql security definer set search_path = '' as $$
declare
  actor public.usuarios;
  resumed public.auditoria_presenca_sessoes;
begin
  select * into actor from public.usuarios where auth_user_id=(select auth.uid()) and ativo is true;
  if actor.id is null or actor.loja_id is distinct from p_store or not private.is_store_member(p_store) then
    raise exception 'Loja não autorizada' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor.id,0));
  if exists(select 1 from public.auditoria_presenca_sessoes s where s.loja_id=p_store and s.status='ATIVA'
    and s.iniciada_por_matricula=actor.matricula and s.timestamp>(extract(epoch from now())*1000)::bigint-18000000) then
    raise exception 'Você já tem uma auditoria ativa' using errcode='55000';
  end if;

  update public.auditoria_presenca_sessoes s set status='ATIVA', retomada=true, timestamp=(extract(epoch from now())*1000)::bigint,
    iniciada_por_nome=actor.nome,iniciada_por_matricula=actor.matricula
  from public.auditorias_finalizadas a
  where s.id=p_session and s.loja_id=p_store and s.status='CONCLUIDA'
    and a.id=s.id and a.loja_id=s.loja_id and a.tipo in ('PRESENCA','INVENTARIO')
    and a.total_divergentes>0
    and (a.iniciada_por_matricula=actor.matricula or private.is_store_manager(p_store))
    and (upper(btrim(coalesce(actor.setor,''))) in ('TODOS','GERAL',upper(btrim(s.setor)))
      or private.is_store_manager(p_store))
  returning s.* into resumed;
  if not found then raise exception 'A auditoria não pode ser retomada' using errcode='55000'; end if;
  return resumed;
end;
$$;

revoke all on function public.resume_audit_report(text,text) from public, anon;
grant execute on function public.resume_audit_report(text,text) to authenticated;
