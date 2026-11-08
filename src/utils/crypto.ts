import { SpreadsheetProductItem } from '../types';

/**
 * Módulo Criptográfico Nativo (Web Crypto API - AES-GCM 256-bit)
 * Garante que todas as 5 colunas da planilha (Descrição, Cód. Fornecedor,
 * Cód. Reduzido, EAN e Quantidade) sejam criptografadas antes do envio
 * para o banco de dados e descriptografadas de forma transparente no cliente.
 */

const STORE_SALT = new Uint8Array([79, 112, 83, 121, 115, 83, 117, 112, 101, 114, 80, 87, 65, 50, 48, 50]);

let cachedCryptoKey: CryptoKey | null = null;

/**
 * Obtém ou deriva a chave criptográfica mestra AES-GCM (256 bits) da loja
 */
export async function getOrCreateStoreKey(customPassphrase = 'SUPERPWA-OPSYS-SECURE-STORE-KEY-2026'): Promise<CryptoKey> {
  if (cachedCryptoKey) {
    return cachedCryptoKey;
  }

  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API não está disponível neste ambiente.');
  }

  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(customPassphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: STORE_SALT,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  cachedCryptoKey = derivedKey;
  return derivedKey;
}

/**
 * Converte Uint8Array ou ArrayBuffer para string Base64
 */
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Converte string Base64 para Uint8Array
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Criptografa as 5 colunas estritas do produto
 */
export async function encryptProduct(
  item: SpreadsheetProductItem,
  key?: CryptoKey
): Promise<{ ciphertext: string; iv: string; previewCipher: string }> {
  const activeKey = key || (await getOrCreateStoreKey());
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV para AES-GCM

  const payload = JSON.stringify({
    name: item.name,
    supplierCode: item.supplierCode,
    reducedCode: item.reducedCode,
    ean: item.ean,
    quantity: item.quantity,
  });

  const encodedData = new TextEncoder().encode(payload);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    activeKey,
    encodedData
  );

  const ciphertextBase64 = bufferToBase64(encryptedBuffer);
  const ivBase64 = bufferToBase64(iv);

  return {
    ciphertext: ciphertextBase64,
    iv: ivBase64,
    previewCipher: ciphertextBase64.substring(0, 24) + '...',
  };
}

/**
 * Descriptografa as 5 colunas para exibição no software
 */
export async function decryptProduct(
  ciphertext: string,
  iv: string,
  key?: CryptoKey
): Promise<SpreadsheetProductItem> {
  const activeKey = key || (await getOrCreateStoreKey());

  const encryptedBytes = base64ToBuffer(ciphertext);
  const ivBytes = base64ToBuffer(iv);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes as unknown as BufferSource,
    },
    activeKey,
    encryptedBytes as unknown as BufferSource
  );

  const decodedStr = new TextDecoder().decode(decryptedBuffer);
  const parsed = JSON.parse(decodedStr);

  return {
    name: parsed.name,
    supplierCode: parsed.supplierCode || '',
    reducedCode: parsed.reducedCode || '',
    ean: parsed.ean,
    quantity: parsed.quantity,
    isValid: true,
    errors: [],
  };
}

/**
 * Criptografa uma lista de itens com callback de progresso em tempo real
 */
export async function encryptProductList(
  items: SpreadsheetProductItem[],
  onProgress?: (processed: number, total: number, percent: number) => void
): Promise<Array<{ original: SpreadsheetProductItem; encrypted: { ciphertext: string; iv: string } }>> {
  const key = await getOrCreateStoreKey();
  const results = [];
  const total = items.length;

  for (let i = 0; i < total; i++) {
    const item = items[i];
    const enc = await encryptProduct(item, key);
    results.push({
      original: item,
      encrypted: {
        ciphertext: enc.ciphertext,
        iv: enc.iv,
      },
    });

    if (onProgress && (i % 5 === 0 || i === total - 1)) {
      const current = i + 1;
      const pct = Math.round((current / total) * 100);
      onProgress(current, total, pct);
    }
  }

  return results;
}
