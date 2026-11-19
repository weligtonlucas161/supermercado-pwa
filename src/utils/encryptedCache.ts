/**
 * @license
 * Arquivo: src/utils/encryptedCache.ts
 *
 * Módulo de Cache Criptografado com Web Crypto API (AES-GCM 256-bit)
 * e Expiração Automática de 4 Horas.
 *
 * Regras:
 * 1. Dados são salvos cifrados com AES-GCM no localStorage com timestamp de criação.
 * 2. Validade estrita de 4 horas (14.400.000 ms). Itens vencidos são purgados.
 * 3. Chave individual por aba, busca, setor e paginação.
 * 4. Invalidação imediata em mutações de estoque (CUD).
 */

import { getOrCreateStoreKey } from './crypto';

const CACHE_PREFIX = 'superpwa_enc_cache_';
export const CACHE_TTL_4_HOURS_MS = 4 * 60 * 60 * 1000; // 4 horas

interface CacheEnvelope {
  ciphertext: string; // Base64
  iv: string;         // Base64
  createdAt: number;  // Timestamp ms
  expiresAt: number;  // Timestamp ms
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

/**
 * Grava dados no cache criptografado com AES-GCM 256 bits e expiração de 4 horas.
 */
export async function setEncryptedCache<T>(
  key: string,
  data: T,
  ttlMs = CACHE_TTL_4_HOURS_MS
): Promise<void> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return;

  try {
    const keyObj = await getOrCreateStoreKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV para AES-GCM
    const jsonStr = JSON.stringify(data);
    const encoded = new TextEncoder().encode(jsonStr);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      keyObj,
      encoded
    );

    const now = Date.now();
    const envelope: CacheEnvelope = {
      ciphertext: bufferToBase64(encryptedBuffer),
      iv: bufferToBase64(iv),
      createdAt: now,
      expiresAt: now + ttlMs,
    };

    const fullKey = `${CACHE_PREFIX}${key}`;
    localStorage.setItem(fullKey, JSON.stringify(envelope));
  } catch (err) {
    console.warn('[encryptedCache] Falha ao gravar cache criptografado:', err);
  }
}

/**
 * Lê dados do cache criptografado. Se expirado (> 4h) ou inválido, remove e retorna null.
 */
export async function getEncryptedCache<T>(key: string): Promise<T | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;

  const fullKey = `${CACHE_PREFIX}${key}`;
  const raw = localStorage.getItem(fullKey);
  if (!raw) return null;

  try {
    const envelope: CacheEnvelope = JSON.parse(raw);
    const now = Date.now();

    // Expiração automática de 4 horas
    if (!envelope.expiresAt || now > envelope.expiresAt) {
      localStorage.removeItem(fullKey);
      return null;
    }

    const keyObj = await getOrCreateStoreKey();
    const encryptedBytes = base64ToBuffer(envelope.ciphertext);
    const ivBytes = base64ToBuffer(envelope.iv);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes as unknown as BufferSource },
      keyObj,
      encryptedBytes as unknown as BufferSource
    );

    const decodedStr = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decodedStr) as T;
  } catch (err) {
    console.warn('[encryptedCache] Erro ao decifrar cache, limpando entrada:', err);
    localStorage.removeItem(fullKey);
    return null;
  }
}

/**
 * Invalida todo o cache de estoque ou com prefixo específico.
 */
export function invalidateEncryptedCache(subPrefix = ''): void {
  if (typeof window === 'undefined') return;

  try {
    const target = `${CACHE_PREFIX}${subPrefix}`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(target)) {
        keysToRemove.push(k);
      }
    }

    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch (err) {
    console.warn('[encryptedCache] Falha ao invalidar cache:', err);
  }
}

/**
 * Varre e limpa entradas de cache com mais de 4 horas (executado na inicialização).
 */
export function pruneExpiredEncryptedCache(): void {
  if (typeof window === 'undefined') return;

  try {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const envelope: CacheEnvelope = JSON.parse(raw);
            if (!envelope.expiresAt || now > envelope.expiresAt) {
              keysToRemove.push(k);
            }
          }
        } catch {
          keysToRemove.push(k);
        }
      }
    }

    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch (err) {
    console.warn('[encryptedCache] Erro ao limpar cache expirado:', err);
  }
}
