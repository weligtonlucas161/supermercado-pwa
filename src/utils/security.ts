/**
 * Módulo Central de Segurança, Sanitização Anti-Injeção e Validação Estrita de Tipos
 * Protege entradas de usuário no front-end e payloads enviados ao Supabase contra XSS,
 * HTML/Script Injection, Formula Injection (CSV/XLSX) e SQL/PostgREST Filter Injection.
 */

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG_RE = /<[^>]*>/g;
const DANGEROUS_URI_RE = /\b(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi;
const EVENT_HANDLER_RE = /\bon[a-z]+\s*=/gi;
const SQL_INJECTION_RE = /(?:--|\/\*|\*\/|\b(?:UNION\s+ALL\s+SELECT|UNION\s+SELECT|DROP\s+TABLE|ALTER\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|EXEC(?:UTE)?\s*\(|xp_cmdshell)\b|;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC)\b)/gi;

/**
 * Sanitiza texto livre preservando acentuação/pontuação legítima em PT-BR,
 * neutralizando vetores de XSS, tags HTML, event handlers e padrões de SQL Injection.
 */
export function sanitizeText(value: unknown, maxLen = 500): string {
  if (value === null || value === undefined) return '';
  let str = typeof value === 'string' ? value : String(value);

  str = str
    .replace(CONTROL_CHARS_RE, '')
    .replace(HTML_TAG_RE, '')
    .replace(DANGEROUS_URI_RE, '')
    .replace(EVENT_HANDLER_RE, '')
    .replace(SQL_INJECTION_RE, '')
    .replace(/[<>]/g, '')
    .trim();

  if (maxLen > 0 && str.length > maxLen) {
    str = str.slice(0, maxLen).trim();
  }
  return str;
}

/**
 * Sanitiza células de planilhas (XLSX/CSV) neutralizando também Formula Injection (=, +, -, @ no início).
 */
export function sanitizeSpreadsheetCell(value: unknown, maxLen = 255): string {
  let clean = sanitizeText(value, maxLen);
  if (/^[=+\-@\t\r]/.test(clean)) {
    clean = clean.replace(/^[=+\-@\t\r]+/, '').trim();
  }
  return clean;
}

/**
 * Sanitiza identificadores e códigos usados em filtros Supabase/PostgREST (loja_id, matricula, sessao_id, ean, plu).
 * Remove vírgulas, parênteses, asteriscos, aspas e operadores que permitem PostgREST filter injection.
 */
export function sanitizeIdentifier(value: unknown, maxLen = 80): string {
  if (value === null || value === undefined) return '';
  const str = (typeof value === 'string' ? value : String(value))
    .replace(CONTROL_CHARS_RE, '')
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]/g, '');

  return maxLen > 0 ? str.slice(0, maxLen) : str;
}

/**
 * Sanitiza códigos de barras (EAN/GTIN/PLU) mantendo apenas caracteres alfanuméricos.
 */
export function sanitizeBarcode(value: unknown, maxLen = 32): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[^a-zA-Z0-9]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Validação estrita de número inteiro não negativo.
 */
export function validatePositiveInt(value: unknown, fallback = 0, max = 10_000_000): number {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(0, Math.floor(num)));
}

/**
 * Validação estrita de número decimal não negativo (ex: preço).
 */
export function validateNonNegativeNumber(value: unknown, fallback = 0, max = 10_000_000): number {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(0, num));
}

/**
 * Valida valor contra uma lista fechada (enum/whitelist).
 */
export function validateEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const str = sanitizeText(value, 64);
  const exact = allowed.find(item => item === str);
  if (exact) return exact;
  const ci = allowed.find(item => item.toUpperCase() === str.toUpperCase());
  return ci ?? fallback;
}

/**
 * Valida cor hexadecimal (#RGB ou #RRGGBB) contra CSS Injection.
 */
export function validateHexColor(value: unknown, fallback = '#059669'): string {
  const str = typeof value === 'string' ? value.trim() : '';
  return /^#[0-9a-fA-F]{6}$/.test(str) || /^#[0-9a-fA-F]{3}$/.test(str) ? str : fallback;
}

/**
 * Valida URL HTTP/HTTPS segura.
 */
export function validateSafeHttpUrl(value: unknown): string | null {
  const str = typeof value === 'string' ? value.trim() : '';
  if (!str) return null;
  try {
    const parsed = new URL(str);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/**
 * Valida e sanitiza string obrigatória não vazia.
 */
export function isValidNonEmptyString(value: unknown, minLen = 1, maxLen = 500): value is string {
  if (typeof value !== 'string') return false;
  const clean = sanitizeText(value, maxLen);
  return clean.length >= minLen;
}
