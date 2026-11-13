import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { 
  Product, 
  ValidityItem, 
  AuditItem, 
  SpreadsheetProductItem, 
  LoginResult, 
  AuthUser, 
  OfflineAction,
  Store,
  StoreEmployee,
  StoreRole,
  ChatMessage,
  AvariaItem
} from '../types';
import { decryptSingleField, isEncrypted } from '../utils/encryptionUtils';

export const SUPABASE_STORAGE_KEYS = {
  URL: 'superpwa_supabase_url',
  KEY: 'superpwa_supabase_anon_key',
};

// Credenciais oficiais do projeto Supabase fornecidas pelo usuário
const DEFAULT_FALLBACK_URL = 'https://senbgpiuhjtlpnhvpykh.supabase.co';
const DEFAULT_FALLBACK_KEY = 'sb_publishable_8T__DxVCm4aYMJB_pGtIeA_79V65KbL';

function resolveConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(SUPABASE_STORAGE_KEYS.URL) || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(SUPABASE_STORAGE_KEYS.KEY) || '' : '';

  // Prioridade: LocalStorage customizado > Variável de Ambiente Vite > Credenciais do Projeto
  const activeUrl = localUrl.trim() || envUrl.trim() || DEFAULT_FALLBACK_URL;
  const activeKey = localKey.trim() || envKey.trim() || DEFAULT_FALLBACK_KEY;

  const isConfigured = Boolean(
    activeUrl &&
    activeKey &&
    activeUrl !== 'https://seu-projeto.supabase.co' &&
    activeUrl.startsWith('http')
  );

  return {
    url: activeUrl,
    key: activeKey,
    isConfigured,
    source: (localUrl ? 'custom' : envUrl ? 'env' : 'default') as 'custom' | 'env' | 'default',
  };
}

let activeConfig = resolveConfig();
let client: SupabaseClient | null = null;

if (activeConfig.isConfigured) {
  try {
    client = createClient(activeConfig.url, activeConfig.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.warn('Erro ao inicializar Supabase client:', err);
    client = null;
  }
}

export const supabase = client;

export function isSupabaseConfigured(): boolean {
  return !!client && activeConfig.isConfigured;
}

export function getSupabaseConfigInfo() {
  return {
    isConfigured: isSupabaseConfigured(),
    url: activeConfig.url,
    source: activeConfig.source,
  };
}

/**
 * Permite configurar o Supabase dinamicamente via interface (armazenado em localStorage)
 */
export function setCustomSupabaseConfig(url: string, key: string): { success: boolean; message: string } {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return { success: false, message: 'A URL do Supabase deve iniciar com https:// ou http://' };
  }

  if (!cleanKey || cleanKey.length < 20) {
    return { success: false, message: 'A chave anônima (anon key) do Supabase é inválida.' };
  }

  try {
    const testClient = createClient(cleanUrl, cleanKey);
    client = testClient;
    activeConfig = {
      url: cleanUrl,
      key: cleanKey,
      isConfigured: true,
      source: 'custom',
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(SUPABASE_STORAGE_KEYS.URL, cleanUrl);
      localStorage.setItem(SUPABASE_STORAGE_KEYS.KEY, cleanKey);
    }

    return { success: true, message: 'Configuração do Supabase salva com sucesso!' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Falha ao instanciar cliente Supabase: ${msg}` };
  }
}

/**
 * Remove a configuração customizada do Supabase
 */
export function clearCustomSupabaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SUPABASE_STORAGE_KEYS.URL);
    localStorage.removeItem(SUPABASE_STORAGE_KEYS.KEY);
  }
  activeConfig = resolveConfig();
  if (activeConfig.isConfigured) {
    client = createClient(activeConfig.url, activeConfig.key);
  } else {
    client = null;
  }
}

const LOCAL_STORAGE_STORES_KEY = 'superpwa_stores_data';
const LOCAL_STORAGE_EMPLOYEES_KEY = 'superpwa_employees_data';
const LOCAL_STORAGE_ROLES_KEY = 'superpwa_roles_data';

// Obter lojas locais
export function getStoredStores(): Store[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_STORES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Erro ao ler lojas locais:', e);
  }
  return [];
}

// Obter funcionários locais
export function getStoredEmployees(): StoreEmployee[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EMPLOYEES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Erro ao ler funcionários locais:', e);
  }
  return [];
}

// Obter cargos da loja
export function getStoredRoles(): StoreRole[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ROLES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Altera a senha do usuário e marca primeiro_login como false.
 *
 * O usuário pode existir APENAS no Supabase (criado pelo Gerente em outro
 * dispositivo). Por isso, quando a matrícula não é encontrada no cache local,
 * consultamos a tabela `usuarios` antes de concluir que ela não existe.
 */
export async function changeUserPassword(
  matricula: string,
  newPassword: string
): Promise<{ success: boolean; message?: string }> {
  const cleanMatricula = matricula.trim();
  const cleanPassword = newPassword.trim();

  if (cleanPassword.length < 7) {
    return { success: false, message: 'A nova senha deve ter no mínimo 7 caracteres.' };
  }

  // Funcionários e Gerentes de Loja
  const emps = getStoredEmployees();
  const idx = emps.findIndex(e => e.matricula.toLowerCase() === cleanMatricula.toLowerCase());

  if (idx >= 0) {
    emps[idx].senha = cleanPassword;
    emps[idx].primeiro_login = false;
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_EMPLOYEES_KEY, JSON.stringify(emps));
    }

    // Sincroniza também no Supabase se cliente estiver ativo.
    // O PostgrestBuilder NUNCA rejeita: o erro vem dentro do valor resolvido.
    if (client) {
      const { error } = await client.rpc('rpc_alterar_senha', {
        p_matricula: cleanMatricula,
        p_nova_senha: cleanPassword,
      });
      if (error) {
        console.warn('Erro ao sincronizar senha no Supabase:', error.message);
      }
    }

    return { success: true, message: 'Senha alterada com sucesso!' };
  }

  // 3. FALLBACK: usuário existe apenas no Supabase (criado em outro dispositivo).
  // A RPC `rpc_alterar_senha` NÃO valida a existência do usuário, por isso
  // confirmamos a matrícula na tabela antes de alterar qualquer coisa.
  if (client && isSupabaseConfigured()) {
    try {
      const { data: remoteUser, error: findError } = await client
        .from('usuarios')
        .select('id, matricula, nome, cargo, setor, loja_id, ativo')
        .eq('matricula', cleanMatricula)
        .maybeSingle();

      if (!findError && remoteUser) {
        const { data: rpcData, error: rpcError } = await client.rpc('rpc_alterar_senha', {
          p_matricula: cleanMatricula,
          p_nova_senha: cleanPassword,
        });

        if (rpcError) {
          console.warn('Erro ao alterar senha no servidor:', rpcError.message);
          return {
            success: false,
            message: 'Não foi possível alterar a senha no servidor. Tente novamente com internet.',
          };
        }

        const rpcResult = rpcData as { success?: boolean; message?: string } | null;
        if (rpcResult && rpcResult.success === false) {
          return {
            success: false,
            message: rpcResult.message || 'Não foi possível alterar a senha no servidor.',
          };
        }

        // Atualiza o cache local para que os próximos acessos funcionem offline.
        const cached = emps.filter(
          e => e.matricula.toLowerCase() !== cleanMatricula.toLowerCase()
        );
        cached.unshift({
          id: String(remoteUser.id),
          matricula: String(remoteUser.matricula),
          nome: String(remoteUser.nome),
          senha: cleanPassword,
          cargo: String(remoteUser.cargo || 'Operador'),
          setor_restrito: remoteUser.setor ? String(remoteUser.setor) : 'TODOS',
          loja_id: String(remoteUser.loja_id || ''),
          ativo: Boolean(remoteUser.ativo ?? true),
          primeiro_login: false,
          created_at: new Date().toISOString(),
        });
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_EMPLOYEES_KEY, JSON.stringify(cached));
        }

        return { success: true, message: 'Senha alterada com sucesso!' };
      }
    } catch (err) {
      console.warn('Erro ao alterar senha no Supabase:', err);
    }
  }

  return { success: false, message: 'Usuário não encontrado para alteração de senha.' };
}

/**
 * Validação de Segurança Ativa: Verifica se o usuário ainda existe e está ativo no servidor
 */
export function verifyUserStillActive(matricula: string, lojaId?: string): { active: boolean; companyName?: string } {
  const cleanMatricula = matricula.trim();

  const emps = getStoredEmployees();
  const emp = emps.find(e => e.matricula.toLowerCase() === cleanMatricula.toLowerCase());

  // Se o usuário foi removido da base ou está inativo
  if (!emp || !emp.ativo) {
    const stores = getStoredStores();
    const store = stores.find(s => s.id === (lojaId || emp?.loja_id));
    return {
      active: false,
      companyName: store ? store.nome_loja : 'Sua Loja',
    };
  }

  return { active: true };
}

/**
 * Verificação remota direta no banco Supabase: desconecta instantaneamente se o usuário
 * for excluído da tabela 'usuarios' ou tiver 'ativo = false'.
 */
export async function verifyUserStillActiveRemote(
  matricula: string,
  lojaId?: string
): Promise<{ active: boolean; companyName?: string }> {
  const cleanMatricula = matricula.trim();

  // 1. Consulta remota no Supabase se cliente conectado
  if (client && isSupabaseConfigured()) {
    try {
      const { data, error } = await client
        .from('usuarios')
        .select('id, matricula, ativo, loja_id')
        .eq('matricula', cleanMatricula)
        .maybeSingle();

      if (!error) {
        if (!data) {
          // Usuário NÃO EXISTE mais no banco de dados (apagado)
          const stores = getStoredStores();
          const store = stores.find(s => s.id === lojaId);
          return {
            active: false,
            companyName: store ? store.nome_loja : 'Sua Loja',
          };
        }

        if (data.ativo === false) {
          // Usuário foi DESATIVADO no banco de dados
          const stores = getStoredStores();
          const store = stores.find(s => s.id === (data.loja_id || lojaId));
          return {
            active: false,
            companyName: store ? store.nome_loja : 'Sua Loja',
          };
        }

        return { active: true };
      }
    } catch (err) {
      console.debug('Aviso ao consultar usuário ativo no Supabase:', err);
    }
  }

  // 2. Fallback de verificação local
  return verifyUserStillActive(matricula, lojaId);
}

/**
 * Assina o canal Realtime da tabela 'usuarios' para desconectar o usuário
 * instantaneamente no milissegundo em que ele for deletado ou desativado.
 */
export function subscribeToUserStatusRealtime(
  matricula: string,
  onDeactivated: (companyName?: string) => void
): () => void {
  if (!client || !isSupabaseConfigured()) return () => {};

  try {
    const cleanMatricula = matricula.trim().toLowerCase();
    const channel = client
      .channel(`realtime_watchdog_user_${cleanMatricula}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'usuarios' },
        (payload) => {
          const oldRec = payload.old as Record<string, unknown> | null;
          const newRec = payload.new as Record<string, unknown> | null;
          const targetMatricula = String(newRec?.matricula || oldRec?.matricula || '').trim().toLowerCase();

          if (targetMatricula === cleanMatricula) {
            if (payload.eventType === 'DELETE' || (newRec && newRec.ativo === false)) {
              const stores = getStoredStores();
              const storeId = String(newRec?.loja_id || oldRec?.loja_id || '');
              const store = stores.find(s => s.id === storeId);
              onDeactivated(store ? store.nome_loja : 'Sua Loja');
            }
          }
        }
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Aviso ao registrar canal realtime de watchdog do usuário:', err);
    return () => {};
  }
}

