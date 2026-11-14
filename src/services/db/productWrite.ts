/**
 * @license
 * Arquivo: src/services/db/productWrite.ts
 *
 * Escrita de produtos em lote.
 *
 * Por que uma camada própria: o `upsert` em lote do PostgREST usa
 * `json_populate_recordset`, que NÃO aplica os valores default das colunas
 * ausentes (elas viram NULL e violam as constraints NOT NULL). Por isso a
 * gravação em lote é feita por funções SQL no banco (que respeitam os
 * defaults e rodam em uma única transação), com um caminho alternativo
 * seguro caso a função ainda não exista no ambiente.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProductWriteRow {
  id?: string;
  loja_id: string;
  nome: string;
  codigo_barras: string;
  setor?: string;
  quantidade?: number;
  data_vencimento?: string;
  is_encrypted?: boolean;
  ean_hash?: string | null;
  ciphertext?: string | null;
  iv?: string | null;
  plu?: string | null;
  codigo_fornecedor?: string | null;
  criado_em?: number;
}

export interface SavedProductRef {
  id: string;
  ean_hash: string | null;
}

/** Remove chaves vazias para não sobrescrever colunas com NULL indevido. */
function cleanRow(row: ProductWriteRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(row).forEach(([key, value]) => {
    if (value === undefined) return;
    out[key] = value;
  });
  return out;
}

/**
 * Grava produtos em lote.
 * Retorna as referências (id / ean_hash) gravadas.
 */
export async function upsertProductRows(
  client: SupabaseClient,
  rows: ProductWriteRow[]
): Promise<SavedProductRef[]> {
  if (rows.length === 0) return [];

  const payload = rows.map(cleanRow);

  // Caminho principal: uma unica chamada HTTP por lote, atomica no banco.
  const { data, error } = await client.rpc('fn_upsert_produtos', { p_rows: payload });

  if (!error && Array.isArray(data)) {
    return (data as unknown as SavedProductRef[]).map(item => ({
      id: String(item?.id ?? ''),
      ean_hash: item?.ean_hash ?? null,
    }));
  }

  // Fallback: upsert direto, exigindo todas as colunas NOT NULL no payload.
  const complete = payload.map(row => ({
    id: row.id ?? crypto.randomUUID(),
    nome: row.nome,
    codigo_barras: row.codigo_barras,
    setor: row.setor ?? 'MERCEARIA',
    quantidade: Number(row.quantidade ?? 0),
    data_vencimento:
      row.data_vencimento ??
      new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    loja_id: row.loja_id,
    is_encrypted: row.is_encrypted ?? true,
    ean_hash: row.ean_hash ?? null,
    ciphertext: row.ciphertext ?? null,
    iv: row.iv ?? null,
    plu: row.plu ?? null,
    codigo_fornecedor: row.codigo_fornecedor ?? null,
    criado_em: Number(row.criado_em ?? Date.now()),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data: saved, error: upsertError } = await client
    .from('produtos')
    .upsert(complete, { onConflict: 'id' })
    .select('id, ean_hash');

  if (upsertError) {
    console.warn('[productWrite] Upsert em lote indisponível, usando fallback:', upsertError.message);
    // Ultimo recurso: gravacao registro a registro (comportamento original).
    const savedRefs: SavedProductRef[] = [];
    for (const row of complete) {
      const { data: single, error: singleError } = await client
        .from('produtos')
        .upsert(row, { onConflict: 'id' })
        .select('id, ean_hash')
        .maybeSingle();
      if (singleError) throw singleError;
      if (single) {
        savedRefs.push({ id: String(single.id), ean_hash: single.ean_hash ?? null });
      }
    }
    return savedRefs;
  }

  return ((saved || []) as unknown as SavedProductRef[]).map(item => ({
    id: String(item?.id ?? ''),
    ean_hash: item?.ean_hash ?? null,
  }));
}

/**
 * Grava no catálogo universal apenas EANs ainda inexentes e faz o backfill
 * de `ean_hash` dos registros legados (tudo em uma chamada por lote).
 */
export async function upsertCatalogRows(
  client: SupabaseClient,
  rows: Array<{ codigo_barras: string; nome: string; ean_hash: string }>
): Promise<void> {
  if (rows.length === 0) return;

  const payload = rows
    .filter(row => row.codigo_barras && row.nome && row.ean_hash)
    .map(row => ({
      codigo_barras: row.codigo_barras,
      nome: row.nome,
      ean_hash: row.ean_hash,
    }));

  if (payload.length === 0) return;

  const { error } = await client.rpc('fn_upsert_catalogo_universal', { p_rows: payload });
  if (!error) return;

  // Fallback: upsert direto por codigo_barras (chave primaria do catalogo).
  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500);
    const { error: upsertError } = await client
      .from('produtos_catalogo_universal')
      .upsert(
        chunk.map(row => ({ ...row, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() })),
        { onConflict: 'codigo_barras' }
      );
    if (upsertError) {
      console.warn('[productWrite] Falha ao gravar no catálogo universal:', upsertError.message);
      return;
    }
  }
}
