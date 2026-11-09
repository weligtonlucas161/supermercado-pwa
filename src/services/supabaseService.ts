import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, ValidityItem, AuditItem, SpreadsheetProductItem, LoginResult, AuthUser, OfflineAction } from '../types';

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

/**
 * Autenticação Segura por Matrícula e Senha (Script 03)
 */
export async function loginUser(matricula: string, senha: string): Promise<LoginResult> {
  const cleanMatricula = matricula.trim();
  const cleanSenha = senha.trim();

  // Se o Supabase estiver configurado, tenta autenticar via RPC no banco
  if (client) {
    try {
      const { data, error } = await client.rpc('rpc_login_usuario', {
        p_matricula: cleanMatricula,
        p_senha: cleanSenha,
      });

      if (!error && data) {
        if (data.success && data.user) {
          return {
            success: true,
            token: data.token,
            user: {
              id: data.user.id,
              matricula: data.user.matricula,
              nome: data.user.nome,
              cargo: data.user.cargo,
              setor: data.user.setor,
              loja_id: data.user.loja_id || 'loja_padrao_001',
              loja_nome: data.user.loja_nome || 'Supermercado Silva - Loja 01',
            },
          };
        } else {
          return {
            success: false,
            message: data.message || 'Credenciais inválidas.',
          };
        }
      }

      // Se a RPC não estiver disponível, consulta diretamente a tabela 'usuarios'
      const { data: userData, error: userError } = await client
        .from('usuarios')
        .select('*')
        .eq('matricula', cleanMatricula)
        .eq('ativo', true)
        .single();

      if (!userError && userData) {
        if (userData.senha === cleanSenha) {
          return {
            success: true,
            token: 'tok_' + Math.random().toString(36).substring(2),
            user: {
              id: userData.id,
              matricula: userData.matricula,
              nome: userData.nome,
              cargo: userData.cargo || 'operador',
              setor: userData.setor || 'Prevenção e Estoque',
              loja_id: userData.loja_id || 'loja_padrao_001',
              loja_nome: 'Supermercado Silva - Loja 01',
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

  // Contingência Local / Offline (Script 03)
  if (cleanMatricula === '4092' && cleanSenha === '123456') {
    return {
      success: true,
      token: 'tok_local_operador_4092',
      user: {
        id: 'usr_op_carlos_4092',
        matricula: '4092',
        nome: 'Carlos Silva',
        cargo: 'operador',
        setor: 'Prevenção e Estoque',
        loja_id: 'loja_padrao_001',
        loja_nome: 'Supermercado Silva - Loja 01 (Matriz)',
      },
    };
  }

  if (cleanMatricula === '111111' && cleanSenha === 'admin123') {
    return {
      success: true,
      token: 'tok_local_adm_111111',
      user: {
        id: 'usr_adm_global_001',
        matricula: '111111',
        nome: 'Administrador do Sistema (SaaS)',
        cargo: 'adm',
        setor: 'Todos os Setores',
        loja_id: 'loja_padrao_001',
        loja_nome: 'Supermercado Silva - Loja 01 (Matriz)',
      },
    };
  }

  return {
    success: false,
    message: 'Matrícula ou senha incorreta. Verifique os dados digitados.',
  };
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
  if (!client) return;
  try {
    const { data, error } = await client
      .from('lojas')
      .select('id')
      .eq('id', lojaId)
      .maybeSingle();

    if (!data && !error) {
      await client.from('lojas').insert({
        id: lojaId,
        nome_loja: 'Supermercado Silva - Loja 01 (Matriz)',
        cor_primaria: '#059669',
        ativa: true,
        cnpj: '12.345.678/0001-90',
        endereco: 'Av. Principal, 1000 - Centro',
        telefone: '(11) 3456-7890',
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
  const lojaId = options?.lojaId || 'loja_padrao_001';
  const matricula = options?.operatorMatricula || '4092';
  const nomeOperador = options?.operatorNome || 'Carlos Silva';

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
 */
export async function fetchProductsFromSupabase(lojaId = 'loja_padrao_001'): Promise<Product[]> {
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('produtos')
      .select('*')
      .eq('loja_id', lojaId)
      .order('criado_em', { ascending: false });

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: String(row.id || ''),
      ean: String(row.codigo_barras || ''),
      name: String(row.nome || ''),
      supplierCode: String(row.codigo_fornecedor || ''),
      reducedCode: String(row.plu || ''),
      category: String(row.setor || 'MERCEARIA'),
      stock: Number(row.quantidade) || 0,
      minStock: 10,
      price: 0,
      location: `Gôndola - ${row.setor || 'Estoque'}`,
      loja_id: String(row.loja_id || lojaId),
      data_vencimento: String(row.data_vencimento || ''),
      isEncryptedInStorage: Boolean(row.is_encrypted),
      encryptedPayload: row.ciphertext
        ? {
            ciphertext: String(row.ciphertext),
            iv: String(row.iv || ''),
          }
        : undefined,
    }));
  } catch (err) {
    console.warn('Erro ao consultar produtos no Supabase:', err);
    return [];
  }
}

/**
 * Sincroniza a fila de ações offline com o Supabase quando restabelecida a internet
 */
export async function syncOfflineQueueToSupabase(
  actions: OfflineAction[],
  lojaId = 'loja_padrao_001'
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