/**
 * Autenticação Segura por Matrícula e Senha (Script 03 & SaaS Admin)
 */
export async function loginUser(matricula: string, senha: string): Promise<LoginResult> {
  const cleanMatricula = matricula.trim();
  const cleanSenha = senha.trim();

  // 1. Checagem em funcionários/gerentes cadastrados localmente (offline)
  const localEmployees = getStoredEmployees();
  const matchedEmp = localEmployees.find(
    e => e.matricula.toLowerCase() === cleanMatricula.toLowerCase() && !!e.senha && e.senha === cleanSenha
  );
  if (matchedEmp) {
    if (!matchedEmp.ativo) {
      return { success: false, message: 'Usuário inativo. Contate o gerente da sua loja.' };
    }
    const isGerente = matchedEmp.cargo.toLowerCase().includes('gerente') || matchedEmp.cargo.toLowerCase().includes('admin');
    const stores = getStoredStores();
    const matchedStore = stores.find(s => s.id === matchedEmp.loja_id);

    return {
      success: true,
      token: 'tok_emp_' + matchedEmp.id,
      user: {
        id: matchedEmp.id,
        matricula: matchedEmp.matricula,
        nome: matchedEmp.nome,
        cargo: isGerente ? 'gerente' : 'operador',
        setor: matchedEmp.setor_restrito === 'TODOS' ? 'Geral' : (matchedEmp.setor_restrito || 'Geral'),
        loja_id: matchedEmp.loja_id,
        loja_nome: matchedStore ? matchedStore.nome_loja : '',
        primeiro_login: matchedEmp.primeiro_login ?? true,
      },
    };
  }

  // 3. Se o Supabase estiver configurado, tenta autenticar via RPC no banco
  if (client) {
    try {
      const { data, error } = await client.rpc('rpc_login_usuario', {
        p_matricula: cleanMatricula,
        p_senha: cleanSenha,
      });

      if (!error && data && data.success && data.user) {
        const dbCargo = String(data.user.cargo || 'operador').toLowerCase();
        const mappedCargo = dbCargo.includes('saas') ? 'saas_admin' : dbCargo.includes('gerente') ? 'gerente' : 'operador';

        return {
          success: true,
          token: data.token,
          user: {
            id: data.user.id,
            matricula: data.user.matricula,
            nome: data.user.nome,
            cargo: mappedCargo,
            setor: data.user.setor,
            loja_id: data.user.loja_id || '',
            loja_nome: data.user.loja_nome || '',
            primeiro_login: data.user.primeiro_login ?? true,
          },
        };
      }

      // Consulta direta na tabela 'usuarios'
      const { data: userData, error: userError } = await client
        .from('usuarios')
        .select('*')
        .eq('matricula', cleanMatricula)
        .eq('ativo', true)
        .single();

      if (!userError && userData) {
        if (userData.senha === cleanSenha) {
          const dbCargo = String(userData.cargo || 'operador').toLowerCase();
          const mappedCargo = dbCargo.includes('saas') ? 'saas_admin' : dbCargo.includes('gerente') ? 'gerente' : 'operador';

          return {
            success: true,
            token: 'tok_' + Math.random().toString(36).substring(2),
            user: {
              id: userData.id,
              matricula: userData.matricula,
              nome: userData.nome,
              cargo: mappedCargo,
              setor: userData.setor || 'Geral',
              loja_id: userData.loja_id || '',
              loja_nome: '',
            },
          };
        } else {
          return {
            success: false,
            message: 'Senha incorreta para a matrícula informada.',
          };
        }
      }
    } catch (err) {
      console.warn('Erro ao autenticar com Supabase, recorrendo à contingência local:', err);
    }
  }

  return {
    success: false,
    message: 'Matrícula ou senha incorreta. Verifique os dados digitados.',
  };
}

/**
 * Operações do Administrador de SaaS: Gestão de Lojas & Limites
 */
export async function fetchStoresFromDatabase(): Promise<Store[]> {
  const localStores = getStoredStores();
  if (!client) return localStores;

  try {
    const { data, error } = await client
      .from('lojas')
      .select('*')
      .order('nome_loja', { ascending: true });

    if (!error && data && data.length > 0) {
      const mapped: Store[] = data.map((d: Record<string, unknown>) => ({
        id: String(d.id),
        nome_loja: String(d.nome_loja || 'Loja'),
        cnpj: d.cnpj ? String(d.cnpj) : undefined,
        endereco: d.endereco ? String(d.endereco) : undefined,
        telefone: d.telefone ? String(d.telefone) : undefined,
        limite_usuarios: Number(d.limite_usuarios || 15),
        ativa: Boolean(d.ativa ?? true),
        cor_primaria: String(d.cor_borda || d.cor_primaria || '#059669'),
        created_at: String(d.created_at || new Date().toISOString()),
      }));
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_STORES_KEY, JSON.stringify(mapped));
      }
      return mapped;
    }
  } catch (err) {
    console.debug('Aviso ao consultar lojas no banco:', err);
  }

  return localStores;
}

export async function createStoreInDatabase(store: Store): Promise<{ success: boolean; error?: string }> {
  const localStores = getStoredStores();
  const updated = [store, ...localStores.filter(s => s.id !== store.id)];
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_STORES_KEY, JSON.stringify(updated));
  }

  if (client) {
    try {
      const { error } = await client.from('lojas').upsert({
        id: store.id,
        nome_loja: store.nome_loja,
        cnpj: store.cnpj || null,
        endereco: store.endereco || null,
        telefone: store.telefone || null,
        limite_usuarios: store.limite_usuarios,
        ativa: store.ativa,
        cor_borda: store.cor_primaria || '#059669',
      });
      if (error) {
        console.warn('Aviso upsert loja:', error.message);
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      console.warn('Erro ao salvar loja no banco:', err);
      return { success: false, error: err?.message || 'Erro ao salvar loja no banco.' };
    }
  }

  return { success: true };
}

/**
 * Atualiza o limite de usuários de uma loja diretamente no banco e localmente
 */
