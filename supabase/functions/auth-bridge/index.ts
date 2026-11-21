import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createHash, createHmac } from "node:crypto";
import CryptoJS from "npm:crypto-js@4.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, ...extraHeaders } });
}

function lockoutIdentifier(matricula: string, secret: string): string {
  const normalized = matricula.toLowerCase().replace(/^@/, "").trim();
  return createHmac("sha256", secret).update(`login:${normalized}`).digest("hex");
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

  let body: { action?: unknown; matricula?: unknown; senha?: unknown; userId?: unknown; primeiroLogin?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }

  const action = body.action === "provision" ? "provision" : "login";
  const legacyClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "provision") {
    const authHeader = req.headers.get("Authorization") || "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "");
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const senha = typeof body.senha === "string" ? body.senha : "";
    if (!accessToken || !userId || senha.length < 7 || senha.length > 128) {
      return json({ error: "Dados para provisionamento inválidos." }, 400);
    }

    const { data: callerData, error: callerError } = await adminClient.auth.getUser(accessToken);
    if (callerError || !callerData.user) return json({ error: "Sessão expirada. Entre novamente." }, 401);

    const { data: actor, error: actorError } = await adminClient
      .from("usuarios")
      .select("id, cargo, loja_id, ativo")
      .eq("auth_user_id", callerData.user.id)
      .maybeSingle();
    if (actorError || !actor || !actor.ativo) return json({ error: "Usuário responsável não autorizado." }, 403);

    const actorRole = String(actor.cargo || "").toLowerCase();
    const isSaasAdmin = actorRole === "saas_admin";
    const isManager = actorRole.includes("gerente") || actorRole.includes("admin");
    if (!isSaasAdmin && !isManager) return json({ error: "Somente administradores podem cadastrar acessos." }, 403);

    const { data: target, error: targetError } = await adminClient
      .from("usuarios")
      .select("id, matricula, auth_user_id, loja_id, cargo, nome, ativo")
      .eq("id", userId)
      .maybeSingle();
    if (targetError || !target || !target.ativo) return json({ error: "Funcionário não encontrado ou inativo." }, 404);
    if (!isSaasAdmin && String(actor.loja_id || "") !== String(target.loja_id || "")) {
      return json({ error: "Você não pode provisionar usuários de outra loja." }, 403);
    }

    // A RPC privilegiada só é chamada aqui, após autenticar e autorizar o gerente.
    // Ela atualiza senha_hash e mantém o ID do cadastro; service_role nunca chega ao browser.
    const { data: syncData, error: syncError } = await adminClient.rpc("rpc_sync_user_password", {
      p_matricula: String(target.matricula),
      p_senha: senha,
      p_user_id: String(target.id),
      p_is_first_login: Boolean(body.primeiroLogin ?? true),
    });
    if (syncError || syncData?.success === false) {
      return json({ error: "Não foi possível criar a conta de autenticação." }, 503);
    }

    const { data: linked, error: linkedError } = await adminClient
      .from("usuarios")
      .select("auth_user_id")
      .eq("id", userId)
      .maybeSingle();
    if (linkedError || !linked?.auth_user_id) {
      return json({ error: "A conta foi criada, mas o vínculo com o cadastro não foi confirmado." }, 503);
    }

    const email = syntheticEmail(String(target.matricula), String(target.id));
    const { error: metadataError } = await adminClient.auth.admin.updateUserById(String(linked.auth_user_id), {
      email,
      app_metadata: {
        matricula: String(target.matricula),
        cargo: String(target.cargo || ""),
        loja_id: target.loja_id ? String(target.loja_id) : null,
      },
      user_metadata: { nome: String(target.nome || "") },
    });
    if (metadataError) return json({ error: "Conta criada, mas não foi possível atualizar os dados de acesso." }, 503);
    return json({ success: true });
  }

  const matricula = typeof body.matricula === "string" ? body.matricula.trim().slice(0, 64) : "";
  const senha = typeof body.senha === "string" ? body.senha : "";
  if (!matricula || !senha || senha.length > 128) {
    return json({ error: "Matrícula ou senha inválida." }, 400);
  }

  // Bloqueio progressivo persistido no banco. A matrícula nunca é armazenada:
  // usamos HMAC-SHA256 com segredo exclusivo da Edge Function.
  const lockoutSecret = Deno.env.get("AUTH_LOCKOUT_SECRET") || "";
  if (lockoutSecret.length < 32) {
    return json({ error: "Proteção de login não configurada. Tente novamente mais tarde." }, 503);
  }
  const lockoutKey = lockoutIdentifier(matricula, lockoutSecret);
  const lockCheck = await adminClient.rpc("auth_login_lock_check", { p_identifier: lockoutKey });
  if (lockCheck.error) {
    return json({ error: "Proteção de login temporariamente indisponível. Tente novamente." }, 503);
  }
  const lockRow = Array.isArray(lockCheck.data) ? lockCheck.data[0] : lockCheck.data;
  if (lockRow && lockRow.allowed === false) {
    const seconds = Math.max(1, Number(lockRow.seconds_remaining || 1));
    const minutes = Math.ceil(seconds / 60);
    return json({ error: `Muitas tentativas incorretas. Acesso bloqueado; tente novamente em ${minutes} minuto(s).`, retry_after: seconds }, 429, { "Retry-After": String(seconds) });
  }

  const recordFailedAttempt = async () => {
    const result = await adminClient.rpc("auth_login_lock_failure", { p_identifier: lockoutKey });
    if (result.error) return null;
    return Array.isArray(result.data) ? result.data[0] : result.data;
  };

  // A RPC antiga verifica senha_hash/legado. O endpoint não aceita userId
  // no modo login: a identidade vem exclusivamente da matrícula validada.
  const normalizedMatricula = matricula.toLowerCase().replace(/^@/, "");
  const loginCandidates = Array.from(new Set([matricula, normalizedMatricula, `@${normalizedMatricula}`]));
  let validation: any = null;
  let validationError: any = null;
  for (const candidate of loginCandidates) {
    const result = await legacyClient.rpc("rpc_login_usuario", {
      p_matricula: candidate,
      p_senha: senha,
    });
    validation = result.data;
    validationError = result.error;
    if (!validationError && validation?.success && validation?.user?.id) break;
  }

  let storedUser: Record<string, unknown> | null = null;
  let legacyUser: Record<string, unknown> | null = null;

  if (!validationError && validation?.success && validation?.user?.id) {
    legacyUser = validation.user as Record<string, unknown>;
    const { data, error } = await adminClient
      .from("usuarios")
      .select("id, matricula, auth_user_id, loja_id, cargo, nome, setor, primeiro_login, ativo")
      .eq("id", String(legacyUser.id))
      .eq("ativo", true)
      .maybeSingle();
    if (error) return json({ error: "Não foi possível validar o cadastro." }, 503);
    storedUser = data;
  } else if (validationError) {
    // Erro de infraestrutura na RPC não conta como tentativa de senha inválida.
    return json({ error: "Não foi possível validar a credencial agora. Tente novamente." }, 503);
  } else {
    // Migração de registros antigos cuja senha ainda está cifrada com CryptoJS AES.
    // A chave legada deve existir somente como secret da Edge Function.
    const normalized = matricula.toLowerCase().replace(/^@/, "");
    const candidates = Array.from(new Set([matricula, normalized, `@${normalized}`]));
    const { data, error } = await adminClient
      .from("usuarios")
      .select("id, matricula, auth_user_id, loja_id, cargo, nome, setor, primeiro_login, ativo, senha")
      .in("matricula", candidates)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    if (error) return json({ error: "Não foi possível consultar o cadastro. Tente novamente." }, 503);
    if (!data) {
      const failure = await recordFailedAttempt();
      if (!failure) return json({ error: "Proteção de login temporariamente indisponível. Tente novamente." }, 503);
      if (Number(failure.lock_seconds || 0) > 0) {
        const minutes = Math.ceil(Number(failure.lock_seconds) / 60);
        return json({ error: `Muitas tentativas incorretas. Acesso bloqueado por ${minutes} minuto(s).`, retry_after: Number(failure.lock_seconds) }, 429, { "Retry-After": String(Number(failure.lock_seconds)) });
      }
      return json({ error: "Matrícula ou senha incorreta." }, 401);
    }

    const encryptedPassword = String(data.senha || "");
    const legacyKey = Deno.env.get("LEGACY_ENCRYPTION_KEY") || "";
    if (!encryptedPassword.startsWith("U2FsdGVk")) {
      const failure = await recordFailedAttempt();
      if (!failure) return json({ error: "Proteção de login temporariamente indisponível. Tente novamente." }, 503);
      if (Number(failure.lock_seconds || 0) > 0) {
        const minutes = Math.ceil(Number(failure.lock_seconds) / 60);
        return json({ error: "Muitas tentativas incorretas. Acesso bloqueado por " + minutes + " minuto(s).", retry_after: Number(failure.lock_seconds) }, 429, { "Retry-After": String(Number(failure.lock_seconds)) });
      }
      return json({ error: "Matrícula ou senha incorreta." }, 401);
    }
    if (!legacyKey) {
      return json({ error: "A migração desta credencial antiga ainda não está configurada." }, 503);
    }

    let decryptedPassword = "";
    try {
      decryptedPassword = CryptoJS.AES.decrypt(encryptedPassword, legacyKey).toString(CryptoJS.enc.Utf8);
    } catch {
      decryptedPassword = "";
    }
    if (!decryptedPassword || decryptedPassword !== senha) {
      const failure = await recordFailedAttempt();
      if (!failure) return json({ error: "Proteção de login temporariamente indisponível. Tente novamente." }, 503);
      if (Number(failure.lock_seconds || 0) > 0) {
        const minutes = Math.ceil(Number(failure.lock_seconds) / 60);
        return json({ error: `Muitas tentativas incorretas. Acesso bloqueado por ${minutes} minuto(s).`, retry_after: Number(failure.lock_seconds) }, 429, { "Retry-After": String(Number(failure.lock_seconds)) });
      }
      return json({ error: "Matrícula ou senha incorreta." }, 401);
    }

    // Após conferir o AES no servidor, converte a credencial para bcrypt e vincula
    // o usuário Auth. A RPC é invocada somente do servidor com service_role.
    const { data: syncData, error: syncError } = await adminClient.rpc("rpc_sync_user_password", {
      p_matricula: String(data.matricula),
      p_senha: senha,
      p_user_id: String(data.id),
      p_is_first_login: null,
    });
    if (syncError || syncData?.success === false) {
      return json({ error: "Não foi possível migrar a credencial antiga." }, 503);
    }
    storedUser = data;
    legacyUser = {
      id: data.id,
      matricula: data.matricula,
      nome: data.nome,
      cargo: data.cargo,
      setor: data.setor,
      loja_id: data.loja_id,
      loja_nome: "",
      primeiro_login: data.primeiro_login ?? false,
    };
  }

  if (!storedUser || !legacyUser) {
    return json({ error: "Usuário não encontrado ou inativo." }, 403);
  }

  // Senha correta: contador e nível de bloqueio são zerados imediatamente.
  const resetLock = await adminClient.rpc("auth_login_lock_success", { p_identifier: lockoutKey });
  if (resetLock.error) {
    return json({ error: "Não foi possível concluir a validação segura. Tente novamente." }, 503);
  }

  const userId = String(storedUser.id);

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
      if (error || !data.user) return json({ error: "Não foi possível criar a conta de autenticação." }, 503);
      authUserId = data.user.id;
    }

    const { error: linkError } = await adminClient
      .from("usuarios")
      .update({ auth_user_id: authUserId })
      .eq("id", userId)
      .eq("ativo", true);
    if (linkError) return json({ error: "Conta criada, mas o vínculo não foi salvo. Tente novamente." }, 503);
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
