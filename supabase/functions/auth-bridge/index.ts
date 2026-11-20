import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createHash } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function syntheticEmail(matricula: string, userId: string): string {
  const normalized = matricula.toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = createHash("md5").update(userId).digest("hex").slice(0, 6);
  return `${normalized}_${suffix}@superpwa.app`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Serviço de autenticação não configurado." }, 503);
  }

  let body: { matricula?: unknown; senha?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }

  const matricula = typeof body.matricula === "string" ? body.matricula.trim().slice(0, 64) : "";
  const senha = typeof body.senha === "string" ? body.senha : "";
  if (!matricula || !senha || senha.length > 128) {
    return json({ error: "Matrícula ou senha inválida." }, 400);
  }

  const legacyClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // A RPC antiga é usada somente como verificador de credenciais: ela compara
  // a senha com senha_hash/legado e não recebe permissão para escolher o usuário.
  const { data: validation, error: validationError } = await legacyClient.rpc("rpc_login_usuario", {
    p_matricula: matricula,
    p_senha: senha,
  });
  if (validationError || !validation?.success || !validation?.user?.id) {
    return json({ error: "Matrícula ou senha incorreta." }, 401);
  }

  const legacyUser = validation.user as Record<string, unknown>;
  const userId = String(legacyUser.id);
  const { data: storedUser, error: storedUserError } = await adminClient
    .from("usuarios")
    .select("id, matricula, auth_user_id, loja_id, cargo, nome, ativo")
    .eq("id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (storedUserError || !storedUser) {
    return json({ error: "Usuário não encontrado ou inativo." }, 403);
  }

  const email = syntheticEmail(String(storedUser.matricula), userId);
  const appMetadata = {
    matricula: String(storedUser.matricula),
    cargo: String(storedUser.cargo || ""),
    loja_id: storedUser.loja_id ? String(storedUser.loja_id) : null,
  };

  let authUserId = storedUser.auth_user_id ? String(storedUser.auth_user_id) : "";
  if (authUserId) {
    const { error } = await adminClient.auth.admin.updateUserById(authUserId, {
      email,
      password: senha,
      email_confirm: true,
      app_metadata: appMetadata,
    });
    if (error) return json({ error: "Não foi possível atualizar a conta de autenticação." }, 503);
  } else {
    // Primeiro tenta localizar uma conta criada anteriormente pela rotina legada.
    let existingUser: { id: string } | null = null;
    for (let page = 1; page <= 10 && !existingUser; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return json({ error: "Não foi possível consultar as contas de autenticação." }, 503);
      const match = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
      if (match) existingUser = { id: match.id };
      if (data.users.length < 1000) break;
    }

    if (existingUser) {
      authUserId = existingUser.id;
      const { error } = await adminClient.auth.admin.updateUserById(authUserId, {
        password: senha,
        email_confirm: true,
        app_metadata: appMetadata,
      });
      if (error) return json({ error: "Não foi possível atualizar a conta de autenticação." }, 503);
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        app_metadata: appMetadata,
        user_metadata: { nome: String(storedUser.nome || "") },
      });
      if (error || !data.user) {
        return json({ error: "Não foi possível criar a conta de autenticação." }, 503);
      }
      authUserId = data.user.id;
    }

    const { error: linkError } = await adminClient
      .from("usuarios")
      .update({ auth_user_id: authUserId })
      .eq("id", userId)
      .eq("ativo", true);
    if (linkError) return json({ error: "Conta criada, mas não foi possível vinculá-la ao cadastro. Tente novamente." }, 503);
  }

  const { data: authResult, error: signInError } = await legacyClient.auth.signInWithPassword({
    email,
    password: senha,
  });
  if (signInError || !authResult.session) {
    return json({ error: "Conta provisionada, mas não foi possível iniciar a sessão. Tente novamente." }, 503);
  }

  return json({
    session: {
      access_token: authResult.session.access_token,
      refresh_token: authResult.session.refresh_token,
    },
    user: legacyUser,
  });
});