export async function updateStoreUserLimitInDatabase(
  storeId: string, 
  newLimit: number
): Promise<{ success: boolean; error?: string }> {
  const localStores = getStoredStores();
  const index = localStores.findIndex(s => s.id === storeId);
  if (index !== -1) {
    localStores[index].limite_usuarios = newLimit;
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_STORES_KEY, JSON.stringify(localStores));
    }
  }

  if (client) {
    try {
      const { error } = await client
        .from('lojas')
        .update({ limite_usuarios: newLimit })
        .eq('id', storeId);

      if (error) {
        console.error('Erro ao atualizar limite de usuários na loja:', error.message);
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      console.error('Erro de conexão ao atualizar limite:', err);
      return { success: false, error: err?.message || 'Falha de conexão com o banco.' };
    }
  }

  return { success: true };
}

export interface SaasTelemetryData {
  server: {
    total_stores: number;
    active_stores: number;
    total_users: number;
    total_products: number;
    active_sessions: number;
    total_logs: number;
  };
  stores: Record<string, {
    users_count: number;
    products_count: number;
    logs_count: number;
    sessions_count: number;
  }>;
}

/**
 * Consulta telemetria agregada de uso geral do servidor e consumo individual por loja
 */
export async function fetchSaasTelemetry(): Promise<SaasTelemetryData> {
  const defaultTelemetry: SaasTelemetryData = {
    server: {
      total_stores: 0,
      active_stores: 0,
      total_users: 0,
      total_products: 0,
      active_sessions: 0,
      total_logs: 0,
    },
    stores: {},
  };

  if (!client) {
    const localStores = getStoredStores();
    const localEmps = getStoredEmployees();
    defaultTelemetry.server.total_stores = localStores.length;
    defaultTelemetry.server.active_stores = localStores.filter(s => s.ativa).length;
    defaultTelemetry.server.total_users = localEmps.length;
    localStores.forEach(s => {
      const emps = localEmps.filter(e => e.loja_id === s.id);
      defaultTelemetry.stores[s.id] = {
        users_count: emps.length,
        products_count: 0,
        logs_count: 0,
        sessions_count: 0,
      };
    });
    return defaultTelemetry;
  }

  try {
    const { data, error } = await client.rpc('rpc_get_saas_telemetry');
    if (!error && data) {
      return data as SaasTelemetryData;
    }
  } catch (err) {
    console.debug('Aviso rpc_get_saas_telemetry fallback:', err);
  }

  // Fallback via queries diretas no Supabase
  try {
    const [storesRes, usersRes, prodsRes, sessRes, logsRes] = await Promise.allSettled([
      client.from('lojas').select('id, ativa, limite_usuarios'),
      client.from('usuarios').select('id, loja_id').neq('cargo', 'saas_admin'),
      client.from('produtos').select('id, loja_id'),
      client.from('sessoes_ativas').select('matricula, loja_id').eq('status', 'ATIVA'),
      client.from('app_logs').select('id, loja_id'),
    ]);

    const stores = storesRes.status === 'fulfilled' && storesRes.value.data ? storesRes.value.data : [];
    const users = usersRes.status === 'fulfilled' && usersRes.value.data ? usersRes.value.data : [];
    const products = prodsRes.status === 'fulfilled' && prodsRes.value.data ? prodsRes.value.data : [];
    const sessions = sessRes.status === 'fulfilled' && sessRes.value.data ? sessRes.value.data : [];
    const logs = logsRes.status === 'fulfilled' && logsRes.value.data ? logsRes.value.data : [];

    const storeMetrics: Record<string, { users_count: number; products_count: number; logs_count: number; sessions_count: number }> = {};
    stores.forEach((s: any) => {
      storeMetrics[s.id] = {
        users_count: users.filter((u: any) => u.loja_id === s.id).length,
        products_count: products.filter((p: any) => p.loja_id === s.id).length,
        logs_count: logs.filter((l: any) => l.loja_id === s.id).length,
        sessions_count: sessions.filter((sess: any) => sess.loja_id === s.id).length,
      };
    });

    return {
      server: {
        total_stores: stores.length,
        active_stores: stores.filter((s: any) => s.ativa).length,
        total_users: users.length,
        total_products: products.length,
        active_sessions: sessions.length,
        total_logs: logs.length,
      },
      stores: storeMetrics,
    };
  } catch (e) {
    console.warn('Erro ao consolidar telemetria:', e);
    return defaultTelemetry;
  }
}

export interface ActiveSession {
  matricula: string;
  usuario_nome?: string;
  loja_id: string;
  timestamp?: number;
  last_seen?: number;
  status: string;
  updated_at?: string;
}

/**
 * Consulta sessões ativas da tabela 'sessoes_ativas' no Supabase
 */
export async function fetchStoreActiveSessions(lojaId?: string): Promise<ActiveSession[]> {
  if (!client) return [];

  try {
    let query = client
      .from('sessoes_ativas')
      .select('matricula, usuario_nome, loja_id, timestamp, last_seen, status, updated_at')
      .eq('status', 'ATIVA')
      .order('last_seen', { ascending: false });

    if (lojaId && lojaId !== 'todas') {
      query = query.eq('loja_id', lojaId);
    }

    const { data, error } = await query;
    if (!error && data) {
      return data as ActiveSession[];
    }
  } catch (err) {
    console.debug('Aviso ao consultar sessões ativas no Supabase:', err);
  }

  return [];
}

/**
 * Operações do Gerente de Loja: Gestão de Funcionários & Permissões de Setor
 */
export async function fetchStoreEmployees(lojaId?: string): Promise<StoreEmployee[]> {
  const allEmps = getStoredEmployees();
  const filtered = allEmps.filter(e => !lojaId || e.loja_id === lojaId || lojaId === 'todas');

  if (!client) return filtered;

  try {
    let query = client
      .from('usuarios')
      .select('*')
      .neq('cargo', 'saas_admin')
      .order('nome', { ascending: true });

    if (lojaId && lojaId !== 'todas') {
      query = query.eq('loja_id', lojaId);
    }

    const { data, error } = await query;

    if (!error && data) {
      const mapped: StoreEmployee[] = data.map((u: Record<string, unknown>) => ({
        id: String(u.id),
        matricula: String(u.matricula),
        nome: String(u.nome),
        senha: u.senha ? String(u.senha) : '',
        cargo: String(u.cargo || 'Operador'),
        setor_restrito: u.setor ? String(u.setor) : 'TODOS',
        loja_id: String(u.loja_id || lojaId || ''),
        ativo: Boolean(u.ativo ?? true),
        created_at: String(u.created_at || new Date().toISOString()),
      }));
      return mapped;
    }
  } catch (err) {
    console.debug('Aviso ao consultar funcionários da loja:', err);
  }

  return filtered;
}

export async function saveStoreEmployee(emp: StoreEmployee): Promise<{ success: boolean; error?: string }> {
  const allEmps = getStoredEmployees();
  const updated = [emp, ...allEmps.filter(e => e.id !== emp.id && e.matricula !== emp.matricula)];
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_EMPLOYEES_KEY, JSON.stringify(updated));
  }

  if (client) {
    try {
      await client.from('usuarios').upsert({
        id: emp.id,
        matricula: emp.matricula,
        nome: emp.nome,
        senha: emp.senha || '',
        cargo: emp.cargo,
        setor: emp.setor_restrito,
        loja_id: emp.loja_id,
        ativo: emp.ativo,
      });
    } catch (err) {
      console.warn('Erro ao salvar funcionário no banco:', err);
    }
  }

  return { success: true };
}

export async function toggleStoreEmployeeActive(empId: string, active: boolean): Promise<boolean> {
  const allEmps = getStoredEmployees();
  const updated = allEmps.map(e => e.id === empId ? { ...e, ativo: active } : e);
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_EMPLOYEES_KEY, JSON.stringify(updated));
  }

  if (client) {
    try {
      await client.from('usuarios').update({ ativo: active }).eq('id', empId);
    } catch (err) {
      console.warn('Erro ao alterar status de funcionário:', err);
    }
  }

  return true;
}

export async function saveStoreRole(role: StoreRole): Promise<boolean> {
  const allRoles = getStoredRoles();
  const updated = [role, ...allRoles.filter(r => r.id !== role.id)];
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_ROLES_KEY, JSON.stringify(updated));
  }
  return true;
}

/**
 * Valida a conexão com o banco de dados oficial Synk (tabela lojas ou produtos)
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!client || !activeConfig.isConfigured) {
    return {
      success: false,
      message: 'Supabase operando em modo local/offline. Configure a URL e a Anon Key nas configurações para conectar seu banco de dados na nuvem.',
    };
  }

  try {
    // 1. Tenta buscar lojas
    const { data: lojasData, error: lojasError } = await client
      .from('lojas')
      .select('id, nome_loja')
      .limit(1);

    if (lojasError) {
      // Se a tabela lojas não existir ou der RLS error, tenta produtos
      const { error: prodError } = await client.from('produtos').select('id').limit(1);
      if (prodError) {
        throw new Error(`Falha ao acessar tabelas: ${lojasError.message || prodError.message}`);
      }
    }

    const storeName = lojasData && lojasData[0] ? lojasData[0].nome_loja : 'Synk 2026.1';
    return {
      success: true,
      message: `Conexão bem-sucedida com o Supabase! Banco pronto para gravação (${storeName}).`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Erro na conexão com as tabelas do Supabase: ${msg}`,
    };
  }
}

/**
 * Garante que a loja padrão exista na tabela 'lojas' para não quebrar a chave estrangeira
 */
