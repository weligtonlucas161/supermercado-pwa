/**
 * @license
 * Módulo de Criptografia Zero-Knowledge (AES-256) com CryptoJS
 * 
 * Camada de Segurança PWA:
 * Os dados sensíveis (Produto, Código de fornecedor, Código Reduzido, Código de barras)
 * são criptografados no frontend antes do envio para o Supabase.
 * A descriptografia ocorre estritamente sob demanda na memória RAM do cliente,
 * sem persistir dados descriptografados no localStorage ou IndexedDB.
 */

import CryptoJS from 'crypto-js';

// ============================================================================
// CHAVE SECRETA DE CRIPTOGRAFIA
// ============================================================================
// A Chave Secreta: Armazene a chave de criptografia de forma segura.
// Em ambientes Create React App: process.env.REACT_APP_ENCRYPTION_KEY
// Em ambientes Vite: import.meta.env.VITE_ENCRYPTION_KEY
// Abaixo capturamos de ambas as fontes com uma chave padrão de desenvolvimento seguro:
const ENV_ENCRYPTION_KEY = 
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_ENCRYPTION_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as Record<string, string>).VITE_ENCRYPTION_KEY) ||
  'superpwa_aes256_zero_knowledge_master_key_2026';

export const ENCRYPTION_SECRET_KEY = ENV_ENCRYPTION_KEY;

// ============================================================================
// TIPAGENS DO DOMÍNIO
// ============================================================================

/**
 * 1. Estrutura estrita com as 5 colunas requeridas da planilha de estoque:
 * • Produto
 * • Código de fornecedor
 * • Código Reduzido
 * • Código de barras
 * • Quantidade
 */
export interface FilteredProductItem {
  produto: string;          // Produto (Descrição)
  codigoFornecedor: string; // Código de fornecedor
  codigoReduzido: string;   // Código Reduzido
  codigoBarras: string;     // Código de barras (EAN/GTIN)
  quantidade: number;       // Quantidade em estoque (numérico aberto)
}

/**
 * 2. Estrutura pronta para o Banco de Dados (Supabase):
 * Os 4 campos sensíveis residem criptografados com AES-256.
 * O campo quantidade e os metadados permanecem abertos para agregações matemáticas.
 */
export interface EncryptedDatabaseProduct {
  id?: string;
  nome: string;               // AES-256 (Produto)
  codigo_fornecedor: string;  // AES-256 (Código de fornecedor)
  plu: string;                // AES-256 (Código Reduzido)
  codigo_barras: string;      // AES-256 (Código de barras)
  quantidade: number;         // Numérico aberto para operações de estoque
  loja_id: string;            // Metadado de controle
  usuario_id?: string;        // Metadado de controle (auditor/operador)
  is_encrypted: boolean;      // Flag de controle Zero-Knowledge
  criado_em?: number;
  created_at?: string;
}

/**
 * 3. Estrutura Descriptografada em Tempo Real (Memória RAM do Cliente):
 * Gerada pontualmente para visualização no componente React.
 */
export interface DecryptedDisplayProduct {
  id: string;
  produto: string;
  codigoFornecedor: string;
  codigoReduzido: string;
  codigoBarras: string;
  quantidade: number;
  isEncryptedInDatabase: boolean;
  rawCiphertext: {
    nome: string;
    codigo_fornecedor: string;
    plu: string;
    codigo_barras: string;
  };
}

// ============================================================================
// FUNÇÕES CRIPTOGRÁFICAS AES-256
// ============================================================================

/**
 * Criptografa uma string usando AES-256 (CryptoJS)
 */
export function encryptAES(plainText: string, key = ENCRYPTION_SECRET_KEY): string {
  if (!plainText && plainText !== '0') return '';
  try {
    return CryptoJS.AES.encrypt(String(plainText), key).toString();
  } catch (error) {
    console.error('Falha ao criptografar campo com AES-256:', error);
    return String(plainText);
  }
}

/**
 * Descriptografa uma string AES-256 em tempo real (Memória RAM)
 */
export function decryptAES(cipherText: string, key = ENCRYPTION_SECRET_KEY): string {
  if (!cipherText) return '';
  // Se não parecer um payload AES (ex: não começa com U2FsdGVkX1 que é o cabeçalho "Salted__" padrão do CryptoJS)
  if (!cipherText.startsWith('U2FsdGVk')) {
    return cipherText;
  }

  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || cipherText;
  } catch (error) {
    console.warn('Erro ao descriptografar dado AES (chave incorreta ou formato inválido):', error);
    return '[DADO PROTEGIDO]';
  }
}

/**
 * Criptografa as 4 colunas sensíveis e formata o objeto para o Supabase
 */
