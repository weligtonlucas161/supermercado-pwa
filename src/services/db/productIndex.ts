/**
 * @license
 * Arquivo: src/services/db/productIndex.ts
 *
 * Índice determinístico de produtos por loja.
 *
 * Objetivo: permitir deduplicação e upsert em lote sem decifrar a tabela
 * inteira a cada importação. O índice é montado a partir da coluna
 * `ean_hash` (HMAC determinístico do EAN) e é mantido em memória com TTL.
 *
 * Fluxo:
 *  1. Lê `id, ean_hash` (barato) de todos os produtos da loja.
 *  2. Linhas ainda sem `ean_hash` (registros legados) são decifradas uma
 *     única vez, agrupadas em lote e gravadas de volta (backfill).
 *  3. A partir daí, toda importação resolve EAN -> id por mapa em memória.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSingleField } from '../../utils/encryptionUtils';
import { sanitizeBarcode } from '../../utils/security';
import { hashEan } from '../../utils/productHash';
import { upsertProductRows, upsertCatalogRows } from './productWrite';

const INDEX_TTL_MS = 60_000;
const BACKFILL_BATCH = 500;

/**
 * Colunas lidas para montar o índice. Inclui todas as colunas NOT NULL
 * da tabela `produtos` para que o fallback de upsert (sem RPC) continue
 * funcionando (no PostgREST, upsert em lote nao aplica defaults).
 */
const INDEX_COLUMNS =
  'id, ean_hash, codigo_barras, nome, setor, quantidade, data_vencimento, loja_id, is_encrypted, criado_em';

export interface ProductIndex {
  lojaId: string;
  /** ean_hash -> id do produto */
  hashToId: Map<string, string>;
  /** id -> ean_hash */
  idToHash: Map<string, string>;
  loadedAt: number;
}

const indexCache = new Map<string, ProductIndex>();

interface IndexRow {
  id: string;
  ean_hash: string | null;
  codigo_barras: string | null;
  nome: string | null;
  setor: string | null;
  quantidade: number | null;
  data_vencimento: string | null;
  loja_id: string | null;
  is_encrypted: boolean | null;
  criado_em: number | null;
}

/** Invalida o índice em memória de uma loja (usado pelo Realtime). */
export function invalidateProductIndex(lojaId?: string): void {
  if (!lojaId) {
    indexCache.clear();
    return;
  }
  indexCache.delete(lojaId);
}

/** Retorna o índice em cache, se ainda válido. */
export function getCachedProductIndex(lojaId: string): ProductIndex | null {
  const cached = indexCache.get(lojaId);
  if (!cached) return null;
  if (Date.now() - cached.loadedAt > INDEX_TTL_MS) {
    indexCache.delete(lojaId);
    return null;
  }
  return cached;
}

/**
 * Carrega (ou reutiliza) o índice de produtos da loja.
 * Retorna um índice vazio quando o banco não está disponível.
 */
export async function loadProductIndex(
  client: SupabaseClient,
  lojaId: string,
  options: { force?: boolean } = {}
): Promise<ProductIndex> {
  const cached = options.force ? null : getCachedProductIndex(lojaId);
  if (cached) return cached;

  const hashToId = new Map<string, string>();
  const idToHash = new Map<string, string>();
  const pendingBackfill: IndexRow[] = [];

  const { data, error } = await client
    .from('produtos')
    .select(INDEX_COLUMNS)
    .eq('loja_id', lojaId);

  if (error) {
    console.warn('[productIndex] Falha ao carregar o índice de produtos:', error.message);
  }

  const rows = (data || []) as IndexRow[];
  const legacyRows: IndexRow[] = [];

  for (const row of rows) {
    if (row.ean_hash) {
      hashToId.set(row.ean_hash, row.id);
      idToHash.set(row.id, row.ean_hash);
    } else {
      legacyRows.push(row);
    }
  }

  // Registros legados: decifra uma única vez para obter o EAN e gerar o hash.
  if (legacyRows.length > 0) {
    const eans = legacyRows.map(row => sanitizeBarcode(decryptSingleField(String(row.codigo_barras || ''))));
    for (let i = 0; i < legacyRows.length; i++) {
      const row = legacyRows[i];
      const ean = eans[i];
      if (!ean) continue;
      const hash = await hashEan(ean);
      if (!hash) continue;
      if (!hashToId.has(hash)) hashToId.set(hash, row.id);
      idToHash.set(row.id, hash);
      pendingBackfill.push({ ...row, ean_hash: hash });
    }
  }

  const index: ProductIndex = { lojaId, hashToId, idToHash, loadedAt: Date.now() };
  indexCache.set(lojaId, index);

  // Backfill assíncrono: grava os hashes das linhas legadas em lotes.
  if (pendingBackfill.length > 0) {
    void backfillEanHashes(client, pendingBackfill);
  }

  return index;
}

