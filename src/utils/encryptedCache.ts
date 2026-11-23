/**
 * @license
 * Arquivo: src/utils/encryptedCache.ts
 *
 * Cache criptografado no navegador para o módulo de Estoque.
 * Utiliza Web Crypto API nativa (AES-GCM 256-bit com IV randômico de 96 bits)
 * com expiração configurada para 4 horas (14.400.000 ms).
 */

const CACHE_PREFIX = 'stock_cache_enc_';
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000; // 4 horas
// Chave de sessão não persistente: um novo login/navegador invalida o cache antigo.
// Rotação a cada 240 minutos; entradas antigas são descartadas ao girar a chave.
const KEY_EPOCH_MS = FOUR_HOURS_MS;
const CACHE_SALT = new TextEncoder().encode('superpwa-cache-v3');
let cachedKey: CryptoKey | null = null;
let cachedEpoch = -1;
function getEpoch() { return Math.floor(Date.now() / KEY_EPOCH_MS); }
export async function getCacheKey(): Promise<CryptoKey> {
  const epoch = getEpoch();
  if (cachedKey && cachedEpoch === epoch) return cachedKey;
  if (!window.crypto?.subtle) throw new Error('Web Crypto API indisponível');
  const secretKey = 'superpwa_session_cache_secret_v3';
  let secret = sessionStorage.getItem(secretKey);
  if (!secret) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    secret = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(secretKey, secret);
  }
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret + ':' + epoch), 'PBKDF2', false, ['deriveKey']);
  cachedKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: CACHE_SALT, iterations: 100000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  cachedEpoch = epoch;
  return cachedKey;
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface EncryptedEnvelope {
  epoch: number;
  iv: string; // Base64 (12 bytes)
  ciphertext: string; // Base64
}

interface CachePayload<T> {
  timestamp: number;
  data: T;
}

/**
 * Salva dados de estoque criptografados com timestamp no localStorage.
 */
export async function setEncryptedCache<T>(key: string, data: T): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const keyObj = await getCacheKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const payload: CachePayload<T> = {
      timestamp: Date.now(),
      data,
    };

    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      keyObj,
      encoded
    );

    const envelope: EncryptedEnvelope = {
      epoch: getEpoch(),
      iv: bufferToBase64(iv),
      ciphertext: bufferToBase64(encrypted),
    };

    const storageKey = `${CACHE_PREFIX}${key}`;
    localStorage.setItem(storageKey, JSON.stringify(envelope));
  } catch (err) {
    console.warn('[encryptedCache] Falha ao gravar cache criptografado:', err);
  }
}

/**
 * Recupera e descriptografa dados de estoque do cache.
 * Se tiver mais de 4 horas, remove automaticamente e retorna null.
 */
export async function getEncryptedCache<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  const storageKey = `${CACHE_PREFIX}${key}`;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const envelope: EncryptedEnvelope = JSON.parse(raw);
    if (!envelope.iv || !envelope.ciphertext || envelope.epoch !== getEpoch()) {
      localStorage.removeItem(storageKey);
      return null;
    }

    const keyObj = await getCacheKey();
    const ivBytes = base64ToBuffer(envelope.iv);
    const cipherBytes = base64ToBuffer(envelope.ciphertext);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes as unknown as BufferSource },
      keyObj,
      cipherBytes as unknown as BufferSource
    );

    const decryptedStr = new TextDecoder().decode(decryptedBuffer);
    const payload: CachePayload<T> = JSON.parse(decryptedStr);

    // Validação estrita de expiração: 4 horas
    const age = Date.now() - (payload.timestamp || 0);
    if (age > FOUR_HOURS_MS || age < 0) {
      // Expirado: remove imediatamente
      localStorage.removeItem(storageKey);
      return null;
    }

    return {
      data: payload.data,
      timestamp: payload.timestamp,
    };
  } catch (err) {
    console.warn('[encryptedCache] Falha ao descriptografar cache (dados corrompidos ou chave alterada):', err);
    localStorage.removeItem(storageKey);
    return null;
  }
}

/**
 * Invalida o cache do estoque.
 * Pode ser filtrado por lojaId ou limpar todo o cache de estoque.
 */
export function invalidateStockCache(lojaId?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const keysToRemove: string[] = [];
    const targetPattern = lojaId ? `${CACHE_PREFIX}${lojaId}_` : CACHE_PREFIX;

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(targetPattern)) {
        keysToRemove.push(k);
      }
    }

    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.warn('[encryptedCache] Falha ao invalidar cache:', err);
  }
}

/**
 * Limpa automaticamente todas as entradas expiradas com mais de 4 horas.
 */
export async function cleanupExpiredStockCache(): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const keysToCheck: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        keysToCheck.push(k.replace(CACHE_PREFIX, ''));
      }
    }

    for (const key of keysToCheck) {
      await getEncryptedCache(key); // o próprio getEncryptedCache remove se estiver expirado
    }
  } catch {
    // silencioso
  }
}