async function ensureStoreExists(lojaId: string): Promise<void> {
  if (!client || !lojaId) return;
  try {
    const { data, error } = await client
      .from('lojas')
      .select('id')
      .eq('id', lojaId)
      .maybeSingle();

    if (!data && !error) {
      await client.from('lojas').insert({
        id: lojaId,
        nome_loja: `Loja ${lojaId}`,
        cor_borda: '#e11d48',
        ativa: true,
        limite_usuarios: 15,
      });
    }
  } catch (err) {
    console.debug('Aviso verificação de loja:', err);
  }
}

/**
 * Upload em Realtime dos Produtos Criptografados ajustado à estrutura oficial Synk 2026.1:
 * - Alimenta tabela 'produtos' (isolada por loja_id com setor especificado)
 * - Alimenta tabela 'produtos_catalogo_universal' (compartilhada universalmente)
 * - Registra log em 'app_logs' para auditoria e rastreabilidade
 */
export async function uploadEncryptedProductsRealtime(
  items: Array<{
    original: SpreadsheetProductItem;
    encrypted: { ciphertext: string; iv: string };
  }>,
  onRealtimeProgress?: (uploadedCount: number, total: number, percent: number) => void,
  options?: {
    lojaId?: string;
    operatorMatricula?: string;
    operatorNome?: string;
  }
): Promise<{ success: boolean; totalUploaded: number; isLocalOnly?: boolean; error?: string }> {
  const total = items.length;
  const lojaId = options?.lojaId || '';
  const matricula = options?.operatorMatricula || 'SISTEMA';
  const nomeOperador = options?.operatorNome || 'Operador';

  // Se o Supabase não estiver configurado, NÃO finge que gravou no banco!
  if (!client || !activeConfig.isConfigured) {
    console.warn('[uploadEncryptedProductsRealtime] Supabase não conectado. Modo local ativo.');
    // Simula o progresso visual para não congelar a UI
    for (let i = 0; i < total; i++) {
      if (onRealtimeProgress && (i % 2 === 0 || i === total - 1)) {
        const cur = i + 1;
        onRealtimeProgress(cur, total, Math.round((cur / total) * 100));
        await new Promise(r => setTimeout(r, 10));
      }
    }
    return {
      success: false,
      totalUploaded: 0,
      isLocalOnly: true,
      error: 'O banco de dados Supabase não está configurado com URL e Anon Key. Os produtos foram importados apenas na memória local do app.',
    };
  }

  try {
    // 0. Garante que a loja exista no banco para satisfazer a FK
    await ensureStoreExists(lojaId);

    const batchSize = 10;
    let uploaded = 0;
    const defaultDueDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (let i = 0; i < total; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);

      // 1. Mapeamento para as colunas da tabela 'produtos':
      const payloadProdutos = chunk.map(c => ({
        loja_id: lojaId,
        codigo_barras: c.original.ean.trim(),
        nome: c.original.name.trim(),
        plu: c.original.reducedCode ? c.original.reducedCode.trim() : null,
        codigo_fornecedor: c.original.supplierCode ? c.original.supplierCode.trim() : null,
        setor: c.original.setor || 'MERCEARIA',
        quantidade: Math.max(0, c.original.quantity),
        data_vencimento: defaultDueDate,
        is_encrypted: true,
        ciphertext: c.encrypted.ciphertext,
        iv: c.encrypted.iv,
        criado_em: Date.now(),
      }));

      // Tenta upsert direto (quando há constraint única uq_produtos_loja_ean)
      let upsertSucceeded = false;
      const { error: errUpsert } = await client
        .from('produtos')
        .upsert(payloadProdutos, { onConflict: 'loja_id, codigo_barras' });

      if (!errUpsert) {
        upsertSucceeded = true;
      } else {
        console.warn('Upsert direto retornou aviso, executando verificação de registros existentes:', errUpsert.message);
      }

      // Fallback infalível se o banco não tiver a constraint de conflito:
      if (!upsertSucceeded) {
        const eansInChunk = payloadProdutos.map(p => p.codigo_barras);
        const { data: existingRows } = await client
          .from('produtos')
          .select('id, codigo_barras')
          .eq('loja_id', lojaId)
          .in('codigo_barras', eansInChunk);

        const existingMap = new Map((existingRows || []).map(r => [r.codigo_barras, r.id]));

        for (const item of payloadProdutos) {
          const existingId = existingMap.get(item.codigo_barras);
          if (existingId) {
            const { error: updateErr } = await client
              .from('produtos')
              .update(item)
              .eq('id', existingId);
            if (updateErr) throw updateErr;
          } else {
            const { error: insertErr } = await client
              .from('produtos')
              .insert(item);
            if (insertErr) throw insertErr;
          }
        }
      }

      // 2. Mapeamento para 'produtos_catalogo_universal' (Script 08)
      const payloadCatalogoUniversal = chunk.map(c => ({
        codigo_barras: c.original.ean.trim(),
        nome: c.original.name.trim(),
      }));

      try {
        await client
          .from('produtos_catalogo_universal')
          .upsert(payloadCatalogoUniversal, { onConflict: 'codigo_barras' });
      } catch (catErr) {
        console.debug('Aviso catálogo universal:', catErr);
      }

      uploaded += chunk.length;
      if (onRealtimeProgress) {
        const pct = Math.round((uploaded / total) * 100);
        onRealtimeProgress(uploaded, total, pct);
      }
    }

    // 3. Registrar auditoria em 'app_logs' (Script 06)
    try {
      await client.from('app_logs').insert({
        usuario_matricula: matricula,
        usuario_nome: nomeOperador,
        loja_id: lojaId,
        acao: 'IMPORTACAO_PLANILHA_ESTOQUE',
        detalhes: `Importação de ${total} produtos com 5 colunas estritas gravados no banco com sucesso.`,
        timestamp: Date.now(),
      });
    } catch (logErr) {
      console.debug('Log de auditoria local:', logErr);
    }

    return { success: true, totalUploaded: uploaded };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Falha real no upload para o Supabase:', msg);
    return { success: false, totalUploaded: 0, error: msg };
  }
}

/**
 * Consulta de produtos no banco Synk com conversão para o modelo do aplicativo
 * e suporte completo a múltiplas sessões (Session A -> Session B).
 * Se os dados estiverem criptografados no banco (Zero-Knowledge AES),
 * descriptografa temporariamente em RAM para exibição correta em todas as sessões.
 */
