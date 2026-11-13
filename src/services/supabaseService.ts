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
  AvariaItem,
  SETORES_DISPONIVEIS,
  TIPOS_AVARIA
} from '../types';
import { decryptSingleField, encryptSingleField, isEncrypted } from '../utils/encryptionUtils';
import {
  sanitizeText,
  sanitizeIdentifier,
  sanitizeBarcode,
  validatePositiveInt,
  validateEnum,
  validateHexColor,
  validateSafeHttpUrl,
} from '../utils/security';

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
  const safeUrl = validateSafeHttpUrl(url);
  const cleanKey = sanitizeText(key, 512);

  if (!safeUrl) {
    return { success: false, message: 'A URL do Supabase deve iniciar com https:// ou http:// válida.' };
  }

  if (!cleanKey || cleanKey.length < 20) {
    return { success: false, message: 'A chave anônima (anon key) do Supabase é inválida.' };
  }

  const cleanUrl = safeUrl;

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
  const cleanMatricula = sanitizeIdentifier(matricula, 64);
  const cleanPassword = typeof newPassword === 'string' ? newPassword.trim() : '';

  if (!cleanMatricula) {
    return { success: false, message: 'Matrícula inválida.' };
  }
  if (cleanPassword.length < 7 || cleanPassword.length > 128) {
    return { success: false, message: 'A nova senha deve ter entre 7 e 128 caracteres.' };
  }

  const encryptedPassword = encryptSingleField(cleanPassword, undefined, { skipSanitize: true });

  // Funcionários e Gerentes de Loja
  const emps = getStoredEmployees();
  const idx = emps.findIndex(e => e.matricula.toLowerCase() === cleanMatricula.toLowerCase());

  if (idx >= 0) {
    emps[idx].senha = encryptedPassword;
    emps[idx].primeiro_login = false;
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_EMPLOYEES_KEY, JSON.stringify(emps));
    }

    // Sincroniza também no Supabase se cliente estiver ativo.
    // O PostgrestBuilder NUNCA rejeita: o erro vem dentro do valor resolvido.
    if (client) {
      const { error } = await client.rpc('rpc_alterar_senha', {
        p_matricula: cleanMatricula,
        p_nova_senha: encryptedPassword,
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
          p_nova_senha: encryptedPassword,
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
          nome: decryptSingleField(String(remoteUser.nome || '')),
          senha: encryptedPassword,
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
  const cleanMatricula = sanitizeIdentifier(matricula, 64);

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
  const cleanMatricula = sanitizeIdentifier(matricula, 64);
  if (!cleanMatricula) return { active: false, companyName: 'Sua Loja' };

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
    const cleanMatricula = sanitizeIdentifier(matricula, 64).toLowerCase();
    if (!cleanMatricula) return () => {};
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
  const cleanMatricula = sanitizeIdentifier(matricula, 64);
  const cleanSenha = typeof senha === 'string' ? senha.trim() : '';

  if (!cleanMatricula || !cleanSenha) {
    return { success: false, message: 'Matrícula ou senha inválida.' };
  }

  // 1. Checagem em funcionários/gerentes cadastrados localmente (offline)
  const localEmployees = getStoredEmployees();
  const matchedEmp = localEmployees.find(
    e =>
      e.matricula.toLowerCase() === cleanMatricula.toLowerCase() &&
      !!e.senha &&
      decryptSingleField(e.senha, undefined, { skipSanitize: true }) === cleanSenha
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
        nome: decryptSingleField(matchedEmp.nome),
        cargo: isGerente ? 'gerente' : 'operador',
        cargoCompleto: sanitizeText(matchedEmp.cargo || 'Operador de Loja', 64),
        setor: matchedEmp.setor_restrito === 'TODOS' ? 'Geral' : sanitizeText(matchedEmp.setor_restrito || 'Geral', 64),
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
            nome: decryptSingleField(String(data.user.nome || '')),
            cargo: mappedCargo,
            cargoCompleto: sanitizeText(data.user.cargo || 'Operador de Loja', 64),
            setor: sanitizeText(data.user.setor || 'Geral', 64),
            loja_id: data.user.loja_id || '',
            loja_nome: sanitizeText(data.user.loja_nome || '', 120),
            primeiro_login: data.user.primeiro_login ?? true,
          },
        };
      }

      // Consulta direta na tabela 'usuarios' (suporta senhas criptografadas ponta a ponta)
      const { data: userData, error: userError } = await client
        .from('usuarios')
        .select('*')
        .eq('matricula', cleanMatricula)
        .eq('ativo', true)
        .single();

      if (!userError && userData) {
        const decryptedDbPass = decryptSingleField(String(userData.senha || ''), undefined, { skipSanitize: true });
        if (decryptedDbPass === cleanSenha) {
          const dbCargo = String(userData.cargo || 'operador').toLowerCase();
          const mappedCargo = dbCargo.includes('saas') ? 'saas_admin' : dbCargo.includes('gerente') ? 'gerente' : 'operador';

          return {
            success: true,
            token: 'tok_' + Math.random().toString(36).substring(2),
            user: {
              id: userData.id,
              matricula: userData.matricula,
              nome: decryptSingleField(String(userData.nome || '')),
              cargo: mappedCargo,
              cargoCompleto: sanitizeText(userData.cargo || 'Operador de Loja', 64),
              setor: sanitizeText(userData.setor || 'Geral', 64),
              loja_id: userData.loja_id || '',
              loja_nome: '',
              primeiro_login: userData.primeiro_login ?? true,
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
        id: sanitizeIdentifier(d.id),
        nome_loja: sanitizeText(d.nome_loja || 'Loja', 120),
        cnpj: d.cnpj ? decryptSingleField(String(d.cnpj)) : undefined,
        endereco: d.endereco ? decryptSingleField(String(d.endereco)) : undefined,
        telefone: d.telefone ? decryptSingleField(String(d.telefone)) : undefined,
        limite_usuarios: validatePositiveInt(d.limite_usuarios, 15, 10000),
        ativa: Boolean(d.ativa ?? true),
        cor_primaria: validateHexColor(d.cor_borda || d.cor_primaria, '#059669'),
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
  const cleanStore: Store = {
    ...store,
    id: sanitizeIdentifier(store.id, 64),
    nome_loja: sanitizeText(store.nome_loja, 120),
    cnpj: store.cnpj ? sanitizeText(store.cnpj, 32) : undefined,
    endereco: store.endereco ? sanitizeText(store.endereco, 200) : undefined,
    telefone: store.telefone ? sanitizeText(store.telefone, 32) : undefined,
    limite_usuarios: validatePositiveInt(store.limite_usuarios, 15, 10000),
    ativa: Boolean(store.ativa),
    cor_primaria: validateHexColor(store.cor_primaria, '#059669'),
  };

  if (!cleanStore.id || !cleanStore.nome_loja) {
    return { success: false, error: 'Dados da loja inválidos.' };
  }

  const localStores = getStoredStores();
  const updated = [cleanStore, ...localStores.filter(s => s.id !== cleanStore.id)];
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_STORES_KEY, JSON.stringify(updated));
  }

  if (client) {
    try {
      const { error } = await client.from('lojas').upsert({
        id: cleanStore.id,
        nome_loja: cleanStore.nome_loja,
        cnpj: cleanStore.cnpj ? encryptSingleField(cleanStore.cnpj) : null,
        endereco: cleanStore.endereco ? encryptSingleField(cleanStore.endereco) : null,
        telefone: cleanStore.telefone ? encryptSingleField(cleanStore.telefone) : null,
        limite_usuarios: cleanStore.limite_usuarios,
        ativa: cleanStore.ativa,
        cor_borda: cleanStore.cor_primaria || '#059669',
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
 * Atualiza o nome e a cor de identidade visual da loja no banco e localmente
 */
export async function updateStoreSettingsInDatabase(
  storeId: string,
  updates: { nome_loja?: string; cor_primaria?: string }
): Promise<{ success: boolean; error?: string }> {
  const cleanStoreId = sanitizeIdentifier(storeId, 64);
  if (!cleanStoreId) return { success: false, error: 'Loja inválida.' };

  const safeNome = updates.nome_loja !== undefined ? sanitizeText(updates.nome_loja, 120) : undefined;
  const safeColor = updates.cor_primaria !== undefined ? validateHexColor(updates.cor_primaria, '#059669') : undefined;

  const localStores = getStoredStores();
  const index = localStores.findIndex(s => s.id === cleanStoreId);
  if (index !== -1) {
    if (safeNome !== undefined) localStores[index].nome_loja = safeNome;
    if (safeColor !== undefined) localStores[index].cor_primaria = safeColor;
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_STORES_KEY, JSON.stringify(localStores));
    }
  }

  if (client && cleanStoreId) {
    try {
      const payload: Record<string, unknown> = {};
      if (safeNome !== undefined) payload.nome_loja = safeNome;
      if (safeColor !== undefined) payload.cor_borda = safeColor;

      const { error } = await client
        .from('lojas')
        .update(payload)
        .eq('id', cleanStoreId);

      if (error) {
        console.warn('Erro ao atualizar configurações da loja no banco:', error.message);
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      console.warn('Erro de conexão ao atualizar loja:', err);
      return { success: false, error: err?.message || 'Falha de conexão com o banco.' };
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
  const cleanStoreId = sanitizeIdentifier(storeId, 64);
  const safeLimit = validatePositiveInt(newLimit, 15, 10000);
  if (!cleanStoreId) return { success: false, error: 'Loja inválida.' };

  const localStores = getStoredStores();
  const index = localStores.findIndex(s => s.id === cleanStoreId);
  if (index !== -1) {
    localStores[index].limite_usuarios = safeLimit;
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_STORES_KEY, JSON.stringify(localStores));
    }
  }

  if (client) {
    try {
      const { error } = await client
        .from('lojas')
        .update({ limite_usuarios: safeLimit })
        .eq('id', cleanStoreId);

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
    const cleanLojaId = lojaId && lojaId !== 'todas' ? sanitizeIdentifier(lojaId, 64) : '';
    let query = client
      .from('sessoes_ativas')
      .select('matricula, usuario_nome, loja_id, timestamp, last_seen, status, updated_at')
      .eq('status', 'ATIVA')
      .order('last_seen', { ascending: false });

    if (cleanLojaId) {
      query = query.eq('loja_id', cleanLojaId);
    }

    const { data, error } = await query;
    if (!error && data) {
      return (data as ActiveSession[]).map(s => ({
        ...s,
        usuario_nome: s.usuario_nome ? decryptSingleField(s.usuario_nome) : undefined,
      }));
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
  const cleanLojaId = lojaId && lojaId !== 'todas' ? sanitizeIdentifier(lojaId, 64) : lojaId;
  const allEmps = getStoredEmployees().map(e => ({
    ...e,
    nome: decryptSingleField(e.nome),
    senha: e.senha ? decryptSingleField(e.senha, undefined, { skipSanitize: true }) : '',
  }));
  const filtered = allEmps.filter(e => !cleanLojaId || e.loja_id === cleanLojaId || cleanLojaId === 'todas');

  if (!client) return filtered;

  try {
    let query = client
      .from('usuarios')
      .select('*')
      .neq('cargo', 'saas_admin')
      .order('nome', { ascending: true });

    if (cleanLojaId && cleanLojaId !== 'todas') {
      query = query.eq('loja_id', cleanLojaId);
    }

    const { data, error } = await query;

    if (!error && data) {
      const mapped: StoreEmployee[] = data.map((u: Record<string, unknown>) => ({
        id: sanitizeIdentifier(u.id, 64),
        matricula: sanitizeIdentifier(u.matricula, 64),
        nome: decryptSingleField(String(u.nome || '')),
        senha: u.senha ? decryptSingleField(String(u.senha), undefined, { skipSanitize: true }) : '',
        cargo: sanitizeText(u.cargo || 'Operador', 64),
        setor_restrito: u.setor ? sanitizeText(u.setor, 64) : 'TODOS',
        loja_id: sanitizeIdentifier(u.loja_id || cleanLojaId || '', 64),
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
  const cleanEmp: StoreEmployee = {
    ...emp,
    id: sanitizeIdentifier(emp.id, 64),
    matricula: sanitizeIdentifier(emp.matricula, 64),
    nome: sanitizeText(emp.nome, 120),
    senha: typeof emp.senha === 'string' ? emp.senha.trim() : '',
    cargo: sanitizeText(emp.cargo || 'Operador', 64),
    setor_restrito: sanitizeText(emp.setor_restrito || 'TODOS', 64),
    loja_id: sanitizeIdentifier(emp.loja_id, 64),
    ativo: Boolean(emp.ativo),
  };

  if (!cleanEmp.id || !cleanEmp.matricula || !cleanEmp.nome) {
    return { success: false, error: 'Dados do funcionário inválidos.' };
  }

  const encryptedNome = encryptSingleField(cleanEmp.nome);
  const encryptedSenha = cleanEmp.senha ? encryptSingleField(cleanEmp.senha, undefined, { skipSanitize: true }) : '';

  const allEmps = getStoredEmployees();
  const isNewEmployee = !allEmps.some(e => e.id === cleanEmp.id || e.matricula === cleanEmp.matricula);
  const storedRecord: StoreEmployee = {
    ...cleanEmp,
    nome: encryptedNome,
    senha: encryptedSenha,
  };
  const updated = [storedRecord, ...allEmps.filter(e => e.id !== cleanEmp.id && e.matricula !== cleanEmp.matricula)];
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_EMPLOYEES_KEY, JSON.stringify(updated));
  }

  if (client && isSupabaseConfigured()) {
    try {
      await client.from('usuarios').upsert({
        id: cleanEmp.id,
        matricula: cleanEmp.matricula,
        nome: encryptedNome,
        senha: encryptedSenha,
        cargo: cleanEmp.cargo,
        setor: cleanEmp.setor_restrito,
        loja_id: cleanEmp.loja_id,
        ativo: cleanEmp.ativo,
      });
    } catch (err) {
      console.warn('Erro ao salvar funcionário no banco:', err);
    }
  } else if (isNewEmployee && cleanEmp.ativo && cleanEmp.loja_id && cleanEmp.cargo !== 'saas_admin') {
    saveStoredChatMessage({
      id: `msg_welcome_${cleanEmp.id}_${Date.now()}`,
      loja_id: cleanEmp.loja_id,
      canal_tipo: 'grupo',
      remetente_matricula: 'SISTEMA',
      remetente_nome: 'Sistema OpSys',
      remetente_cargo: 'Boas-Vindas',
      is_anonimo: false,
      conteudo: `👋 Boas-vindas! ${cleanEmp.nome} entrou na loja e agora faz parte do Chat Operacional.`,
      timestamp: Date.now(),
      created_at: new Date().toISOString(),
    });
  }

  return { success: true };
}

export async function toggleStoreEmployeeActive(empId: string, active: boolean): Promise<boolean> {
  const cleanEmpId = sanitizeIdentifier(empId, 64);
  if (!cleanEmpId) return false;

  const allEmps = getStoredEmployees();
  const updated = allEmps.map(e => e.id === cleanEmpId ? { ...e, ativo: Boolean(active) } : e);
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_EMPLOYEES_KEY, JSON.stringify(updated));
  }

  if (client) {
    try {
      await client.from('usuarios').update({ ativo: Boolean(active) }).eq('id', cleanEmpId);
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
  const lojaId = sanitizeIdentifier(options?.lojaId || '', 64);
  const matricula = sanitizeIdentifier(options?.operatorMatricula || 'SISTEMA', 64);
  const nomeOperador = sanitizeText(options?.operatorNome || 'Operador', 120);

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

    // Mapeia produtos já existentes na loja descriptografando o EAN em RAM para atualizar sem expor EAN em texto puro
    const { data: existingStoreRows } = await client
      .from('produtos')
      .select('id, codigo_barras')
      .eq('loja_id', lojaId);

    const existingMap = new Map<string, string>();
    (existingStoreRows || []).forEach((r: { id: string; codigo_barras: string }) => {
      const decEan = sanitizeBarcode(decryptSingleField(String(r.codigo_barras || '')));
      if (decEan) existingMap.set(decEan, r.id);
    });

    const batchSize = 10;
    let uploaded = 0;
    const defaultDueDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (let i = 0; i < total; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);

      // 1. Mapeamento sanitizado e totalmente criptografado para a tabela 'produtos':
      const preparedChunk = chunk.map(c => {
        const cleanEan = sanitizeBarcode(c.original.ean, 32);
        const cleanName = sanitizeText(c.original.name, 200);
        const cleanReduced = c.original.reducedCode ? sanitizeIdentifier(c.original.reducedCode, 32) : '';
        const cleanSupplier = c.original.supplierCode ? sanitizeIdentifier(c.original.supplierCode, 32) : '';
        const cleanSetor = validateEnum(c.original.setor || c.original.sector, SETORES_DISPONIVEIS, 'MERCEARIA');
        const cleanQty = validatePositiveInt(c.original.quantity, 0);

        return {
          cleanEan,
          cleanName,
          dbRow: {
            loja_id: lojaId,
            codigo_barras: encryptSingleField(cleanEan),
            nome: encryptSingleField(cleanName),
            plu: cleanReduced ? encryptSingleField(cleanReduced) : null,
            codigo_fornecedor: cleanSupplier ? encryptSingleField(cleanSupplier) : null,
            setor: cleanSetor,
            quantidade: cleanQty,
            data_vencimento: defaultDueDate,
            is_encrypted: true,
            ciphertext: c.encrypted.ciphertext,
            iv: c.encrypted.iv,
            criado_em: Date.now(),
          },
        };
      });

      for (const entry of preparedChunk) {
        if (!entry.cleanEan || !entry.cleanName) continue;
        const existingId = existingMap.get(entry.cleanEan);
        if (existingId) {
          const { error: updateErr } = await client
            .from('produtos')
            .update(entry.dbRow)
            .eq('id', existingId);
          if (updateErr) throw updateErr;
        } else {
          const { data: insertedRow, error: insertErr } = await client
            .from('produtos')
            .insert(entry.dbRow)
            .select('id')
            .maybeSingle();
          if (insertErr) throw insertErr;
          if (insertedRow?.id) {
            existingMap.set(entry.cleanEan, String(insertedRow.id));
          }
        }
      }

      // 2. Mapeamento criptografado para 'produtos_catalogo_universal' (Script 08)
      const payloadCatalogoUniversal = preparedChunk
        .filter(e => e.cleanEan && e.cleanName)
        .map(e => ({
          codigo_barras: encryptSingleField(e.cleanEan),
          nome: encryptSingleField(e.cleanName),
        }));

      if (payloadCatalogoUniversal.length > 0) {
        try {
          await client
            .from('produtos_catalogo_universal')
            .insert(payloadCatalogoUniversal);
        } catch (catErr) {
          console.debug('Aviso catálogo universal:', catErr);
        }
      }

      uploaded += chunk.length;
      if (onRealtimeProgress) {
        const pct = Math.round((uploaded / total) * 100);
        onRealtimeProgress(uploaded, total, pct);
      }
    }

    // 3. Registrar auditoria criptografada em 'app_logs' (Script 06)
    try {
      await client.from('app_logs').insert({
        usuario_matricula: matricula,
        usuario_nome: encryptSingleField(nomeOperador),
        loja_id: lojaId,
        acao: 'IMPORTACAO_PLANILHA_ESTOQUE',
        detalhes: encryptSingleField(`Importação de ${total} produtos criptografados gravados no banco com sucesso.`),
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
    const cleanLojaId = lojaId ? sanitizeIdentifier(lojaId, 64) : '';
    let data: Record<string, unknown>[] | null = null;

    // 1. Tenta buscar pela loja específica se informada
    if (cleanLojaId) {
      const res = await client
        .from('produtos')
        .select('*')
        .eq('loja_id', cleanLojaId)
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
            id: `cat-${idx}-${sanitizeBarcode(decryptSingleField(rawEan))}`,
            ean: sanitizeBarcode(decryptSingleField(rawEan)),
            name: decryptSingleField(rawNome) || 'Produto Universal',
            category: 'MERCEARIA',
            stock: 0,
            minStock: 10,
            price: 0,
            location: 'Gôndola - Catálogo',
            loja_id: cleanLojaId,
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
        id: sanitizeIdentifier(row.id || `prod-${Math.random().toString(36).substring(2, 9)}`, 64),
        ean: sanitizeBarcode(decryptSingleField(rawEan)),
        secondaryEan: row.codigo_barras_secundario ? sanitizeBarcode(decryptSingleField(String(row.codigo_barras_secundario))) : undefined,
        name: decryptSingleField(rawNome) || 'Produto Cadastrado',
        supplierCode: decryptSingleField(rawForn),
        reducedCode: decryptSingleField(rawPlu),
        category: sanitizeText(row.setor || 'MERCEARIA', 64),
        stock: validatePositiveInt(row.quantidade, 0),
        minStock: 10,
        price: 0,
        location: `Gôndola - ${sanitizeText(row.setor || 'Estoque', 64)}`,
        loja_id: sanitizeIdentifier(row.loja_id || cleanLojaId || '', 64),
        data_vencimento: sanitizeText(row.data_vencimento || '', 20),
        isLockedForEdit: Boolean(row.is_locked_for_edit),
        lockedBy: row.locked_by ? decryptSingleField(String(row.locked_by)) : undefined,
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

  const cleanLojaId = sanitizeIdentifier(lojaId, 64);
  let synced = 0;
  try {
    for (const action of actions) {
      if (action.type === 'UPDATE_STOCK') {
        const payload = action.payload as { id: string; exact?: number; delta?: number };
        const cleanId = sanitizeIdentifier(payload.id, 64);
        if (cleanId && typeof payload.exact === 'number') {
          await client
            .from('produtos')
            .update({
              quantidade: validatePositiveInt(payload.exact, 0),
              updated_at: new Date().toISOString(),
            })
            .eq('id', cleanId);
        }
        synced++;
      } else if (action.type === 'ADD_PRODUCT') {
        const p = action.payload as Product;
        const cleanEan = sanitizeBarcode(p.ean, 32);
        const cleanName = sanitizeText(p.name, 200);
        if (cleanEan && cleanName) {
          await client.from('produtos').insert({
            loja_id: sanitizeIdentifier(p.loja_id || cleanLojaId, 64),
            codigo_barras: encryptSingleField(cleanEan),
            nome: encryptSingleField(cleanName),
            plu: p.reducedCode ? encryptSingleField(sanitizeIdentifier(p.reducedCode, 32)) : null,
            codigo_fornecedor: p.supplierCode ? encryptSingleField(sanitizeIdentifier(p.supplierCode, 32)) : null,
            setor: sanitizeText(p.category || 'MERCEARIA', 64),
            quantidade: validatePositiveInt(p.stock, 0),
            is_encrypted: true,
            ciphertext: p.encryptedPayload?.ciphertext || null,
            iv: p.encryptedPayload?.iv || null,
          });
        }
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
// 1. auditoria_presenca_sessoes (sessões ativas no setor - Presença e Inventário)
// 2. auditoria_presenca_bips (produtos bipados ao vivo por cada membro)
// 3. produtos (produtos do setor a serem conferidos)
// 4. auditorias_finalizadas & auditoria_produtos (histórico permanente e relatórios)
// ============================================================================

export type AuditSessionTipo = 'PRESENCA' | 'INVENTARIO' | 'VALIDADE';

export interface DbActiveAuditSession {
  id: string;
  loja_id: string;
  setor: string;
  tipo?: AuditSessionTipo;
  iniciada_por_nome: string;
  iniciada_por_matricula: string;
  status: 'ATIVA' | 'PAUSADA' | 'CONCLUIDA';
  data_auditoria?: string;
  hora_auditoria?: string;
  chave_auditoria?: string;
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
  quantidade_fisica?: number | null;
  operador_matricula: string;
  operador_nome: string;
  data_auditoria?: string;
  hora_auditoria?: string;
  chave_auditoria?: string;
  timestamp: number;
}

export function buildAuditCompositeParts(lojaId: string, setor: string, timestampMs: number) {
  const d = new Date(timestampMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dataAuditoria = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const horaAuditoria = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const cleanLoja = (lojaId || 'sem_loja').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanSetor = (setor || 'GERAL').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const chaveAuditoria = `${cleanLoja}__${cleanSetor}__${dataAuditoria}__${horaAuditoria.replace(/:/g, '-')}`;
  return { dataAuditoria, horaAuditoria, chaveAuditoria };
}

const LOCAL_ACTIVE_SESSIONS_KEY = 'superpwa_active_audit_sessions';
const LOCAL_AUDIT_BIPS_KEY = 'superpwa_audit_bips_';
export const AUDIT_SESSION_MAX_INACTIVITY_MS = 5 * 60 * 60 * 1000; // 5 horas

/**
 * Consulta sessões ativas de auditoria (isoladas por loja, ordenadas cronologicamente)
 */
export async function fetchActiveAuditSessions(lojaId: string): Promise<DbActiveAuditSession[]> {
  const cleanLojaId = sanitizeIdentifier(lojaId, 64);
  if (!cleanLojaId) return [];
  const now = Date.now();
  const isNotExpired = (s: DbActiveAuditSession) => (now - Number(s.timestamp || 0)) < AUDIT_SESSION_MAX_INACTIVITY_MS;

  if (client && isSupabaseConfigured()) {
    try {
      const { data, error } = await client
        .from('auditoria_presenca_sessoes')
        .select('*')
        .eq('loja_id', cleanLojaId)
        .eq('status', 'ATIVA')
        .order('data_auditoria', { ascending: false })
        .order('hora_auditoria', { ascending: false })
        .order('timestamp', { ascending: false });

      if (!error && data) {
        const sessions = (data as DbActiveAuditSession[]).map(s => ({
          ...s,
          iniciada_por_nome: decryptSingleField(s.iniciada_por_nome),
        }));
        const expiredIds = sessions.filter(s => !isNotExpired(s)).map(s => s.id);
        if (expiredIds.length > 0) {
          client
            .from('auditoria_presenca_sessoes')
            .update({ status: 'CONCLUIDA' })
            .in('id', expiredIds)
            .then(() => {});
        }
        const active = sessions.filter(isNotExpired);
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_ACTIVE_SESSIONS_KEY, JSON.stringify(active));
        }
        return active;
      }
    } catch (err) {
      console.debug('Aviso ao consultar sessões ativas no banco:', err);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_ACTIVE_SESSIONS_KEY);
      if (raw) {
        const parsed: DbActiveAuditSession[] = JSON.parse(raw);
        return parsed.filter(s => s.loja_id === cleanLojaId && isNotExpired(s));
      }
    } catch {
      // ignore
    }
  }
  return [];
}

/**
 * Verifica o status atual de uma sessão específica para detectar encerramento do anfitrião
 */
export async function checkAuditSessionStatus(
  sessaoId: string,
  lojaId: string
): Promise<'ATIVA' | 'PAUSADA' | 'CONCLUIDA' | null> {
  const cleanSessaoId = sanitizeIdentifier(sessaoId, 128);
  const cleanLojaId = sanitizeIdentifier(lojaId, 64);
  if (!client || !isSupabaseConfigured() || !cleanSessaoId || !cleanLojaId) return null;
  try {
    const { data, error } = await client
      .from('auditoria_presenca_sessoes')
      .select('status')
      .eq('id', cleanSessaoId)
      .eq('loja_id', cleanLojaId)
      .maybeSingle();
    if (error || !data) return null;
    return (data.status as 'ATIVA' | 'PAUSADA' | 'CONCLUIDA') || null;
  } catch {
    return null;
  }
}

/**
 * Inicia uma nova sessão de auditoria com chave composta (loja + setor + data + hora)
 */
export async function startAuditSessionInDatabase(data: {
  lojaId: string;
  setor: string;
  tipo?: AuditSessionTipo;
  matricula: string;
  nome: string;
}): Promise<{ success: boolean; session?: DbActiveAuditSession; error?: string }> {
  const cleanLojaId = sanitizeIdentifier(data.lojaId, 64);
  const cleanSetor = sanitizeText(data.setor || 'GERAL', 64);
  const cleanMatricula = sanitizeIdentifier(data.matricula, 64);
  const cleanNome = sanitizeText(data.nome, 120);
  const nowMs = Date.now();
  const tipo: AuditSessionTipo = validateEnum(data.tipo, ['PRESENCA', 'INVENTARIO', 'VALIDADE'] as const, 'PRESENCA');
  const { dataAuditoria, horaAuditoria, chaveAuditoria } = buildAuditCompositeParts(cleanLojaId, cleanSetor, nowMs);
  const sessaoId = `${chaveAuditoria}__${tipo.toLowerCase()}_${Math.random().toString(36).substring(2, 6)}`;

  const newSession: DbActiveAuditSession = {
    id: sessaoId,
    loja_id: cleanLojaId,
    setor: cleanSetor,
    tipo,
    iniciada_por_nome: cleanNome,
    iniciada_por_matricula: cleanMatricula,
    status: 'ATIVA',
    data_auditoria: dataAuditoria,
    hora_auditoria: horaAuditoria,
    chave_auditoria: chaveAuditoria,
    timestamp: nowMs,
    created_at: new Date(nowMs).toISOString(),
  };

  if (client && isSupabaseConfigured()) {
    try {
      await ensureStoreExists(cleanLojaId);
      const { error } = await client.from('auditoria_presenca_sessoes').insert({
        id: newSession.id,
        loja_id: newSession.loja_id,
        setor: newSession.setor,
        tipo: newSession.tipo,
        iniciada_por_nome: encryptSingleField(cleanNome),
        iniciada_por_matricula: newSession.iniciada_por_matricula,
        status: newSession.status,
        data_auditoria: newSession.data_auditoria,
        hora_auditoria: newSession.hora_auditoria,
        chave_auditoria: newSession.chave_auditoria,
        timestamp: newSession.timestamp,
      });

      if (error) {
        console.warn('Aviso insert sessao auditoria:', error.message);
      }
    } catch (err) {
      console.warn('Erro ao salvar sessão de auditoria no Supabase:', err);
    }
  }

  if (typeof window !== 'undefined') {
    const active = await fetchActiveAuditSessions(cleanLojaId);
    const updated = [newSession, ...active.filter(s => s.id !== newSession.id)];
    localStorage.setItem(LOCAL_ACTIVE_SESSIONS_KEY, JSON.stringify(updated));
  }

  return { success: true, session: newSession };
}

/**
 * Consulta todos os bips em tempo real de uma sessão ativa
 */
export async function fetchSessionBipsFromDatabase(sessaoId: string): Promise<DbAuditBip[]> {
  const cleanSessaoId = sanitizeIdentifier(sessaoId, 128);
  if (!cleanSessaoId) return [];

  if (client && isSupabaseConfigured()) {
    try {
      const { data, error } = await client
        .from('auditoria_presenca_bips')
        .select('*')
        .eq('sessao_id', cleanSessaoId)
        .order('timestamp', { ascending: false });

      if (!error && data) {
        const decrypted = (data as DbAuditBip[]).map(b => ({
          ...b,
          codigo_barras: sanitizeBarcode(decryptSingleField(b.codigo_barras)),
          produto_nome: decryptSingleField(b.produto_nome),
          operador_nome: decryptSingleField(b.operador_nome),
        }));
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_AUDIT_BIPS_KEY + cleanSessaoId, JSON.stringify(decrypted));
        }
        return decrypted;
      }
    } catch (err) {
      console.debug('Aviso ao consultar bips no banco:', err);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_AUDIT_BIPS_KEY + cleanSessaoId);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  return [];
}

/**
 * Grava um bip no banco Supabase em tempo real (com chave composta loja/setor/data/hora)
 */
export async function insertAuditBipInDatabase(bip: DbAuditBip): Promise<{ success: boolean; error?: string }> {
  const cleanLojaId = sanitizeIdentifier(bip.loja_id, 64);
  const cleanSessaoId = sanitizeIdentifier(bip.sessao_id, 128);
  const cleanSetor = sanitizeText(bip.setor, 64);
  const cleanEan = sanitizeBarcode(bip.codigo_barras, 32);
  const cleanProdName = sanitizeText(bip.produto_nome, 200);
  const cleanOpName = sanitizeText(bip.operador_nome, 120);
  const cleanOpMatricula = sanitizeIdentifier(bip.operador_matricula, 64);

  const { dataAuditoria, horaAuditoria, chaveAuditoria } = buildAuditCompositeParts(
    cleanLojaId,
    cleanSetor,
    bip.timestamp || Date.now()
  );
  const enrichedBip: DbAuditBip = {
    ...bip,
    id: sanitizeIdentifier(bip.id, 160),
    sessao_id: cleanSessaoId,
    loja_id: cleanLojaId,
    produto_id: sanitizeIdentifier(bip.produto_id, 64),
    codigo_barras: cleanEan,
    produto_nome: cleanProdName,
    setor: cleanSetor,
    quantidade_fisica: bip.quantidade_fisica !== undefined && bip.quantidade_fisica !== null
      ? validatePositiveInt(bip.quantidade_fisica, 0)
      : null,
    operador_matricula: cleanOpMatricula,
    operador_nome: cleanOpName,
    data_auditoria: bip.data_auditoria || dataAuditoria,
    hora_auditoria: bip.hora_auditoria || horaAuditoria,
    chave_auditoria: bip.chave_auditoria || chaveAuditoria,
  };

  if (client && isSupabaseConfigured()) {
    try {
      await ensureStoreExists(enrichedBip.loja_id);
      const { error } = await client.from('auditoria_presenca_bips').upsert({
        id: enrichedBip.id,
        sessao_id: enrichedBip.sessao_id,
        loja_id: enrichedBip.loja_id,
        produto_id: enrichedBip.produto_id,
        codigo_barras: encryptSingleField(enrichedBip.codigo_barras),
        produto_nome: encryptSingleField(enrichedBip.produto_nome),
        setor: enrichedBip.setor,
        quantidade_fisica: enrichedBip.quantidade_fisica ?? null,
        operador_matricula: enrichedBip.operador_matricula,
        operador_nome: encryptSingleField(enrichedBip.operador_nome),
        data_auditoria: enrichedBip.data_auditoria,
        hora_auditoria: enrichedBip.hora_auditoria,
        chave_auditoria: enrichedBip.chave_auditoria,
        timestamp: enrichedBip.timestamp,
      });

      if (error) {
        console.warn('Aviso upsert bip auditoria:', error.message);
      }
    } catch (err) {
      console.warn('Erro ao inserir bip de auditoria no Supabase:', err);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const key = LOCAL_AUDIT_BIPS_KEY + enrichedBip.sessao_id;
      const raw = localStorage.getItem(key);
      const currentBips: DbAuditBip[] = raw ? JSON.parse(raw) : [];
      const updated = [enrichedBip, ...currentBips.filter(b => b.id !== enrichedBip.id)];
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  return { success: true };
}

/**
 * Finaliza a sessão no Supabase, transmite fechamento automático e arquiva o relatório na nuvem
 */
export async function finalizeAuditSessionInDatabase(data: {
  sessaoId: string;
  lojaId: string;
  setor: string;
  tipo?: AuditSessionTipo;
  iniciadaPorNome: string;
  iniciadaPorMatricula: string;
  finalizadaPorNome: string;
  finalizadaPorMatricula: string;
  totalEsperado: number;
  totalAuditado: number;
  totalDivergentes: number;
  iniciadaEm: number;
  finalizadaEm: number;
  participants?: string[];
  durationLabel?: string;
  cameraScansCount?: number;
  dataAuditoria?: string;
  horaAuditoria?: string;
  chaveAuditoria?: string;
  confirmedItems: Array<{
    name: string;
    ean: string;
    reducedCode?: string;
    supplierCode?: string;
    scannedAt: string;
    scannedBy?: string;
    physicalQuantity?: number;
    systemQuantity?: number;
  }>;
  pendingItems: Array<{
    name: string;
    ean: string;
    reducedCode?: string;
    supplierCode?: string;
    stock?: number;
    minStock?: number;
  }>;
  ruptureItems: Array<{ name: string; ean: string; stock: number; minStock: number }>;
}): Promise<{ success: boolean; error?: string }> {
  const composite = buildAuditCompositeParts(data.lojaId, data.setor, data.iniciadaEm || data.finalizadaEm);
  const dataAuditoria = data.dataAuditoria || composite.dataAuditoria;
  const horaAuditoria = data.horaAuditoria || composite.horaAuditoria;
  const chaveAuditoria = data.chaveAuditoria || composite.chaveAuditoria;
  const tipo: AuditSessionTipo = data.tipo || 'PRESENCA';

  if (client && isSupabaseConfigured()) {
    try {
      // 1. Marca status como 'CONCLUIDA' na tabela auditoria_presenca_sessoes
      await client
        .from('auditoria_presenca_sessoes')
        .update({ status: 'CONCLUIDA' })
        .eq('id', data.sessaoId)
        .eq('loja_id', data.lojaId);

      // 1.1 Notifica imediatamente via Broadcast todos os participantes conectados para fechamento automático
      if (activeAuditChannelRef && activeAuditChannelRef.lojaId === data.lojaId) {
        try {
          await activeAuditChannelRef.ready;
          await activeAuditChannelRef.channel.send({
            type: 'broadcast',
            event: 'session_closed',
            payload: {
              sessaoId: data.sessaoId,
              lojaId: data.lojaId,
              setor: data.setor,
              tipo,
              finalizadaPorNome: data.finalizadaPorNome,
            },
          });
        } catch {
          // fallback via postgres_changes UPDATE e polling
        }
      }

      // 2. Grava na tabela auditorias_finalizadas (fonte única de verdade — sem armazenamento local)
      await client.from('auditorias_finalizadas').upsert({
        id: sanitizeIdentifier(data.sessaoId, 128),
        loja_id: sanitizeIdentifier(data.lojaId, 64),
        setor: sanitizeText(data.setor, 64),
        tipo,
        iniciada_por_nome: encryptSingleField(sanitizeText(data.iniciadaPorNome, 120)),
        iniciada_por_matricula: sanitizeIdentifier(data.iniciadaPorMatricula, 64),
        finalizada_por_nome: encryptSingleField(sanitizeText(data.finalizadaPorNome, 120)),
        finalizada_por_matricula: sanitizeIdentifier(data.finalizadaPorMatricula, 64),
        total_esperado: validatePositiveInt(data.totalEsperado, 0),
        total_auditado: validatePositiveInt(data.totalAuditado, 0),
        total_divergentes: validatePositiveInt(data.totalDivergentes, 0),
        iniciada_em: data.iniciadaEm,
        finalizada_em: data.finalizadaEm,
        data_auditoria: dataAuditoria,
        hora_auditoria: horaAuditoria,
        chave_auditoria: chaveAuditoria,
        participantes: (data.participants || []).map(p => sanitizeText(p, 120)),
        duracao_label: data.durationLabel ? sanitizeText(data.durationLabel, 64) : null,
        camera_scans_count: validatePositiveInt(data.cameraScansCount ?? data.confirmedItems.length, 0),
        status: 'CONCLUIDA',
      });

      // 3. Grava itens individuais em auditoria_produtos com isolamento direto por loja_id + chave composta
      const cleanSessaoId = sanitizeIdentifier(data.sessaoId, 128);
      const cleanLojaId = sanitizeIdentifier(data.lojaId, 64);
      const cleanSetor = sanitizeText(data.setor, 64);
      const cleanFinNome = sanitizeText(data.finalizadaPorNome, 120);
      const cleanFinMat = sanitizeIdentifier(data.finalizadaPorMatricula, 64);

      const produtosPayload = [
        ...data.confirmedItems.map(c => {
          const cleanEan = sanitizeBarcode(c.ean, 32);
          const cleanName = sanitizeText(c.name, 200);
          const cleanPlu = c.reducedCode ? sanitizeIdentifier(c.reducedCode, 32) : '';
          const qtdSistema = validatePositiveInt(c.systemQuantity ?? 0, 0);
          const qtdFisica = tipo === 'INVENTARIO' ? validatePositiveInt(c.physicalQuantity ?? 0, 0) : null;
          const divergencia = tipo === 'INVENTARIO' && qtdFisica !== null ? qtdFisica - qtdSistema : null;
          return {
            id: `${chaveAuditoria}_${cleanEan}`,
            sessao_id: cleanSessaoId,
            loja_id: cleanLojaId,
            produto_id: cleanEan,
            codigo_barras: encryptSingleField(cleanEan),
            plu: cleanPlu ? encryptSingleField(cleanPlu) : null,
            nome: encryptSingleField(cleanName),
            setor: cleanSetor,
            quantidade_sistema: qtdSistema,
            quantidade_fisica: qtdFisica,
            divergencia,
            status_presenca: 'CONFIRMADO',
            operador_nome: encryptSingleField(sanitizeText(c.scannedBy || cleanFinNome, 120)),
            operador_matricula: cleanFinMat,
            data_auditoria: dataAuditoria,
            hora_auditoria: horaAuditoria,
            chave_auditoria: chaveAuditoria,
            auditado_em: data.finalizadaEm,
          };
        }),
        ...data.pendingItems.map(p => {
          const cleanEan = sanitizeBarcode(p.ean, 32);
          const cleanName = sanitizeText(p.name, 200);
          const cleanPlu = p.reducedCode ? sanitizeIdentifier(p.reducedCode, 32) : '';
          const qtdSistema = validatePositiveInt(p.stock ?? 0, 0);
          const qtdFisica = tipo === 'INVENTARIO' ? 0 : null;
          const divergencia = tipo === 'INVENTARIO' ? -qtdSistema : null;
          return {
            id: `${chaveAuditoria}_${cleanEan}`,
            sessao_id: cleanSessaoId,
            loja_id: cleanLojaId,
            produto_id: cleanEan,
            codigo_barras: encryptSingleField(cleanEan),
            plu: cleanPlu ? encryptSingleField(cleanPlu) : null,
            nome: encryptSingleField(cleanName),
            setor: cleanSetor,
            quantidade_sistema: qtdSistema,
            quantidade_fisica: qtdFisica,
            divergencia,
            status_presenca: 'AUSENTE',
            operador_nome: null,
            operador_matricula: null,
            data_auditoria: dataAuditoria,
            hora_auditoria: horaAuditoria,
            chave_auditoria: chaveAuditoria,
            auditado_em: data.finalizadaEm,
          };
        }),
      ];

      if (produtosPayload.length > 0) {
        await client.from('auditoria_produtos').upsert(produtosPayload);
      }
    } catch (err) {
      console.warn('Erro ao finalizar auditoria no Supabase:', err);
    }
  }

  // Remove caches temporários da sessão encerrada
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_ACTIVE_SESSIONS_KEY);
      if (raw) {
        const active: DbActiveAuditSession[] = JSON.parse(raw);
        localStorage.setItem(LOCAL_ACTIVE_SESSIONS_KEY, JSON.stringify(active.filter(s => s.id !== data.sessaoId)));
      }
      localStorage.removeItem(LOCAL_AUDIT_BIPS_KEY + data.sessaoId);
    } catch {
      // ignore
    }
  }

  return { success: true };
}

/**
 * Carrega relatórios de auditoria diretamente do Supabase (sem armazenamento local),
 * com isolamento por loja, ordenação cronológica e restrição de setor para não-gerentes.
 */
export async function fetchAuditReportsFromDatabase(
  lojaId: string,
  options: { isManager: boolean; userSector?: string }
): Promise<AuditItem[] | null> {
  const cleanLojaId = sanitizeIdentifier(lojaId, 64);
  if (!client || !isSupabaseConfigured() || !cleanLojaId) return null;

  try {
    let query = client
      .from('auditorias_finalizadas')
      .select('*')
      .eq('loja_id', cleanLojaId)
      .order('data_auditoria', { ascending: false })
      .order('hora_auditoria', { ascending: false })
      .order('finalizada_em', { ascending: false })
      .limit(100);

    const sectorFilter = sanitizeText(options.userSector || '', 64);
    if (
      !options.isManager &&
      sectorFilter &&
      sectorFilter.toUpperCase() !== 'TODOS' &&
      sectorFilter.toUpperCase() !== 'GERAL'
    ) {
      query = query.ilike('setor', sectorFilter);
    }

    const { data: rows, error } = await query;
    if (error || !rows) {
      console.warn('[Relatórios] Erro ao buscar auditorias finalizadas:', error?.message);
      return null;
    }

    if (rows.length === 0) return [];

    const sessionIds = rows.map(r => String(r.id));
    const { data: prodRows } = await client
      .from('auditoria_produtos')
      .select('*')
      .eq('loja_id', cleanLojaId)
      .in('sessao_id', sessionIds);

    const prodsBySession = new Map<string, Array<Record<string, unknown>>>();
    (prodRows || []).forEach((pr: Record<string, unknown>) => {
      const sid = String(pr.sessao_id);
      const arr = prodsBySession.get(sid) || [];
      arr.push(pr);
      prodsBySession.set(sid, arr);
    });

    return rows.map((row: Record<string, unknown>) => {
      const sid = String(row.id);
      const setor = sanitizeText(row.setor || 'GERAL', 64);
      const tipo = ((row.tipo as string) || 'PRESENCA') as 'PRESENCA' | 'INVENTARIO' | 'VALIDADE';
      const items = prodsBySession.get(sid) || [];

      const confirmedList = items
        .filter(it => String(it.status_presenca) === 'CONFIRMADO')
        .map(it => ({
          name: decryptSingleField(String(it.nome || '')),
          ean: sanitizeBarcode(decryptSingleField(String(it.codigo_barras || ''))),
          reducedCode: it.plu ? decryptSingleField(String(it.plu)) : undefined,
          scannedAt: it.auditado_em
            ? new Date(Number(it.auditado_em)).toLocaleTimeString('pt-BR')
            : String(row.hora_auditoria || ''),
          scannedBy: it.operador_nome ? decryptSingleField(String(it.operador_nome)) : undefined,
          scanMethod: 'camera' as const,
          physicalQuantity: it.quantidade_fisica !== null && it.quantidade_fisica !== undefined ? Number(it.quantidade_fisica) : undefined,
          systemQuantity: it.quantidade_sistema !== null && it.quantidade_sistema !== undefined ? Number(it.quantidade_sistema) : undefined,
          divergence: it.divergencia !== null && it.divergencia !== undefined ? Number(it.divergencia) : undefined,
        }));

      const pendingList = items
        .filter(it => String(it.status_presenca) !== 'CONFIRMADO')
        .map(it => ({
          name: decryptSingleField(String(it.nome || '')),
          ean: sanitizeBarcode(decryptSingleField(String(it.codigo_barras || ''))),
          reducedCode: it.plu ? decryptSingleField(String(it.plu)) : undefined,
          stock: it.quantidade_sistema !== null && it.quantidade_sistema !== undefined ? Number(it.quantidade_sistema) : undefined,
          systemQuantity: it.quantidade_sistema !== null && it.quantidade_sistema !== undefined ? Number(it.quantidade_sistema) : undefined,
          physicalQuantity: it.quantidade_fisica !== null && it.quantidade_fisica !== undefined ? Number(it.quantidade_fisica) : undefined,
          divergence: it.divergencia !== null && it.divergencia !== undefined ? Number(it.divergencia) : undefined,
        }));

      const totalEsperado = Number(row.total_esperado) || (confirmedList.length + pendingList.length);
      const totalAuditado = Number(row.total_auditado) || confirmedList.length;
      const totalDivergentes = Number(row.total_divergentes) || pendingList.length;
      const rate = totalEsperado > 0 ? `${Math.round((totalAuditado / totalEsperado) * 100)}%` : '0%';
      const startedMs = Number(row.iniciada_em) || Date.now();
      const finishedMs = Number(row.finalizada_em) || startedMs;
      const dataAuditoria = row.data_auditoria ? String(row.data_auditoria) : new Date(startedMs).toISOString().slice(0, 10);
      const horaAuditoria = row.hora_auditoria ? String(row.hora_auditoria) : new Date(startedMs).toTimeString().slice(0, 8);

      const titlePrefix = tipo === 'INVENTARIO' ? 'Inventário Cego' : 'Auditoria de Presença';
      const decFinalizadaPor = decryptSingleField(String(row.finalizada_por_nome || 'Operador'));
      const decIniciadaPor = decryptSingleField(String(row.iniciada_por_nome || ''));

      return {
        id: sid,
        lojaId: String(row.loja_id),
        title: `${titlePrefix} - ${setor}`,
        date: `${dataAuditoria} ${horaAuditoria}`,
        dataAuditoria,
        horaAuditoria,
        chaveAuditoria: row.chave_auditoria ? String(row.chave_auditoria) : sid,
        itemsCount: totalAuditado,
        status: 'Concluída',
        auditor: row.finalizada_por_matricula
          ? `${decFinalizadaPor} (${row.finalizada_por_matricula})`
          : decFinalizadaPor,
        department: setor,
        type: tipo,
        totalItems: totalEsperado,
        confirmedItems: totalAuditado,
        pendingItems: totalDivergentes,
        presenceRate: rate,
        startedBy: row.iniciada_por_matricula
          ? `${decIniciadaPor} (${row.iniciada_por_matricula})`
          : decIniciadaPor,
        participants: Array.isArray(row.participantes) ? (row.participantes as string[]) : [],
        startedAtMs: startedMs,
        finishedAtMs: finishedMs,
        durationLabel: row.duracao_label ? String(row.duracao_label) : undefined,
        cameraScansCount: Number(row.camera_scans_count) || confirmedList.length,
        manualScansCount: 0,
        confirmedList,
        pendingList,
      } satisfies AuditItem;
    });
  } catch (err) {
    console.warn('[Relatórios] Falha ao carregar relatórios da nuvem:', err);
    return null;
  }
}

/**
 * Atualiza item bipado pós-auditoria no relatório (somente via câmera) diretamente no banco
 */
export async function confirmMissingAuditProductInDatabase(data: {
  sessaoId: string;
  lojaId: string;
  ean: string;
  operadorNome: string;
  operadorMatricula: string;
  newConfirmedCount: number;
  newPendingCount: number;
  newCameraScansCount: number;
}): Promise<void> {
  const cleanLojaId = sanitizeIdentifier(data.lojaId, 64);
  const cleanSessaoId = sanitizeIdentifier(data.sessaoId, 128);
  const cleanEan = sanitizeBarcode(data.ean, 32);
  if (!client || !isSupabaseConfigured() || !cleanLojaId || !cleanSessaoId || !cleanEan) return;
  try {
    await client
      .from('auditoria_produtos')
      .update({
        status_presenca: 'CONFIRMADO',
        operador_nome: encryptSingleField(sanitizeText(data.operadorNome, 120)),
        operador_matricula: sanitizeIdentifier(data.operadorMatricula, 64),
        auditado_em: Date.now(),
      })
      .eq('sessao_id', cleanSessaoId)
      .eq('loja_id', cleanLojaId)
      .eq('produto_id', cleanEan);

    await client
      .from('auditorias_finalizadas')
      .update({
        total_auditado: validatePositiveInt(data.newConfirmedCount, 0),
        total_divergentes: validatePositiveInt(data.newPendingCount, 0),
        camera_scans_count: validatePositiveInt(data.newCameraScansCount, 0),
      })
      .eq('id', cleanSessaoId)
      .eq('loja_id', cleanLojaId);
  } catch (err) {
    console.warn('[Relatórios] Erro ao atualizar bip pós-auditoria:', err);
  }
}

let activeAuditChannelRef: { lojaId: string; channel: ReturnType<NonNullable<typeof client>['channel']>; ready: Promise<void> } | null = null;

/**
 * Notifica via Broadcast que um operador entrou em uma sessão de auditoria ativa
 */
export async function notifySessionJoinRealtime(data: {
  lojaId: string;
  sessaoId: string;
  nome: string;
  matricula: string;
}): Promise<boolean> {
  if (!client || !isSupabaseConfigured()) return false;
  try {
    if (activeAuditChannelRef && activeAuditChannelRef.lojaId === data.lojaId) {
      await activeAuditChannelRef.ready;
      const res = await activeAuditChannelRef.channel.send({
        type: 'broadcast',
        event: 'session_user_joined',
        payload: data,
      });
      return res === 'ok';
    }
    return false;
  } catch (err) {
    console.warn('Aviso ao notificar entrada na sessão:', err);
    return false;
  }
}

/**
 * Assina as alterações em tempo real de auditoria (isolada por loja_id)
 */
export function subscribeToAuditRealtime(
  lojaId: string,
  onEvent: () => void,
  onNewBip?: (bip: DbAuditBip) => void,
  operatorPresence?: { matricula: string; nome: string },
  onUserOffline?: (userName: string) => void,
  onUserJoinedSession?: (userName: string, sessaoId: string, matricula?: string) => void,
  onSessionClosed?: (sessaoId: string, closedByName?: string, tipo?: string) => void
): () => void {
  const cleanLojaId = sanitizeIdentifier(lojaId, 64);
  if (!client || !isSupabaseConfigured() || !cleanLojaId) return () => {};

  try {
    const channelName = `realtime_auditoria_${cleanLojaId}`;
    const channel = client.channel(channelName, {
      config: {
        broadcast: { self: false },
        ...(operatorPresence ? { presence: { key: sanitizeIdentifier(operatorPresence.matricula, 64) } } : {}),
      },
    });

    let resolveReady: () => void = () => {};
    const ready = new Promise<void>((res) => {
      resolveReady = res;
    });
    activeAuditChannelRef = { lojaId: cleanLojaId, channel, ready };

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auditoria_presenca_sessoes', filter: `loja_id=eq.${cleanLojaId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown> | undefined;
          if (payload.eventType === 'UPDATE' && row && row.status === 'CONCLUIDA' && onSessionClosed) {
            onSessionClosed(
              String(row.id || ''),
              row.iniciada_por_nome ? decryptSingleField(String(row.iniciada_por_nome)) : undefined,
              row.tipo ? String(row.tipo) : undefined
            );
          }
          onEvent();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auditoria_presenca_bips', filter: `loja_id=eq.${cleanLojaId}` },
        (payload) => {
          if (payload.new && onNewBip) {
            const rawBip = payload.new as DbAuditBip;
            onNewBip({
              ...rawBip,
              codigo_barras: sanitizeBarcode(decryptSingleField(rawBip.codigo_barras)),
              produto_nome: decryptSingleField(rawBip.produto_nome),
              operador_nome: decryptSingleField(rawBip.operador_nome),
            });
          }
          onEvent();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'auditoria_presenca_bips', filter: `loja_id=eq.${cleanLojaId}` },
        () => {
          onEvent();
        }
      )
      .on('broadcast', { event: 'session_user_joined' }, ({ payload }) => {
        if (payload && onUserJoinedSession) {
          const p = payload as { nome?: string; sessaoId?: string; matricula?: string };
          if (p.nome && p.sessaoId) {
            onUserJoinedSession(p.nome, p.sessaoId, p.matricula);
          }
        }
      })
      .on('broadcast', { event: 'session_closed' }, ({ payload }) => {
        if (payload && onSessionClosed) {
          const p = payload as { sessaoId?: string; finalizadaPorNome?: string; tipo?: string };
          if (p.sessaoId) {
            onSessionClosed(p.sessaoId, p.finalizadaPorNome, p.tipo);
          }
        }
      });

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
      if (status === 'SUBSCRIBED') {
        resolveReady();
        if (operatorPresence) {
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
      }
    });

    return () => {
      if (activeAuditChannelRef?.channel === channel) {
        activeAuditChannelRef = null;
      }
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

export function clearObsoleteChatCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_CHAT_KEY);
  } catch {
    // ignore
  }
}

export function getStoredChatMessages(lojaId?: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  if (isSupabaseConfigured()) {
    clearObsoleteChatCache();
    return [];
  }
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
  if (typeof window === 'undefined' || isSupabaseConfigured()) return;
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
 * Consulta mensagens de chat diretamente no banco de dados (fonte única de verdade).
 * Retorna `null` somente em caso de falha de rede/consulta; quando retorna `[]`,
 * significa que o banco está vazio e a interface deve refletir isso imediatamente.
 */
export async function fetchChatMessagesFromSupabase(lojaId: string): Promise<ChatMessage[] | null> {
  const cleanLojaId = sanitizeIdentifier(lojaId, 64);
  if (!client || !isSupabaseConfigured()) {
    return getStoredChatMessages(cleanLojaId);
  }

  // Elimina qualquer cache local obsoleto para evitar ressuscitar mensagens excluídas
  clearObsoleteChatCache();

  try {
    const { data, error } = await client
      .from('chat_mensagens')
      .select('*')
      .eq('loja_id', cleanLojaId)
      .order('timestamp', { ascending: true })
      .limit(200);

    if (error) {
      console.warn('[Chat] Erro na consulta do Supabase:', error.message);
      return null;
    }

    const mapped: ChatMessage[] = (data || []).map(row => mapChatRow(row as Record<string, unknown>));
    return mapped;
  } catch (err) {
    console.warn('[Chat] Erro ao carregar mensagens:', err);
    return null;
  }
}

/**
 * Nome ESTÁVEL do canal Realtime do chat da loja.
 */
export const getChatChannelName = (lojaId: string): string => `realtime_chat_${sanitizeIdentifier(lojaId, 64)}`;

/**
 * Converte uma linha da tabela `chat_mensagens` no modelo da aplicação (descriptografando em RAM).
 */
function mapChatRow(row: Record<string, unknown>): ChatMessage {
  return {
    id: sanitizeIdentifier(row.id, 80),
    loja_id: sanitizeIdentifier(row.loja_id, 64),
    canal_tipo: validateEnum(row.canal_tipo, ['grupo', 'direto_lider'] as const, 'grupo'),
    destinatario_id: row.destinatario_id ? sanitizeIdentifier(row.destinatario_id, 64) : undefined,
    destinatario_nome: row.destinatario_nome ? decryptSingleField(String(row.destinatario_nome)) : undefined,
    remetente_matricula: sanitizeIdentifier(row.remetente_matricula, 64),
    remetente_nome: decryptSingleField(String(row.remetente_nome || '')),
    remetente_cargo: row.remetente_cargo ? sanitizeText(row.remetente_cargo, 80) : undefined,
    is_anonimo: Boolean(row.is_anonimo),
    conteudo: decryptSingleField(String(row.conteudo || '')),
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
  deleteListeners: Set<(deletedId: string) => void>;
  ready: Promise<void>;
}

const chatChannelRegistry = new Map<string, ChatChannelEntry>();

function getOrCreateChatChannel(lojaId: string): ChatChannelEntry {
  const cleanLojaId = sanitizeIdentifier(lojaId, 64);
  const name = getChatChannelName(cleanLojaId);
  const existing = chatChannelRegistry.get(name);
  if (existing) return existing;

  const channel = client!.channel(name, {
    config: { broadcast: { self: false } },
  });
  const listeners = new Set<(msg: ChatMessage) => void>();
  const deleteListeners = new Set<(deletedId: string) => void>();

  // Canal 1: BROADCAST — entrega instantânea e NÃO depende da tabela estar
  // publicada em `supabase_realtime`. É o caminho que garante latência baixa.
  channel.on('broadcast', { event: 'new_message' }, (payload: { payload?: unknown }) => {
    if (!payload?.payload) return;
    try {
      const msg = mapChatRow(payload.payload as Record<string, unknown>);
      if (!msg?.id) return;
      saveStoredChatMessage(msg);
      listeners.forEach((listener) => listener(msg));
    } catch (err) {
      console.warn('[Chat] Erro ao processar broadcast recebido:', err);
    }
  });

  channel.on('broadcast', { event: 'delete_message' }, (payload: { payload?: unknown }) => {
    const data = payload?.payload as { id?: string } | undefined;
    if (!data?.id) return;
    deleteListeners.forEach((listener) => listener(String(data.id)));
  });

  // Canal 2: POSTGRES CHANGES — entrega INSERT, UPDATE e DELETE via tabela
  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_mensagens',
      filter: `loja_id=eq.${cleanLojaId}`,
    },
    (payload) => {
      if (!payload.new) return;
      const msg = mapChatRow(payload.new as Record<string, unknown>);
      saveStoredChatMessage(msg);
      listeners.forEach((listener) => listener(msg));
    }
  );

  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'chat_mensagens',
      filter: `loja_id=eq.${cleanLojaId}`,
    },
    (payload) => {
      if (!payload.new) return;
      const msg = mapChatRow(payload.new as Record<string, unknown>);
      listeners.forEach((listener) => listener(msg));
    }
  );

  channel.on(
    'postgres_changes',
    {
      event: 'DELETE',
      schema: 'public',
      table: 'chat_mensagens',
      filter: `loja_id=eq.${cleanLojaId}`,
    },
    (payload) => {
      const oldRow = payload.old as Record<string, unknown> | undefined;
      const deletedId = oldRow?.id ? String(oldRow.id) : '';
      if (!deletedId) return;
      deleteListeners.forEach((listener) => listener(deletedId));
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

  const entry: ChatChannelEntry = { channel, listeners, deleteListeners, ready };
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
  const cleanLojaId = sanitizeIdentifier(msg.loja_id, 64);
  const cleanConteudo = sanitizeText(msg.conteudo, 1000);
  if (!cleanConteudo) {
    return { success: false, error: 'Mensagem vazia ou inválida.' };
  }

  const newMsg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    loja_id: cleanLojaId,
    canal_tipo: validateEnum(msg.canal_tipo, ['grupo', 'direto_lider'] as const, 'grupo'),
    destinatario_id: msg.destinatario_id ? sanitizeIdentifier(msg.destinatario_id, 64) : undefined,
    destinatario_nome: msg.destinatario_nome ? sanitizeText(msg.destinatario_nome, 120) : undefined,
    remetente_matricula: sanitizeIdentifier(msg.remetente_matricula, 64),
    remetente_nome: sanitizeText(msg.remetente_nome, 120),
    remetente_cargo: msg.remetente_cargo ? sanitizeText(msg.remetente_cargo, 80) : undefined,
    is_anonimo: Boolean(msg.is_anonimo),
    conteudo: cleanConteudo,
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

    const encryptedPayload: ChatMessage = {
      ...newMsg,
      destinatario_nome: newMsg.destinatario_nome ? encryptSingleField(newMsg.destinatario_nome) : undefined,
      remetente_nome: encryptSingleField(newMsg.remetente_nome),
      conteudo: encryptSingleField(newMsg.conteudo),
    };

    const { error } = await client.from('chat_mensagens').insert({
      id: encryptedPayload.id,
      loja_id: encryptedPayload.loja_id,
      canal_tipo: encryptedPayload.canal_tipo,
      destinatario_id: encryptedPayload.destinatario_id || null,
      destinatario_nome: encryptedPayload.destinatario_nome || null,
      remetente_matricula: encryptedPayload.remetente_matricula,
      remetente_nome: encryptedPayload.remetente_nome,
      remetente_cargo: encryptedPayload.remetente_cargo || null,
      is_anonimo: encryptedPayload.is_anonimo,
      conteudo: encryptedPayload.conteudo,
      timestamp: encryptedPayload.timestamp,
    });

    if (error) {
      console.warn('[Chat] insert falhou:', error.message);
      return { success: false, error: error.message };
    }

    // Broadcast instantâneo criptografado para os demais dispositivos da loja.
    await broadcastChatMessage(encryptedPayload);

    return { success: true, data: newMsg };
  } catch (err: unknown) {
    const msgErr = err instanceof Error ? err.message : String(err);
    console.error('[Chat] Erro no envio:', msgErr);
    return { success: false, error: msgErr };
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
  onNewMessage: (msg: ChatMessage) => void,
  onDeleteMessage?: (deletedId: string) => void
): () => void {
  if (!client || !isSupabaseConfigured()) return () => {};
  const supabaseClient = client;

  try {
    const entry = getOrCreateChatChannel(lojaId);
    entry.listeners.add(onNewMessage);
    if (onDeleteMessage) {
      entry.deleteListeners.add(onDeleteMessage);
    }

    return () => {
      entry.listeners.delete(onNewMessage);
      if (onDeleteMessage) {
        entry.deleteListeners.delete(onDeleteMessage);
      }
      if (entry.listeners.size === 0 && entry.deleteListeners.size === 0) {
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
  const cleanBarcode = sanitizeBarcode(avariaData.codigo_barras, 32);
  const cleanProdName = sanitizeText(avariaData.produto_nome, 200);
  const cleanQty = validatePositiveInt(avariaData.quantidade, 1);

  if (!cleanBarcode || !cleanProdName || cleanQty <= 0) {
    return { success: false, synced: false, error: 'Dados da avaria inválidos.' };
  }

  const avaria: AvariaItem = {
    id: `av_${nowMs}_${Math.random().toString(36).substring(2, 7)}`,
    loja_id: sanitizeIdentifier(avariaData.loja_id, 64),
    codigo_barras: cleanBarcode,
    codigo_reduzido: avariaData.codigo_reduzido ? sanitizeIdentifier(avariaData.codigo_reduzido, 32) : undefined,
    produto_nome: cleanProdName,
    quantidade: cleanQty,
    tipo_avaria: validateEnum(avariaData.tipo_avaria, TIPOS_AVARIA, 'Outro'),
    para_troca: Boolean(avariaData.para_troca),
    setor: avariaData.setor ? sanitizeText(avariaData.setor, 64) : undefined,
    registrado_por_nome: sanitizeText(avariaData.registrado_por_nome || 'Operador', 120),
    registrado_por_matricula: sanitizeIdentifier(avariaData.registrado_por_matricula, 64),
    registrado_em: new Date(nowMs).toLocaleString('pt-BR'),
    timestamp: nowMs,
  };

  // 1. Persistência local garantida (mesmo offline)
  saveStoredAvaria(avaria);

  // 2. Sincronização com a nuvem (criptografado)
  if (!client || !isSupabaseConfigured()) {
    return { success: true, data: avaria, synced: false };
  }

  try {
    const { error } = await client.from('avarias_estoque').upsert(
      {
        id: avaria.id,
        loja_id: avaria.loja_id,
        codigo_barras: encryptSingleField(avaria.codigo_barras),
        codigo_reduzido: avaria.codigo_reduzido ? encryptSingleField(avaria.codigo_reduzido) : null,
        produto_nome: encryptSingleField(avaria.produto_nome),
        quantidade: avaria.quantidade,
        tipo_avaria: avaria.tipo_avaria,
        para_troca: avaria.para_troca,
        setor: avaria.setor || null,
        registrado_por_nome: encryptSingleField(avaria.registrado_por_nome),
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
  const cleanLojaId = sanitizeIdentifier(lojaId, 64);
  const localList = getStoredAvarias(cleanLojaId);

  if (!client || !isSupabaseConfigured() || !cleanLojaId) return localList;

  try {
    const { data, error } = await client
      .from('avarias_estoque')
      .select('*')
      .eq('loja_id', cleanLojaId)
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
      id: sanitizeIdentifier(row.id, 80),
      loja_id: sanitizeIdentifier(row.loja_id, 64),
      codigo_barras: sanitizeBarcode(decryptSingleField(String(row.codigo_barras || ''))),
      codigo_reduzido: row.codigo_reduzido ? decryptSingleField(String(row.codigo_reduzido)) : undefined,
      produto_nome: decryptSingleField(String(row.produto_nome || '')),
      quantidade: validatePositiveInt(row.quantidade, 0),
      tipo_avaria: validateEnum(row.tipo_avaria, TIPOS_AVARIA, 'Outro'),
      para_troca: Boolean(row.para_troca),
      setor: row.setor ? sanitizeText(row.setor, 64) : undefined,
      registrado_por_nome: decryptSingleField(String(row.registrado_por_nome || '')),
      registrado_por_matricula: sanitizeIdentifier(row.registrado_por_matricula, 64),
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
  const cleanLojaId = sanitizeIdentifier(lojaId, 64);
  if (!client || !isSupabaseConfigured() || !cleanLojaId) return () => {};
  const supabaseClient = client;

  try {
    const channel = supabaseClient.channel(`realtime_avarias_${cleanLojaId}`, {
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
        filter: `loja_id=eq.${cleanLojaId}`,
      },
      (payload) => {
        const row = (payload.new || payload.old) as Record<string, unknown> | undefined;
        if (!row || !row.id) return;
        emit({
          id: sanitizeIdentifier(row.id, 80),
          loja_id: sanitizeIdentifier(row.loja_id || cleanLojaId, 64),
          codigo_barras: sanitizeBarcode(decryptSingleField(String(row.codigo_barras || ''))),
          codigo_reduzido: row.codigo_reduzido ? decryptSingleField(String(row.codigo_reduzido)) : undefined,
          produto_nome: decryptSingleField(String(row.produto_nome || '')),
          quantidade: validatePositiveInt(row.quantidade, 0),
          tipo_avaria: validateEnum(row.tipo_avaria, TIPOS_AVARIA, 'Outro'),
          para_troca: Boolean(row.para_troca),
          setor: row.setor ? sanitizeText(row.setor, 64) : undefined,
          registrado_por_nome: decryptSingleField(String(row.registrado_por_nome || '')),
          registrado_por_matricula: sanitizeIdentifier(row.registrado_por_matricula, 64),
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
  const cleanId = sanitizeIdentifier(productId, 64);
  if (!client || !isSupabaseConfigured() || !cleanId) return { success: true };

  try {
    await client
      .from('produtos')
      .update({
        is_locked_for_edit: true,
        locked_by: encryptSingleField(sanitizeText(lockedBy, 120)),
        locked_at: new Date().toISOString(),
      })
      .eq('id', cleanId);
    return { success: true };
  } catch (err) {
    console.warn('[ProductLock] Erro ao bloquear produto:', err);
    return { success: true };
  }
}

export async function unlockProductInSupabase(productId: string): Promise<{ success: boolean }> {
  const cleanId = sanitizeIdentifier(productId, 64);
  if (!client || !isSupabaseConfigured() || !cleanId) return { success: true };

  try {
    await client
      .from('produtos')
      .update({
        is_locked_for_edit: false,
        locked_by: null,
        locked_at: null,
      })
      .eq('id', cleanId);
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
  const cleanId = sanitizeIdentifier(productId, 64);
  if (!cleanId) return { success: false, error: 'ID de produto inválido.' };
  if (!client || !isSupabaseConfigured()) return { success: true };

  try {
    const payload: Record<string, unknown> = {
      is_locked_for_edit: false,
      locked_by: null,
      locked_at: null,
      is_encrypted: true,
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) {
      const cleanName = sanitizeText(updates.name, 200);
      if (!cleanName) return { success: false, error: 'Nome do produto inválido.' };
      payload.nome = encryptSingleField(cleanName);
    }
    if (updates.ean !== undefined) {
      const cleanEan = sanitizeBarcode(updates.ean, 32);
      if (!cleanEan) return { success: false, error: 'Código de barras inválido.' };
      payload.codigo_barras = encryptSingleField(cleanEan);
    }
    if (updates.secondaryEan !== undefined) {
      const cleanSec = sanitizeBarcode(updates.secondaryEan, 32);
      payload.codigo_barras_secundario = cleanSec ? encryptSingleField(cleanSec) : null;
    }
    if (updates.stock !== undefined) payload.quantidade = validatePositiveInt(updates.stock, 0);
    if (updates.category !== undefined) payload.setor = sanitizeText(updates.category, 64);
    if (updates.reducedCode !== undefined) {
      const cleanPlu = sanitizeIdentifier(updates.reducedCode, 32);
      payload.plu = cleanPlu ? encryptSingleField(cleanPlu) : null;
    }
    if (updates.supplierCode !== undefined) {
      const cleanForn = sanitizeIdentifier(updates.supplierCode, 32);
      payload.codigo_fornecedor = cleanForn ? encryptSingleField(cleanForn) : null;
    }

    const { error } = await client
      .from('produtos')
      .update(payload)
      .eq('id', cleanId);

    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[UpdateProduct] Erro:', msg);
    return { success: false, error: msg };
  }
}