async function backfillEanHashes(client: SupabaseClient, rows: IndexRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += BACKFILL_BATCH) {
    const chunk = rows.slice(i, i + BACKFILL_BATCH);
    const payload = chunk
      .filter(row => row.id && row.ean_hash)
      .map(row => ({
        id: row.id,
        nome: row.nome || '',
        codigo_barras: row.codigo_barras || '',
        setor: row.setor || 'MERCEARIA',
        quantidade: Number(row.quantidade || 0),
        data_vencimento: row.data_vencimento || '',
        loja_id: row.loja_id || '',
        is_encrypted: row.is_encrypted ?? true,
        criado_em: Number(row.criado_em || Date.now()),
        ean_hash: row.ean_hash,
      }));

    if (payload.length === 0) continue;

    try {
      await upsertProductRows(client, payload);
    } catch (err) {
      console.warn('[productIndex] Falha no backfill de ean_hash:', err);
      return;
    }
  }
}

/**
 * Catálogo universal: conjunto de EANs já cadastrados (por hash), para evitar
 * inserir o mesmo produto repetidamente a cada importação.
 */
const catalogCache = new Map<string, { hashes: Set<string>; loadedAt: number }>();
const CATALOG_TTL_MS = 300_000;

export function invalidateCatalogIndex(): void {
  catalogCache.clear();
}

export async function loadCatalogIndex(client: SupabaseClient): Promise<Set<string>> {
  const cached = catalogCache.get('global');
  if (cached && Date.now() - cached.loadedAt <= CATALOG_TTL_MS) {
    return cached.hashes;
  }

  const hashes = new Set<string>();
  const { data, error } = await client
    .from('produtos_catalogo_universal')
    .select('codigo_barras, nome, ean_hash');

  if (error) {
    console.warn('[productIndex] Falha ao carregar o catálogo universal:', error.message);
    return hashes;
  }

  const rows = (data || []) as Array<{
    ean_hash: string | null;
    codigo_barras: string | null;
    nome: string | null;
  }>;
  const legacy: typeof rows = [];

  for (const row of rows) {
    if (row.ean_hash) {
      hashes.add(row.ean_hash);
    } else {
      legacy.push(row);
    }
  }

  if (legacy.length > 0) {
    const eans = legacy.map(row => sanitizeBarcode(decryptSingleField(String(row.codigo_barras || ''))));
    const backfill: Array<{ codigo_barras: string; nome: string; ean_hash: string }> = [];

    for (let i = 0; i < legacy.length; i++) {
      const ean = eans[i];
      if (!ean) continue;
      const hash = await hashEan(ean);
      if (!hash) continue;
      hashes.add(hash);
      backfill.push({
        codigo_barras: legacy[i].codigo_barras || '',
        nome: legacy[i].nome || '',
        ean_hash: hash,
      });
    }

    // Grava o backfill em lotes (1 requisicao a cada 500 linhas) em vez de
    // uma requisicao por registro.
    for (let i = 0; i < backfill.length; i += BACKFILL_BATCH) {
      const chunk = backfill.slice(i, i + BACKFILL_BATCH);
      try {
        await upsertCatalogRows(client, chunk);
      } catch (err) {
        console.warn('[productIndex] Falha no backfill do catálogo:', err);
        break;
      }
    }
  }

  catalogCache.set('global', { hashes, loadedAt: Date.now() });
  return hashes;
}
