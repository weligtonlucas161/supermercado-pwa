/**
 * @license
 * Arquivo: src/services/db/client.ts
 *
 * Camada única de conexão com o banco de dados (Supabase/PostgREST).
 *
 * Princípios de segurança:
 * - NENHUMA credencial é embarcada no bundle do front-end. URL e anon key vêm
 *   exclusivamente de variáveis de ambiente (VITE_*) ou da configuração
 *   explícita do usuário (localStorage), definida na tela de Configurações.
 * - A URL do projeto é validada antes de qualquer uso (https obrigatório em
 *   produção, http aceito apenas em loopback para desenvolvimento).
 * - Toda requisição passa por um fetch com timeout, retry e backoff exponencial
 *   com jitter, evitando que uma indisponibilidade momentary trave a UI.
 * - Existe uma única instância do cliente (singleton), compartilhada por todas
 *   as abas/telas, o que mantém o pool de conexões do Realtime único.
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export const SUPABASE_STORAGE_KEYS = {
  URL: 'superpwa_supabase_url',
  KEY: 'superpwa_supabase_anon_key',
} as const;

export type DbConfigSource = 'custom' | 'env' | 'none';

export interface DbConfig {
  url: string;
  key: string;
  isConfigured: boolean;
  source: DbConfigSource;
}

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 300;

/** Hosts locais permitidos para desenvolvimento (http). */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];

function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.includes(hostname.toLowerCase());
}

/**
 * Valida a URL do projeto: exige https:// exceto em loopback.
 * Retorna a URL normalizada (sem barra final) ou null.
 */
export function validateDbUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:') {
      return parsed.origin + parsed.pathname.replace(/\/+$/, '');
    }
    if (parsed.protocol === 'http:' && isLocalHost(parsed.hostname)) {
      return parsed.origin + parsed.pathname.replace(/\/+$/, '');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Valida a anon/publishable key. Chaves Supabase legadas começam com
 * 'eyJ' (JWT) e as publishables com 'sb_publishable_'. Não usamos regex
 * rígida para não quebrar formatos futuros, apenas exigimos tamanho mínimo.
 */
export function validateDbKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  if (key.length < 20) return null;
  if (/\s/.test(key)) return null;
  return key;
}

/**
 * Resolve a configuração efetiva do banco.
 * Prioridade: configuração do usuário (localStorage) > ambiente (VITE_*) > não configurado.
 */
export function resolveDbConfig(): DbConfig {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(SUPABASE_STORAGE_KEYS.URL) || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(SUPABASE_STORAGE_KEYS.KEY) || '' : '';

  const url = validateDbUrl(localUrl) || validateDbUrl(envUrl) || '';
  const key = validateDbKey(localKey) || validateDbKey(envKey) || '';

  const source: DbConfigSource =
    validateDbUrl(localUrl) && validateDbKey(localKey)
      ? 'custom'
      : validateDbUrl(envUrl) && validateDbKey(envKey)
        ? 'env'
        : 'none';

  return {
    url,
    key,
    isConfigured: Boolean(url && key),
    source,
  };
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Fetch global com timeout, retry e backoff exponencial com jitter.
 * Usado pelo cliente Supabase para todas as chamadas REST/Realtime.
 */
async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // Preserva um abort externo (ex.: cancelamento do componente).
    const externalSignal = init?.signal;
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);

      // Erros de servidor transitórios (429/5xx) são retentáveis.
      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`HTTP ${response.status}`);
        if (attempt === MAX_RETRIES) return response;
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 150);
        continue;
      }
      return response;
    } catch (err) {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
      lastError = err;

      // Abort externo é definitivo: propaga imediatamente.
      if (externalSignal?.aborted) throw err;
      if (attempt === MAX_RETRIES) throw err;

      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 150);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha na requisição ao banco de dados.');
}

function buildClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
    global: {
      fetch: resilientFetch as typeof fetch,
      headers: { 'x-client-info': 'superpwa-opsys/1.0' },
    },
    realtime: {
      params: { eventsPerSecond: 20 },
    },
  });
}

let activeConfig: DbConfig = resolveDbConfig();
let client: SupabaseClient | null = null;
let realtimeChannels = new Set<RealtimeChannel>();

function ensureClient(): SupabaseClient | null {
  if (client) return client;
  if (!activeConfig.isConfigured) return null;
  try {
    client = buildClient(activeConfig.url, activeConfig.key);
  } catch (err) {
    console.warn('[db] Erro ao inicializar o cliente do banco de dados:', err);
    client = null;
  }
  return client;
}

/** Cliente ativo (singleton) ou null quando não configurado. */
export function getDbClient(): SupabaseClient | null {
  return ensureClient();
}

/** Configuração efetiva do banco. */
export function getDbConfig(): DbConfig {
  return activeConfig;
}

export function isDbConfigured(): boolean {
  return !!ensureClient() && activeConfig.isConfigured;
}

/**
 * Aplica uma configuração customizada definida pelo usuário (tela de Configurações).
 * A URL é validada antes de ser persistida e de instanciar o cliente.
 */
export function setCustomDbConfig(url: string, key: string): { success: boolean; message: string } {
  const safeUrl = validateDbUrl(url);
  const cleanKey = validateDbKey(key);

  if (!safeUrl) {
    return {
      success: false,
      message: 'A URL do banco deve ser https:// válida (http:// apenas em localhost).',
    };
  }
  if (!cleanKey) {
    return { success: false, message: 'A chave anônima (anon key) do banco é inválida.' };
  }

  try {
    const testClient = buildClient(safeUrl, cleanKey);
    client = testClient;
    activeConfig = { url: safeUrl, key: cleanKey, isConfigured: true, source: 'custom' };

    if (typeof window !== 'undefined') {
      localStorage.setItem(SUPABASE_STORAGE_KEYS.URL, safeUrl);
      localStorage.setItem(SUPABASE_STORAGE_KEYS.KEY, cleanKey);
    }
    return { success: true, message: 'Configuração do banco salva com sucesso!' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Falha ao instanciar o cliente do banco: ${msg}` };
  }
}

/** Remove a configuração customizada e volta à configuração do ambiente. */
export function clearCustomDbConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SUPABASE_STORAGE_KEYS.URL);
    localStorage.removeItem(SUPABASE_STORAGE_KEYS.KEY);
  }
  disposeRealtimeChannels();
  client = null;
  activeConfig = resolveDbConfig();
  ensureClient();
}

/**
 * Cria/registra um canal Realtime. Todos os canais ficam centralizados para
 * que a troca de configuração ou o logout não deixem conexões órfãs.
 */
export function registerRealtimeChannel(channel: RealtimeChannel): RealtimeChannel {
  realtimeChannels.add(channel);
  return channel;
}

export function disposeRealtimeChannel(channel: RealtimeChannel | null | undefined): void {
  if (!channel) return;
  realtimeChannels.delete(channel);
  try {
    client?.removeChannel(channel);
  } catch {
    /* ignore */
  }
}

export function disposeRealtimeChannels(): void {
  realtimeChannels.forEach(channel => {
    try {
      client?.removeChannel(channel);
    } catch {
      /* ignore */
    }
  });
  realtimeChannels.clear();
}