export async function fetchProductsFromSupabase(lojaId?: string): Promise<Product[]> {
  if (!client) return [];

  try {
    let data: Record<string, unknown>[] | null = null;

    // 1. Tenta buscar pela loja específica se informada
    if (lojaId) {
      const res = await client
        .from('produtos')
        .select('*')
        .eq('loja_id', lojaId)
        .order('criado_em', { ascending: false });
      if (res.data && res.data.length > 0) {
        data = res.data;
      }
    }

    // 2. Fallback: se não passou loja ou não retornou nada, busca todos os produtos disponíveis
    if (!data || data.length === 0) {
      const globalRes = await client
        .from('produtos')
        .select('*')
        .order('criado_em', { ascending: false });

      if (globalRes.data && globalRes.data.length > 0) {
        data = globalRes.data;
      }
    }

    // 3. Fallback adicional em 'produtos_catalogo_universal' se a tabela 'produtos' estiver vazia
    if (!data || data.length === 0) {
      const catRes = await client
        .from('produtos_catalogo_universal')
        .select('*')
        .limit(100);

      if (catRes.data && catRes.data.length > 0) {
        return catRes.data.map((row: Record<string, unknown>, idx: number) => {
          const rawNome = String(row.nome || '');
          const rawEan = String(row.codigo_barras || '');
          return {
            id: `cat-${idx}-${rawEan}`,
            ean: decryptSingleField(rawEan),
            name: decryptSingleField(rawNome) || 'Produto Universal',
            category: 'MERCEARIA',
            stock: 0,
            minStock: 10,
            price: 0,
            location: 'Gôndola - Catálogo',
            loja_id: lojaId || '',
            isEncryptedInStorage: isEncrypted(rawNome),
          };
        });
      }
      return [];
    }

    // 4. Mapeamento com descriptografia pontual na RAM para dados AES-256
    return data.map((row: Record<string, unknown>) => {
      const rawNome = String(row.nome || '');
      const rawEan = String(row.codigo_barras || '');
      const rawPlu = String(row.plu || '');
      const rawForn = String(row.codigo_fornecedor || '');

      const isEnc = Boolean(row.is_encrypted || isEncrypted(rawNome) || isEncrypted(rawEan));

      return {
        id: String(row.id || `prod-${Math.random().toString(36).substring(2, 9)}`),
        ean: decryptSingleField(rawEan),
        secondaryEan: row.codigo_barras_secundario ? decryptSingleField(String(row.codigo_barras_secundario)) : undefined,
        name: decryptSingleField(rawNome) || 'Produto Cadastrado',
        supplierCode: decryptSingleField(rawForn),
        reducedCode: decryptSingleField(rawPlu),
        category: String(row.setor || 'MERCEARIA'),
        stock: Math.max(0, Number(row.quantidade ?? 0)),
        minStock: 10,
        price: 0,
        location: `Gôndola - ${row.setor || 'Estoque'}`,
        loja_id: String(row.loja_id || lojaId || ''),
        data_vencimento: String(row.data_vencimento || ''),
        isLockedForEdit: Boolean(row.is_locked_for_edit),
        lockedBy: row.locked_by ? String(row.locked_by) : undefined,
        lockedAt: row.locked_at ? String(row.locked_at) : undefined,
        isEncryptedInStorage: isEnc,
        encryptedPayload: row.ciphertext
          ? {
              ciphertext: String(row.ciphertext),
              iv: String(row.iv || ''),
            }
          : undefined,
        lastUpdated: new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn('Erro ao consultar produtos no Supabase:', err);
    return [];
  }
}

/**
 * Inscreve no canal Realtime do Supabase para atualizar todas as sessões conectadas
 * assim que um produto for criado, alterado ou excluído.
 */
export function subscribeToProductsRealtime(onChanged: () => void): () => void {
  if (!client) return () => {};

  try {
    const channel = client
      .channel('realtime_produtos_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'produtos' },
        () => {
          onChanged();
        }
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Aviso ao registrar canal realtime de produtos:', err);
    return () => {};
  }
}

/**
 * Sincroniza a fila de ações offline com o Supabase quando restabelecida a internet
 */
export async function syncOfflineQueueToSupabase(
  actions: OfflineAction[],
  lojaId = ''
): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  if (!client || actions.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  let synced = 0;
  try {
    for (const action of actions) {
      if (action.type === 'UPDATE_STOCK') {
        const payload = action.payload as { id: string; exact?: number; delta?: number };
        if (typeof payload.exact === 'number') {
          await client.from('produtos').update({ quantidade: payload.exact, updated_at: new Date().toISOString() }).eq('id', payload.id);
        }
        synced++;
      } else if (action.type === 'ADD_PRODUCT') {
        const p = action.payload as Product;
        await client.from('produtos').upsert({
          loja_id: p.loja_id || lojaId,
          codigo_barras: p.ean,
          nome: p.name,
          setor: p.category || 'MERCEARIA',
          quantidade: p.stock,
          is_encrypted: Boolean(p.isEncryptedInStorage),
          ciphertext: p.encryptedPayload?.ciphertext || null,
          iv: p.encryptedPayload?.iv || null,
        }, { onConflict: 'loja_id, codigo_barras' });
        synced++;
      }
    }
    return { success: true, syncedCount: synced };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, syncedCount: synced, error: msg };
  }
}

// ============================================================================
// GESTÃO EM TEMPO REAL DAS 4 TABELAS DE AUDITORIA (MULTI-USUÁRIOS / REALTIME)
// 1. auditoria_presenca_sessoes (sessões ativas no setor)
// 2. auditoria_presenca_bips (produtos bipados ao vivo por cada membro)
// 3. produtos (produtos do setor a serem conferidos)
// 4. auditorias_finalizadas & auditoria_produtos (histórico permanente e relatórios)
// ============================================================================

export interface DbActiveAuditSession {
  id: string;
  loja_id: string;
  setor: string;
  iniciada_por_nome: string;
  iniciada_por_matricula: string;
  status: 'ATIVA' | 'PAUSADA' | 'CONCLUIDA';
  timestamp: number;
  created_at?: string;
}

export interface DbAuditBip {
  id: string;
  sessao_id: string;
  loja_id: string;
  produto_id: string;
  codigo_barras: string;
  produto_nome: string;
  setor: string;
  operador_matricula: string;
  operador_nome: string;
  timestamp: number;
}

const LOCAL_ACTIVE_SESSIONS_KEY = 'superpwa_active_audit_sessions';
const LOCAL_AUDIT_BIPS_KEY = 'superpwa_audit_bips_';

/**
 * Consulta sessões ativas de auditoria (para notificar todos do setor)
 */
export async function fetchActiveAuditSessions(lojaId: string): Promise<DbActiveAuditSession[]> {
  if (client && isSupabaseConfigured()) {
    try {
      const { data, error } = await client
        .from('auditoria_presenca_sessoes')
        .select('*')
        .eq('loja_id', lojaId)
        .eq('status', 'ATIVA')
        .order('timestamp', { ascending: false });

      if (!error && data) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_ACTIVE_SESSIONS_KEY, JSON.stringify(data));
        }
        return data as DbActiveAuditSession[];
      }
    } catch (err) {
      console.debug('Aviso ao consultar sessões ativas no banco:', err);
    }
  }

  // Fallback local
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_ACTIVE_SESSIONS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  return [];
}

/**
 * Inicia uma nova sessão de auditoria no setor e transmite para todos os operadores
 */
