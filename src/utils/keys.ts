/**
 * @license
 * Arquivo: src/utils/keys.ts
 *
 * Resolução centralizada do material criptográfico do cliente.
 *
 * Antes, cada módulo de criptografia resolvia a chave por conta própria
 * (com fallbacks diferentes). Isso gerava divergência entre o que é cifrado
 * e o que é decifrado. Agora existe uma única fonte de verdade.
 *
 * Ordem de resolução (compatível com os dados já gravados no banco):
 *  1. process.env.REACT_APP_ENCRYPTION_KEY  (build legado)
 *  2. import.meta.env.VITE_ENCRYPTION_KEY    (build Vite)
 *  3. valor histórico (mantido para não invalidar os dados já cifrados)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function readEnv(key: string): string {
  try {
    const proc = (globalThis as any).process;
    if (proc && proc.env && typeof proc.env[key] === 'string' && proc.env[key]) {
      return proc.env[key] as string;
    }
  } catch {
    /* ambiente sem process */
  }
  try {
    const meta = import.meta as any;
    if (meta && meta.env && typeof meta.env[key] === 'string' && meta.env[key]) {
      return meta.env[key] as string;
    }
  } catch {
    /* ambiente sem import.meta */
  }
  return '';
}

/** Chave mestra AES-256 (CryptoJS) usada nos campos cifrados do banco. */
export const MASTER_KEY =
  readEnv('REACT_APP_ENCRYPTION_KEY') ||
  readEnv('VITE_ENCRYPTION_KEY') ||
  'superpwa_aes256_zero_knowledge_master_key_2026';

/**
 * Pepper do hash deterministico de EAN. Por padrao reaproveita a chave mestra,
 * de modo que o hash nunca fica mais exposto do que os proprios campos
 * cifrados. Pode ser separado via VITE_EAN_HASH_PEPPER.
 */
export const EAN_HASH_PEPPER = readEnv('VITE_EAN_HASH_PEPPER') || MASTER_KEY;

/** Indica se a chave mestra veio do ambiente (em vez do valor historico). */
export const MASTER_KEY_FROM_ENV = Boolean(
  readEnv('REACT_APP_ENCRYPTION_KEY') || readEnv('VITE_ENCRYPTION_KEY')
);
