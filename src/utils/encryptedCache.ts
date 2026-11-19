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
const CACHE_SALT = new Uint8Array([83, 116, 111, 99, 107, 67, 97, 99, 104, 101, 83, 97, 108, 116, 50, 54]);

let cachedKey: CryptoKey | null = null;

async function getCacheKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API não disponível no ambiente.');
  }

  const enc = new TextEncoder();
  const rawSecret = 'SUPERPWA-STOCK-ENCRYPTED-CACHE-KEY-V1';
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(rawSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derived = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: CACHE_SALT,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  cachedKey = derived;
  return derived;
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
    if (!envelope.iv || !envelope.ciphertext) {
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
