/**
 * @license
 * Arquivo: src/utils/encryptionUtils.ts
 * 
 * Função Utilitária de Descriptografia e Segurança Zero-Knowledge
 * 
 * Regra de Negócio:
 * - Permite ler dados armazenados no Supabase de forma temporária na memória RAM.
 * - Garante que o estado da interface seja atualizado apenas com os valores descriptografados para exibição.
 * - Os dados limpos NUNCA devem ser gravados de forma persistente no localStorage ou IndexedDB.
 */

import CryptoJS from 'crypto-js';
import { sanitizeText } from './security';

// Chave mestra de criptografia AES-256
// Em produção: process.env.REACT_APP_ENCRYPTION_KEY ou import.meta.env.VITE_ENCRYPTION_KEY
const MASTER_KEY =
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_ENCRYPTION_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as Record<string, string>).VITE_ENCRYPTION_KEY) ||
  'superpwa_aes256_zero_knowledge_master_key_2026';

export interface DecryptedProduct {
  id: string;
  nome: string;               // Descriptografado em RAM (Descrição do produto)
  produto: string;            // Alias compatível para descrição do produto
  codigo_fornecedor: string;  // Descriptografado em RAM (Código de fornecedor)
  codigoFornecedor: string;   // Alias compatível
  plu: string;                // Descriptografado em RAM (Código Reduzido)
  codigoReduzido: string;     // Alias compatível
  codigo_barras: string;      // Descriptografado em RAM (Código EAN)
  codigoBarras: string;       // Alias compatível
  setor: string;              // Setor (FRIOS, AÇOUGUE, PEIXARIA, MERCEARIA, PADARIA, BAZAR)
  quantidade: number;         // Numérico para operações matemáticas de estoque
  loja_id?: string;
  lojaId?: string;
  is_encrypted?: boolean;
  isEncrypted?: boolean;
  criado_em?: number;
  data_vencimento?: string;
  // Guarda referência cifrada bruta apenas para auditoria visual se necessário
  _rawCiphertext?: {
    nome?: string;
    produto?: string;
    codigo_fornecedor?: string;
    codigoFornecedor?: string;
    plu?: string;
    codigoReduzido?: string;
    codigo_barras?: string;
    codigoBarras?: string;
  };
  rawCiphertext?: {
    nome?: string;
    produto?: string;
    codigo_fornecedor?: string;
    codigoFornecedor?: string;
    plu?: string;
    codigoReduzido?: string;
    codigo_barras?: string;
    codigoBarras?: string;
  };
}

/**
 * Verifica se um texto possui o formato de um hash criptografado CryptoJS AES (prefixo OpenSSL Salted__)
 */
export function isEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.startsWith('U2FsdGVk');
}

/**
 * Descriptografa um campo individual em memória RAM usando AES-256
 */
export function decryptSingleField(
  cipherText: string | null | undefined,
  secretKey = MASTER_KEY,
  options?: { skipSanitize?: boolean }
): string {
  if (!cipherText || typeof cipherText !== 'string') return '';
  const trimmed = cipherText.trim();

  // Se não estiver criptografado, retorna o texto original sanitizado
  if (!isEncrypted(trimmed)) {
    return options?.skipSanitize ? trimmed : sanitizeText(trimmed, 2000);
  }

  try {
    const bytes = CryptoJS.AES.decrypt(trimmed, secretKey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) return '[DADO PROTEGIDO]';
    return options?.skipSanitize ? decrypted : sanitizeText(decrypted, 2000);
  } catch (error) {
    console.warn('Erro pontual ao descriptografar campo AES:', error);
    return '[DADO PROTEGIDO]';
  }
}

/**
 * Criptografa um campo individual usando AES-256 antes de enviar ao Supabase
 */
export function encryptSingleField(
  plainText: string | null | undefined,
  secretKey = MASTER_KEY,
  options?: { skipSanitize?: boolean }
): string {
  if (!plainText || typeof plainText !== 'string') return '';
  const trimmed = plainText.trim();
  if (!trimmed) return '';
  if (isEncrypted(trimmed)) return trimmed;
  const safeValue = options?.skipSanitize ? trimmed : sanitizeText(trimmed, 2000);
  if (!safeValue) return '';
  return CryptoJS.AES.encrypt(safeValue, secretKey).toString();
}

/**
 * Descriptografa temporariamente na memória RAM um registro de produto vindo do Supabase.
 * Garante que a interface receba os valores legíveis sem salvá-los no disco.
 */
export function decryptDatabaseProduct(raw: Record<string, unknown>, secretKey = MASTER_KEY): DecryptedProduct {
  const rawNome = String(raw.nome || raw.name || '');
  const rawFornecedor = String(raw.codigo_fornecedor || raw.supplierCode || '');
  const rawPlu = String(raw.plu || raw.reducedCode || '');
  const rawBarras = String(raw.codigo_barras || raw.ean || '');

  const decNome = decryptSingleField(rawNome, secretKey);
  const decForn = decryptSingleField(rawFornecedor, secretKey);
  const decPlu = decryptSingleField(rawPlu, secretKey);
  const decBarras = decryptSingleField(rawBarras, secretKey);

  const rawCiph = {
    nome: rawNome,
    produto: rawNome,
    codigo_fornecedor: rawFornecedor,
    codigoFornecedor: rawFornecedor,
    plu: rawPlu,
    codigoReduzido: rawPlu,
    codigo_barras: rawBarras,
    codigoBarras: rawBarras,
  };

  return {
    id: String(raw.id || `ram-${Math.random().toString(36).substring(2, 9)}`),
    nome: decNome,
    produto: decNome,
    codigo_fornecedor: decForn,
    codigoFornecedor: decForn,
    plu: decPlu,
    codigoReduzido: decPlu,
    codigo_barras: decBarras,
    codigoBarras: decBarras,
    setor: String(raw.setor || raw.category || 'MERCEARIA'),
    quantidade: Math.max(0, Number(raw.quantidade ?? raw.stock ?? 0)),
    loja_id: String(raw.loja_id || ''),
    is_encrypted: Boolean(raw.is_encrypted ?? isEncrypted(rawNome)),
    criado_em: typeof raw.criado_em === 'number' ? raw.criado_em : Date.now(),
    data_vencimento: String(raw.data_vencimento || ''),
    _rawCiphertext: rawCiph,
    rawCiphertext: rawCiph,
  };
}

/**
 * Descriptografa em lote uma lista de produtos na memória RAM.
 * Utilizado por hooks e componentes React no momento da renderização.
 */
export function decryptProductList(rawList: Array<Record<string, unknown>>, secretKey = MASTER_KEY): DecryptedProduct[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.map(item => decryptDatabaseProduct(item, secretKey));
}

// Aliases para compatibilidade total com ImportadorEstoque
export const ENCRYPTION_KEY = MASTER_KEY;
export const encryptField = encryptSingleField;
export const decryptField = decryptSingleField;
export const decryptProductsList = decryptProductList;

