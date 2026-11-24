set local lock_timeout = '2s';

alter table public.chat_setor_mensagens
  alter column remetente_auth_id drop not null,
  drop constraint chat_setor_mensagens_remetente_auth_id_fkey,
  add constraint chat_setor_mensagens_remetente_auth_id_fkey
    foreign key (remetente_auth_id) references auth.users(id) on delete set null;
