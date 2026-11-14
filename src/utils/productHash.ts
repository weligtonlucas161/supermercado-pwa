/**
 * @license
 * Arquivo: src/utils/productHash.ts
 *
 * Hash determinístico do EAN (código de barras).
 *
 * Por que existe: o campo `codigo_barras` é gravado cifrado com salt
 * aleatório. Consequentemente:
 *  - dois produtos com o MESMO EAN geram ciphertexts diferentes;
 *  - índices únicos sobre a coluna cifrada nunca conflitam;
 *  - deduplicar exige decifrar a tabela inteira a cada importação.
 *
 * O `ean_hash` resolve isso: é um HMAC-SHA256 do EAN normalizado, determinístico
 * e indexável, permitindo deduplicação e upsert atômico sem decifrar nada.
 */

import { sanitizeBarcode } from './security';
import { EAN_HASH_PEPPER } from './keys';

const HASH_VERSION = 'v1';

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function hasWebCrypto(): boolean {
  return typeof globalThis.crypto !== 'undefined' && !!globalThis.crypto.subtle;
}

/**
 * Calcula o hash determinístico de um EAN.
 * Retorna string vazia para EAN inválido.
 */
export async function hashEan(rawEan: string): Promise<string> {
  const ean = sanitizeBarcode(rawEan, 32);
  if (!ean) return '';
  if (!hasWebCrypto()) return '';

  const payload = new TextEncoder().encode(`${HASH_VERSION}:${ean}`);

  try {
    if (EAN_HASH_PEPPER) {
      const key = await globalThis.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(EAN_HASH_PEPPER),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await globalThis.crypto.subtle.sign('HMAC', key, payload);
      return `h1:${toHex(signature)}`;
    }
  } catch {
    /* cai no SHA-256 abaixo */
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', payload);
  return `h0:${toHex(digest)}`;
}

/**
 * Calcula o hash de uma lista de EANs em paralelo (limitado para não
 * saturar a main thread com operações Web Crypto).
 */
export async function hashEanBatch(eans: string[], concurrency = 16): Promise<string[]> {
  const results: string[] = new Array(eans.length).fill('');
  let cursor = 0;

  const worker = async () => {
    while (cursor < eans.length) {
      const index = cursor++;
      results[index] = await hashEan(eans[index]);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, eans.length) }, worker);
  await Promise.all(workers);
  return results;
}