export async function startAuditSessionInDatabase(data: {
  lojaId: string;
  setor: string;
  matricula: string;
  nome: string;
}): Promise<{ success: boolean; session?: DbActiveAuditSession; error?: string }> {
  const newSession: DbActiveAuditSession = {
    id: `sessao_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    loja_id: data.lojaId,
    setor: data.setor,
    iniciada_por_nome: data.nome,
    iniciada_por_matricula: data.matricula,
    status: 'ATIVA',
    timestamp: Date.now(),
    created_at: new Date().toISOString(),
  };

  // Salva no Supabase se conectado
  if (client && isSupabaseConfigured()) {
    try {
      await ensureStoreExists(data.lojaId);
      const { error } = await client.from('auditoria_presenca_sessoes').insert({
        id: newSession.id,
        loja_id: newSession.loja_id,
        setor: newSession.setor,
        iniciada_por_nome: newSession.iniciada_por_nome,
        iniciada_por_matricula: newSession.iniciada_por_matricula,
        status: newSession.status,
        timestamp: newSession.timestamp,
      });

      if (error) {
        console.warn('Aviso insert sessao auditoria:', error.message);
      }
    } catch (err) {
      console.warn('Erro ao salvar sessão de auditoria no Supabase:', err);
    }
  }

  // Atualiza cache local
  if (typeof window !== 'undefined') {
    const active = await fetchActiveAuditSessions(data.lojaId);
    const updated = [newSession, ...active.filter(s => s.id !== newSession.id)];
    localStorage.setItem(LOCAL_ACTIVE_SESSIONS_KEY, JSON.stringify(updated));
  }

  return { success: true, session: newSession };
}

/**
 * Consulta todos os bips em tempo real de uma sessão ativa
 */
export async function fetchSessionBipsFromDatabase(sessaoId: string): Promise<DbAuditBip[]> {
  if (client && isSupabaseConfigured()) {
    try {
      const { data, error } = await client
        .from('auditoria_presenca_bips')
        .select('*')
        .eq('sessao_id', sessaoId)
        .order('timestamp', { ascending: false });

      if (!error && data) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_AUDIT_BIPS_KEY + sessaoId, JSON.stringify(data));
        }
        return data as DbAuditBip[];
      }
    } catch (err) {
      console.debug('Aviso ao consultar bips no banco:', err);
    }
  }

  // Fallback local
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_AUDIT_BIPS_KEY + sessaoId);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  return [];
}

/**
 * Grava um bip no banco Supabase em tempo real (notificando os demais operadores do setor)
 */
export async function insertAuditBipInDatabase(bip: DbAuditBip): Promise<{ success: boolean; error?: string }> {
  // Salva no banco de dados Supabase
  if (client && isSupabaseConfigured()) {
    try {
      await ensureStoreExists(bip.loja_id);
      const { error } = await client.from('auditoria_presenca_bips').upsert({
        id: bip.id,
        sessao_id: bip.sessao_id,
        loja_id: bip.loja_id,
        produto_id: bip.produto_id,
        codigo_barras: bip.codigo_barras,
        produto_nome: bip.produto_nome,
        setor: bip.setor,
        operador_matricula: bip.operador_matricula,
        operador_nome: bip.operador_nome,
        timestamp: bip.timestamp,
      });

      if (error) {
        console.warn('Aviso upsert bip auditoria:', error.message);
      }
    } catch (err) {
      console.warn('Erro ao inserir bip de auditoria no Supabase:', err);
    }
  }

  // Atualiza cache local
  if (typeof window !== 'undefined') {
    try {
      const key = LOCAL_AUDIT_BIPS_KEY + bip.sessao_id;
      const raw = localStorage.getItem(key);
      const currentBips: DbAuditBip[] = raw ? JSON.parse(raw) : [];
      const updated = [bip, ...currentBips.filter(b => b.id !== bip.id)];
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  return { success: true };
}

/**
 * Finaliza a sessão no Supabase e arquiva os dados em 'auditorias_finalizadas' e 'auditoria_produtos'
 */
export async function finalizeAuditSessionInDatabase(data: {
  sessaoId: string;
  lojaId: string;
  setor: string;
  iniciadaPorNome: string;
  iniciadaPorMatricula: string;
  finalizadaPorNome: string;
  finalizadaPorMatricula: string;
  totalEsperado: number;
  totalAuditado: number;
  totalDivergentes: number;
  iniciadaEm: number;
  finalizadaEm: number;
  confirmedItems: Array<{ name: string; ean: string; reducedCode?: string; supplierCode?: string; scannedAt: string; scannedBy?: string }>;
  pendingItems: Array<{ name: string; ean: string; reducedCode?: string; supplierCode?: string; stock?: number; minStock?: number }>;
  ruptureItems: Array<{ name: string; ean: string; stock: number; minStock: number }>;
}): Promise<{ success: boolean; error?: string }> {
  if (client && isSupabaseConfigured()) {
    try {
      // 1. Marca status como 'CONCLUIDA' na tabela auditoria_presenca_sessoes
      await client
        .from('auditoria_presenca_sessoes')
        .update({ status: 'CONCLUIDA' })
        .eq('id', data.sessaoId);

      // 2. Grava na tabela auditorias_finalizadas
      await client.from('auditorias_finalizadas').upsert({
        id: data.sessaoId,
        loja_id: data.lojaId,
        setor: data.setor,
        tipo: 'PRESENCA',
        iniciada_por_nome: data.iniciadaPorNome,
        iniciada_por_matricula: data.iniciadaPorMatricula,
        finalizada_por_nome: data.finalizadaPorNome,
        finalizada_por_matricula: data.finalizadaPorMatricula,
        total_esperado: data.totalEsperado,
        total_auditado: data.totalAuditado,
        total_divergentes: data.totalDivergentes,
        iniciada_em: data.iniciadaEm,
        finalizada_em: data.finalizadaEm,
        status: 'CONCLUIDA',
      });

      // 3. Grava itens individuais em auditoria_produtos
      const produtosPayload = [
        ...data.confirmedItems.map(c => ({
          id: `${data.sessaoId}_${c.ean}`,
          sessao_id: data.sessaoId,
          produto_id: c.ean,
          codigo_barras: c.ean,
          plu: c.reducedCode || null,
          nome: c.name,
          setor: data.setor,
          quantidade_sistema: 0,
          status_presenca: 'CONFIRMADO',
          operador_nome: c.scannedBy || data.finalizadaPorNome,
          operador_matricula: data.finalizadaPorMatricula,
          auditado_em: Date.now(),
        })),
        ...data.pendingItems.map(p => ({
          id: `${data.sessaoId}_${p.ean}`,
          sessao_id: data.sessaoId,
          produto_id: p.ean,
          codigo_barras: p.ean,
          plu: p.reducedCode || null,
          nome: p.name,
          setor: data.setor,
          quantidade_sistema: p.stock ?? 0,
          status_presenca: 'AUSENTE',
          operador_nome: null,
          operador_matricula: null,
          auditado_em: Date.now(),
        })),
      ];

      if (produtosPayload.length > 0) {
        await client.from('auditoria_produtos').upsert(produtosPayload);
      }
    } catch (err) {
      console.warn('Erro ao finalizar auditoria no Supabase:', err);
    }
  }

  // Limpa cache local de sessão ativa
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_ACTIVE_SESSIONS_KEY);
    if (raw) {
      const active: DbActiveAuditSession[] = JSON.parse(raw);
      localStorage.setItem(LOCAL_ACTIVE_SESSIONS_KEY, JSON.stringify(active.filter(s => s.id !== data.sessaoId)));
    }
  }

  return { success: true };
}

/**
 * Assina as alterações em tempo real de auditoria (sessões e bips) para sincronizar
/**
 * Assina as alterações em tempo real de auditoria (sessões e bips) e presença de operadores
 * para sincronizar instantaneamente todos os participantes do setor e alertar desconexões.
 */
export function subscribeToAuditRealtime(
  lojaId: string,
  onEvent: () => void,
  onNewBip?: (bip: DbAuditBip) => void,
  operatorPresence?: { matricula: string; nome: string },
  onUserOffline?: (userName: string) => void
): () => void {
  if (!client || !isSupabaseConfigured()) return () => {};

  try {
    const channelName = `realtime_auditoria_${lojaId}`;
    const channel = client.channel(channelName, {
      config: operatorPresence ? { presence: { key: operatorPresence.matricula } } : {},
    });

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auditoria_presenca_sessoes' },
        () => {
          onEvent();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auditoria_presenca_bips' },
        (payload) => {
          if (payload.new && onNewBip) {
            onNewBip(payload.new as DbAuditBip);
          }
          onEvent();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'auditoria_presenca_bips' },
        () => {
          onEvent();
        }
      );

    if (operatorPresence && onUserOffline) {
      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (Array.isArray(leftPresences)) {
          leftPresences.forEach((p: Record<string, unknown>) => {
            const userName = String(p.nome || p.user || p.matricula || '');
            const userMatricula = String(p.matricula || '');
            if (userName && userMatricula !== operatorPresence.matricula) {
              onUserOffline(userName);
            }
          });
        }
      });
    }

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && operatorPresence) {
        try {
          await channel.track({
            matricula: operatorPresence.matricula,
            nome: operatorPresence.nome,
            online_at: Date.now(),
          });
        } catch (e) {
          console.warn('[Presence] Erro ao registrar presença:', e);
        }
      }
    });

    return () => {
      client?.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Aviso ao registrar canal realtime de auditoria:', err);
    return () => {};
  }
}

// ============================================================================
// 12. SISTEMA DE CHAT OPERACIONAL (GRUPO DA LOJA E CANAL DIRETO COM LÍDERES)
// ============================================================================

export const LOCAL_STORAGE_CHAT_KEY = 'superpwa_chat_messages_v1';

export function getStoredChatMessages(lojaId?: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CHAT_KEY);
    if (!raw) return [];
    const list: ChatMessage[] = JSON.parse(raw);
    if (lojaId) {
      return list.filter(m => m.loja_id === lojaId);
    }
    return list;
  } catch (e) {
    console.warn('[Chat] Erro ao ler mensagens locais:', e);
    return [];
  }
}

export function saveStoredChatMessage(message: ChatMessage): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getStoredChatMessages();
    const exists = current.some(m => m.id === message.id);
    if (!exists) {
      const updated = [...current, message];
      localStorage.setItem(LOCAL_STORAGE_CHAT_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('[Chat] Erro ao salvar mensagem local:', e);
  }
}

/**
 * Consulta mensagens de chat da loja com suporte a modo offline e fallback
 */
export async function fetchChatMessagesFromSupabase(lojaId: string): Promise<ChatMessage[]> {
  const localList = getStoredChatMessages(lojaId);

  if (!client || !isSupabaseConfigured()) {
    return localList;
  }

  try {
    const { data, error } = await client
      .from('chat_mensagens')
      .select('*')
      .eq('loja_id', lojaId)
      .order('timestamp', { ascending: true })
      .limit(200);

    if (error) {
      console.warn('[Chat] Erro na consulta do Supabase, usando local:', error.message);
      return localList;
    }

    if (data && data.length > 0) {
      const mapped: ChatMessage[] = data.map(row => ({
        id: String(row.id),
        loja_id: String(row.loja_id),
        canal_tipo: (row.canal_tipo as 'grupo' | 'direto_lider') || 'grupo',
        destinatario_id: row.destinatario_id ? String(row.destinatario_id) : undefined,
        destinatario_nome: row.destinatario_nome ? String(row.destinatario_nome) : undefined,
        remetente_matricula: String(row.remetente_matricula),
        remetente_nome: String(row.remetente_nome),
        remetente_cargo: row.remetente_cargo ? String(row.remetente_cargo) : undefined,
        is_anonimo: Boolean(row.is_anonimo),
        conteudo: String(row.conteudo || ''),
        timestamp: Number(row.timestamp) || Date.now(),
        created_at: row.created_at ? String(row.created_at) : undefined,
      }));

      // Sincroniza local SEM apagar o que já existe:
      // sobrescrever apagava o histórico de outras lojas e as mensagens
      // locais que ainda não foram sincronizadas.
      try {
        const current = getStoredChatMessages();
        const merged = [
          ...current.filter(c => !mapped.some(m => m.id === c.id)),
          ...mapped,
        ]
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-200);
        localStorage.setItem(LOCAL_STORAGE_CHAT_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }

      return mapped;
    }

    return localList;
  } catch (err) {
    console.warn('[Chat] Erro ao carregar mensagens:', err);
    return localList;
  }
}

/**
 * Nome ESTÁVEL do canal Realtime do chat da loja.
 *
 * IMPORTANTE: o nome precisa ser IDÊNTICO em todos os dispositivos da loja
 * (remetente e destinatário). Se o nome tiver `Date.now()` no final, cada
 * dispositivo cria um canal diferente e as mensagens nunca chegam.
 */
export const getChatChannelName = (lojaId: string): string => `realtime_chat_${lojaId}`;

/**
 * Converte uma linha da tabela `chat_mensagens` no modelo da aplicação.
 */
function mapChatRow(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    loja_id: String(row.loja_id),
    canal_tipo: (row.canal_tipo as 'grupo' | 'direto_lider') || 'grupo',
    destinatario_id: row.destinatario_id ? String(row.destinatario_id) : undefined,
    destinatario_nome: row.destinatario_nome ? String(row.destinatario_nome) : undefined,
    remetente_matricula: String(row.remetente_matricula),
    remetente_nome: String(row.remetente_nome),
    remetente_cargo: row.remetente_cargo ? String(row.remetente_cargo) : undefined,
    is_anonimo: Boolean(row.is_anonimo),
    conteudo: String(row.conteudo || ''),
    timestamp: Number(row.timestamp) || Date.now(),
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

/**
 * Registro de canais de chat abertos, indexado pelo nome estável do canal.
 * Mantém UM único canal por loja para que todos os dispositivos (enviar e
 * receber) compartilhem o mesmo endereço.
 */
interface ChatChannelEntry {
  channel: RealtimeChannel;
  listeners: Set<(msg: ChatMessage) => void>;
  ready: Promise<void>;
}

const chatChannelRegistry = new Map<string, ChatChannelEntry>();

function getOrCreateChatChannel(lojaId: string): ChatChannelEntry {
  const name = getChatChannelName(lojaId);
  const existing = chatChannelRegistry.get(name);
  if (existing) return existing;

  const channel = client!.channel(name, {
    config: { broadcast: { self: false } },
  });
  const listeners = new Set<(msg: ChatMessage) => void>();

  // Canal 1: BROADCAST — entrega instantânea e NÃO depende da tabela estar
  // publicada em `supabase_realtime`. É o caminho que garante latência baixa.
  channel.on('broadcast', { event: 'new_message' }, (payload: { payload?: unknown }) => {
    if (!payload?.payload) return;
    try {
      const msg = payload.payload as ChatMessage;
      if (!msg?.id) return;
      saveStoredChatMessage(msg);
      listeners.forEach((listener) => listener(msg));
    } catch (err) {
      console.warn('[Chat] Erro ao processar broadcast recebido:', err);
    }
  });

  // Canal 2: POSTGRES CHANGES — entrega via tabela (funciona quando a tabela
  // está na publicação `supabase_realtime`). Serve como reforço/redundância.
  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_mensagens',
      filter: `loja_id=eq.${lojaId}`,
    },
    (payload) => {
      if (!payload.new) return;
      const msg = mapChatRow(payload.new as Record<string, unknown>);
      saveStoredChatMessage(msg);
      listeners.forEach((listener) => listener(msg));
    }
  );

  const ready = new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    // Rede lenta ou canal travado não pode bloquear o envio de mensagens.
    const timer = setTimeout(finish, 3000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        finish();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[Chat] Canal realtime com erro (${status}). O envio continua via broadcast.`);
        finish();
      }
    });
  });

  const entry: ChatChannelEntry = { channel, listeners, ready };
  chatChannelRegistry.set(name, entry);
  return entry;
}

