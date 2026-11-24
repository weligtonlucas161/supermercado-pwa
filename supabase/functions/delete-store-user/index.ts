import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' },
});

const normalizedRole = (role: unknown) => String(role ?? '').trim().toLowerCase();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'configuration_missing' }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  const { data: actor, error: actorError } = await admin.from('usuarios')
    .select('id,loja_id,cargo,ativo').eq('auth_user_id', user.id).maybeSingle();
  if (actorError) return json({ error: 'lookup_failed' }, 500);
  const actorRole = normalizedRole(actor?.cargo);
  const isSaas = actorRole === 'saas_admin';
  const isManager = actorRole === 'gerente geral' || actorRole === 'gerente geral da loja';
  if (!actor?.ativo || (!isSaas && (!isManager || !actor.loja_id))) return json({ error: 'forbidden' }, 403);

  let input: { employeeId?: unknown } | null;
  try { input = await request.json(); } catch { return json({ error: 'invalid_employee' }, 400); }
  const employeeId = input?.employeeId;
  if (typeof employeeId !== 'string' || employeeId.length > 64 || !employeeId.trim()) {
    return json({ error: 'invalid_employee' }, 400);
  }

  const { data: target, error: targetError } = await admin.from('usuarios')
    .select('id,loja_id,cargo,auth_user_id').eq('id', employeeId).maybeSingle();
  if (targetError) return json({ error: 'lookup_failed' }, 500);
  if (!target) return json({ error: 'user_not_found' }, 404);
  if ((!isSaas && target.loja_id !== actor.loja_id) || normalizedRole(target.cargo) === 'saas_admin' ||
      target.id === actor.id || target.auth_user_id === user.id) {
    return json({ error: 'forbidden_target' }, 403);
  }

  if (target.auth_user_id) {
    const { error } = await admin.auth.admin.deleteUser(target.auth_user_id);
    if (error && error.code !== 'user_not_found') return json({ error: 'auth_delete_failed' }, 500);
  }
  let deletion = admin.from('usuarios').delete().eq('id', target.id);
  deletion = target.loja_id == null ? deletion.is('loja_id', null) : deletion.eq('loja_id', target.loja_id);
  const { data: deleted, error } = await deletion.select('id').maybeSingle();
  if (error || !deleted) return json({ error: 'profile_delete_failed' }, 500);
  return json({ success: true });
});