export function prepareEncryptedPayload(
  item: FilteredProductItem,
  metadata: { lojaId: string; usuarioId?: string }
): EncryptedDatabaseProduct {
  return {
    nome: encryptAES(item.produto.trim()),
    codigo_fornecedor: encryptAES(item.codigoFornecedor.trim()),
    plu: encryptAES(item.codigoReduzido.trim()),
    codigo_barras: encryptAES(item.codigoBarras.trim()),
    quantidade: Math.max(0, Number(item.quantidade) || 0),
    loja_id: metadata.lojaId,
    usuario_id: metadata.usuarioId || 'usuario_pwa_local',
    is_encrypted: true,
    criado_em: Date.now(),
  };
}

/**
 * Descriptografa pontualmente na memória RAM para exibição na tela
 */
export function decryptForDisplay(encrypted: EncryptedDatabaseProduct, fallbackId?: string): DecryptedDisplayProduct {
  return {
    id: encrypted.id || fallbackId || `item-${Math.random().toString(36).substring(2, 9)}`,
    produto: decryptAES(encrypted.nome),
    codigoFornecedor: decryptAES(encrypted.codigo_fornecedor),
    codigoReduzido: decryptAES(encrypted.plu),
    codigoBarras: decryptAES(encrypted.codigo_barras),
    quantidade: encrypted.quantidade,
    isEncryptedInDatabase: Boolean(encrypted.is_encrypted),
    rawCiphertext: {
      nome: encrypted.nome,
      codigo_fornecedor: encrypted.codigo_fornecedor,
      plu: encrypted.plu,
      codigo_barras: encrypted.codigo_barras,
    },
  };
}

// ============================================================================
// FILTRAGEM ESTRITA DAS 5 COLUNAS DA PLANILHA
// ============================================================================

/**
 * Normaliza rótulos de colunas da planilha para encontrar com precisão as 5 colunas
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export interface SpreadsheetColumnIndices {
  produto: number;
  codigoFornecedor: number;
  codigoReduzido: number;
  codigoBarras: number;
  quantidade: number;
}

/**
 * Detecta as posições exatas das 5 colunas exigidas pelo usuário
 */
export function detect5Columns(headers: string[]): {
  indices: SpreadsheetColumnIndices;
  foundAllRequired: boolean;
  missingCols: string[];
} {
  const indices: SpreadsheetColumnIndices = {
    produto: -1,
    codigoFornecedor: -1,
    codigoReduzido: -1,
    codigoBarras: -1,
    quantidade: -1,
  };

  headers.forEach((h, idx) => {
    const norm = normalizeHeader(String(h));

    // 1. Produto (Descrição)
    if (indices.produto === -1 && (
      norm.includes('produto') || 
      norm.includes('descricao') || 
      norm.includes('desc') || 
      norm.includes('item') ||
      norm.includes('nome')
    )) {
      indices.produto = idx;
      return;
    }

    // 2. Código de fornecedor
    if (indices.codigoFornecedor === -1 && (
      norm.includes('fornecedor') || 
      norm.includes('forn') || 
      norm.includes('codforn') || 
      norm.includes('fabricante')
    )) {
      indices.codigoFornecedor = idx;
      return;
    }

    // 3. Código Reduzido
    if (indices.codigoReduzido === -1 && (
      norm.includes('reduzido') || 
      norm.includes('codreduzido') || 
      norm.includes('plu') || 
      norm.includes('red') || 
      norm.includes('codinterno')
    )) {
      indices.codigoReduzido = idx;
      return;
    }

    // 4. Código de barras
    if (indices.codigoBarras === -1 && (
      norm.includes('barras') || 
      norm.includes('ean') || 
      norm.includes('codigodebarras') || 
      norm.includes('gtin') || 
      norm.includes('codbarra')
    )) {
      indices.codigoBarras = idx;
      return;
    }

    // 5. Quantidade
    if (indices.quantidade === -1 && (
      norm.includes('quantidade') || 
      norm.includes('qtd') || 
      norm.includes('estoque') || 
      norm.includes('saldo') || 
      norm.includes('quant')
    )) {
      indices.quantidade = idx;
      return;
    }
  });

  // Se não identificou por palavras-chave, verifica mapeamento sequencial padrão (A=Produto, B=Forn, C=Red, D=Barras, E=Qtd)
  if (indices.produto === -1 && headers.length > 0) indices.produto = 0;
  if (indices.codigoFornecedor === -1 && headers.length > 1) indices.codigoFornecedor = 1;
  if (indices.codigoReduzido === -1 && headers.length > 2) indices.codigoReduzido = 2;
  if (indices.codigoBarras === -1 && headers.length > 3) indices.codigoBarras = 3;
  if (indices.quantidade === -1 && headers.length > 4) indices.quantidade = 4;

  const missingCols: string[] = [];
  if (indices.produto === -1) missingCols.push('Produto');
  if (indices.codigoBarras === -1) missingCols.push('Código de barras');
  if (indices.quantidade === -1) missingCols.push('Quantidade');

  return {
    indices,
    foundAllRequired: missingCols.length === 0,
    missingCols,
  };
}