/**
 * Envia a mensagem via BROADCAST para entrega instantânea aos demais
 * dispositivos da loja. Não depende da publicação `supabase_realtime`.
 */
export async function broadcastChatMessage(msg: ChatMessage): Promise<boolean> {
  if (!client || !isSupabaseConfigured()) return false;
  try {
    const entry = getOrCreateChatChannel(msg.loja_id);
    await entry.ready;
    const res = await entry.channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: msg,
    });
    return res === 'ok';
  } catch (err) {
    console.warn('[Chat] Falha no broadcast da mensagem:', err);
    return false;
  }
}

/**
 * Envia mensagem para o canal do chat (grupo da loja ou direto com líderes)
 */
export async function sendChatMessageToSupabase(
  msg: Omit<ChatMessage, 'id' | 'timestamp' | 'created_at'>
): Promise<{ success: boolean; data?: ChatMessage; error?: string }> {
  const newMsg: ChatMessage = {
    ...msg,
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    created_at: new Date().toISOString(),
  };

  // Salva no armazenamento local imediatamente
  saveStoredChatMessage(newMsg);

  if (!client || !isSupabaseConfigured()) {
    return { success: true, data: newMsg };
  }

  try {
    // Garante que a loja exista antes do INSERT para evitar falha de FK.
    await ensureStoreExists(newMsg.loja_id);

    const { error } = await client.from('chat_mensagens').insert({
      id: newMsg.id,
      loja_id: newMsg.loja_id,
      canal_tipo: newMsg.canal_tipo,
      destinatario_id: newMsg.destinatario_id || null,
      destinatario_nome: newMsg.destinatario_nome || null,
      remetente_matricula: newMsg.remetente_matricula,
      remetente_nome: newMsg.remetente_nome,
      remetente_cargo: newMsg.remetente_cargo || null,
      is_anonimo: newMsg.is_anonimo,
      conteudo: newMsg.conteudo,
      timestamp: newMsg.timestamp,
    });

    if (error) {
      console.warn('[Chat] insert falhou:', error.message);
      // A mensagem continua visível em tempo real para quem está online e
      // fica na fila offline para ser gravada quando a conexão voltar.
      await broadcastChatMessage(newMsg);
      return { success: true, data: newMsg, error: error.message };
    }

    // Broadcast instantâneo para os demais dispositivos da loja.
    // Feito DEPOIS do insert para o banco sempre ser a fonte de verdade.
    await broadcastChatMessage(newMsg);

    return { success: true, data: newMsg };
  } catch (err: unknown) {
    const msgErr = err instanceof Error ? err.message : String(err);
    console.error('[Chat] Erro no envio:', msgErr);
    return { success: true, data: newMsg, error: msgErr };
  }
}

/**
 * Assina o canal de chat da loja em tempo real.
 *
 * Retorna uma função de cancelamento. O canal físico só é destruído quando
 * não restam mais escutantes, evitando que abrir/fechar o modal derrube a
 * conexão dos demais dispositivos.
 */
export function subscribeToChatRealtime(
  lojaId: string,
  onNewMessage: (msg: ChatMessage) => void
): () => void {
  if (!client || !isSupabaseConfigured()) return () => {};
  const supabaseClient = client;

  try {
    const entry = getOrCreateChatChannel(lojaId);
    entry.listeners.add(onNewMessage);

    return () => {
      entry.listeners.delete(onNewMessage);
      if (entry.listeners.size === 0) {
        try {
          supabaseClient.removeChannel(entry.channel);
        } catch {
          // ignore
        }
        chatChannelRegistry.delete(getChatChannelName(lojaId));
      }
    };
  } catch (err) {
    console.warn('[Chat] Falha ao registrar realtime:', err);
    return () => {};
  }
}

// ============================================================================
// 13. REGISTRO DE AVARIAS NO ESTOQUE (PERDAS, QUEBRAS E TROCAS)
// ============================================================================

export const LOCAL_STORAGE_AVARIAS_KEY = 'superpwa_avarias_estoque_v1';

/**
 * Lê as avarias salvas localmente no dispositivo.
 */
export function getStoredAvarias(lojaId?: string): AvariaItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AVARIAS_KEY);
    if (!raw) return [];
    const list: AvariaItem[] = JSON.parse(raw);
    if (lojaId) return list.filter(a => a.loja_id === lojaId);
    return list;
  } catch (e) {
    console.warn('[Avaria] Erro ao ler avarias locais:', e);
    return [];
  }
}

/**
 * Salva/atualiza uma avaria no armazenamento local.
 */
export function saveStoredAvaria(avaria: AvariaItem): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getStoredAvarias();
    const exists = current.some(a => a.id === avaria.id);
    const updated = exists
      ? current.map(a => (a.id === avaria.id ? avaria : a))
      : [avaria, ...current];
    localStorage.setItem(LOCAL_STORAGE_AVARIAS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[Avaria] Erro ao salvar avaria local:', e);
  }
}

/**
 * Verifica se a tabela `avarias_estoque` existe no projeto Supabase.
 * O app funciona em modo local quando ela ainda não foi criada.
 */
let avariasTableAvailable: boolean | null = null;
export async function isAvariaTableAvailable(): Promise<boolean> {
  if (!client || !isSupabaseConfigured()) return false;
  if (avariasTableAvailable !== null) return avariasTableAvailable;
  try {
    const { error } = await client.from('avarias_estoque').select('id').limit(1);
    avariasTableAvailable = !error;
  } catch {
    avariasTableAvailable = false;
  }
  return avariasTableAvailable;
}

/**
 * Registra uma avaria: grava localmente (garantido) e sincroniza com a nuvem.
 *
 * `synced` indica se a gravação chegou ao banco. Quando a tabela ainda não
 * existe, o registro é preservado no dispositivo e pode ser sincronizado
 * depois que a migração for aplicada.
 */
export async function saveAvariaInDatabase(
  avariaData: Omit<AvariaItem, 'id' | 'registrado_em' | 'timestamp'>
): Promise<{ success: boolean; data?: AvariaItem; synced: boolean; error?: string }> {
  const nowMs = Date.now();
  const avaria: AvariaItem = {
    ...avariaData,
    id: `av_${nowMs}_${Math.random().toString(36).substring(2, 7)}`,
    registrado_em: new Date(nowMs).toLocaleString('pt-BR'),
    timestamp: nowMs,
  };

  // 1. Persistência local garantida (mesmo offline)
  saveStoredAvaria(avaria);

  // 2. Sincronização com a nuvem
  if (!client || !isSupabaseConfigured()) {
    return { success: true, data: avaria, synced: false };
  }

  try {
    const { error } = await client.from('avarias_estoque').upsert(
      {
        id: avaria.id,
        loja_id: avaria.loja_id,
        codigo_barras: avaria.codigo_barras,
        codigo_reduzido: avaria.codigo_reduzido || null,
        produto_nome: avaria.produto_nome,
        quantidade: avaria.quantidade,
        tipo_avaria: avaria.tipo_avaria,
        para_troca: avaria.para_troca,
        setor: avaria.setor || null,
        registrado_por_nome: avaria.registrado_por_nome,
        registrado_por_matricula: avaria.registrado_por_matricula,
        timestamp: avaria.timestamp,
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.warn('[Avaria] Falha ao sincronizar com o Supabase:', error.message);
      return { success: true, data: avaria, synced: false, error: error.message };
    }

    avariasTableAvailable = true;
    return { success: true, data: avaria, synced: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[Avaria] Erro ao sincronizar avaria:', msg);
    return { success: true, data: avaria, synced: false, error: msg };
  }
}

/**
 * Carrega as avarias da loja. Se a tabela não existir, mantém o cache local.
 */
export async function fetchAvariasFromDatabase(lojaId: string): Promise<AvariaItem[]> {
  const localList = getStoredAvarias(lojaId);

  if (!client || !isSupabaseConfigured()) return localList;

  try {
    const { data, error } = await client
      .from('avarias_estoque')
      .select('*')
      .eq('loja_id', lojaId)
      .order('timestamp', { ascending: false })
      .limit(200);

    if (error) {
      console.warn('[Avaria] Erro na consulta, mantendo cache local:', error.message);
      avariasTableAvailable = false;
      return localList;
    }

    avariasTableAvailable = true;
    if (!data || data.length === 0) return localList;

    const mapped: AvariaItem[] = data.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      loja_id: String(row.loja_id),
      codigo_barras: String(row.codigo_barras),
      codigo_reduzido: row.codigo_reduzido ? String(row.codigo_reduzido) : undefined,
      produto_nome: String(row.produto_nome || ''),
      quantidade: Number(row.quantidade) || 0,
      tipo_avaria: (row.tipo_avaria as AvariaItem['tipo_avaria']) || 'Outro',
      para_troca: Boolean(row.para_troca),
      setor: row.setor ? String(row.setor) : undefined,
      registrado_por_nome: String(row.registrado_por_nome || ''),
      registrado_por_matricula: String(row.registrado_por_matricula || ''),
      registrado_em: row.timestamp
        ? new Date(Number(row.timestamp)).toLocaleString('pt-BR')
        : '',
      timestamp: Number(row.timestamp) || Date.now(),
    }));

    // Consolida o banco como fonte de verdade, preservando o que só existe local
    const merged = [...mapped];
    localList.forEach(local => {
      if (!merged.some(m => m.id === local.id)) merged.push(local);
    });
    merged.sort((a, b) => b.timestamp - a.timestamp);

    try {
      localStorage.setItem(LOCAL_STORAGE_AVARIAS_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }

    return merged;
  } catch (err) {
    console.warn('[Avaria] Erro ao carregar avarias:', err);
    return localList;
  }
}

/**
 * Assina as avarias da loja em tempo real.
 *
 * Usa BROADCAST (não depende da publicação `supabase_realtime`) e completa
 * com `postgres_changes` quando a tabela estiver publicada.
 */
export function subscribeToAvariasRealtime(
  lojaId: string,
  onNewAvaria: (avaria: AvariaItem) => void
): () => void {
  if (!client || !isSupabaseConfigured()) return () => {};
  const supabaseClient = client;

  try {
    const channel = supabaseClient.channel(`realtime_avarias_${lojaId}`, {
      config: { broadcast: { self: false } },
    });

    const emit = (avaria: AvariaItem) => {
      saveStoredAvaria(avaria);
      onNewAvaria(avaria);
    };

    channel.on('broadcast', { event: 'new_avaria' }, (payload: { payload?: unknown }) => {
      if (!payload?.payload) return;
      try {
        emit(payload.payload as AvariaItem);
      } catch {
        // ignore
      }
    });

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'avarias_estoque',
        filter: `loja_id=eq.${lojaId}`,
      },
      (payload) => {
        const row = (payload.new || payload.old) as Record<string, unknown> | undefined;
        if (!row || !row.id) return;
        emit({
          id: String(row.id),
          loja_id: String(row.loja_id || lojaId),
          codigo_barras: String(row.codigo_barras || ''),
          codigo_reduzido: row.codigo_reduzido ? String(row.codigo_reduzido) : undefined,
          produto_nome: String(row.produto_nome || ''),
          quantidade: Number(row.quantidade) || 0,
          tipo_avaria: (row.tipo_avaria as AvariaItem['tipo_avaria']) || 'Outro',
          para_troca: Boolean(row.para_troca),
          setor: row.setor ? String(row.setor) : undefined,
          registrado_por_nome: String(row.registrado_por_nome || ''),
          registrado_por_matricula: String(row.registrado_por_matricula || ''),
          registrado_em: row.timestamp ? new Date(Number(row.timestamp)).toLocaleString('pt-BR') : '',
          timestamp: Number(row.timestamp) || Date.now(),
        });
      }
    );

    channel.subscribe();

    return () => {
      try {
        supabaseClient.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  } catch (err) {
    console.warn('[Avaria] Falha ao registrar realtime:', err);
    return () => {};
  }
}

// ============================================================================
// 14. BLOQUEIO E ATUALIZAÇÃO DE PRODUTOS (CONCORRÊNCIA E 2º CÓDIGO DE BARRAS)
// ============================================================================

export async function lockProductInSupabase(
  productId: string,
  lockedBy: string
): Promise<{ success: boolean }> {
  if (!client || !isSupabaseConfigured()) return { success: true };

  try {
    await client
      .from('produtos')
      .update({
        is_locked_for_edit: true,
        locked_by: lockedBy,
        locked_at: new Date().toISOString(),
      })
      .eq('id', productId);
    return { success: true };
  } catch (err) {
    console.warn('[ProductLock] Erro ao bloquear produto:', err);
    return { success: true };
  }
}

export async function unlockProductInSupabase(productId: string): Promise<{ success: boolean }> {
  if (!client || !isSupabaseConfigured()) return { success: true };

  try {
    await client
      .from('produtos')
      .update({
        is_locked_for_edit: false,
        locked_by: null,
        locked_at: null,
      })
      .eq('id', productId);
    return { success: true };
  } catch (err) {
    console.warn('[ProductLock] Erro ao desbloquear produto:', err);
    return { success: true };
  }
}

export async function updateProductInSupabase(
  productId: string,
  updates: Partial<Product>
): Promise<{ success: boolean; error?: string }> {
  if (!client || !isSupabaseConfigured()) return { success: true };

  try {
    const payload: Record<string, unknown> = {
      is_locked_for_edit: false,
      locked_by: null,
      locked_at: null,
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) payload.nome = updates.name.trim();
    if (updates.ean !== undefined) payload.codigo_barras = updates.ean.trim();
    if (updates.secondaryEan !== undefined) payload.codigo_barras_secundario = updates.secondaryEan.trim() || null;
    if (updates.stock !== undefined) payload.quantidade = Math.max(0, updates.stock);
    if (updates.category !== undefined) payload.setor = updates.category;
    if (updates.reducedCode !== undefined) payload.plu = updates.reducedCode.trim() || null;
    if (updates.supplierCode !== undefined) payload.codigo_fornecedor = updates.supplierCode.trim() || null;

    const { error } = await client
      .from('produtos')
      .update(payload)
      .eq('id', productId);

    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[UpdateProduct] Erro:', msg);
    return { success: false, error: msg };
  }
}


