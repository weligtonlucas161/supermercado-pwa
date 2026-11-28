import type { SpreadsheetProductItem } from '../types';
import { encryptProductList } from '../utils/crypto';
import { invalidateStockCache } from '../utils/encryptedCache';
import { encryptSingleField } from '../utils/encryptionUtils';
import { hashEanBatch } from '../utils/productHash';
import { getDbClient } from './db/client';
import { invalidateProductIndex } from './db/productIndex';

export type StockImportMode = 'baseline' | 'update';

export interface StockImportSummary {
  total: number;
  new: number;
  out: number;
  in: number;
  restocked: number;
  unchanged: number;
  zeroed: number;
  still_zero: number;
  absent: number;
  large_reduction: boolean;
}

export interface StockImportEntry {
  id: string;
  filename: string;
  mode: StockImportMode;
  applied_at: string;
  reverted_at: string | null;
  summary: StockImportSummary;
}

export interface StockMovement {
  id: string;
  filename: string;
  applied_at: string;
  reverted_at: string | null;
  previous: number | null;
  current: number;
  movement: keyof typeof movementLabels;
  unchanged_since: string | null;
}

export const movementLabels = {
  baseline: 'Estoque inicial',
  new: 'Produto novo',
  out: 'Saída',
  in: 'Reposição',
  restocked: 'Reabastecido',
  unchanged: 'Sem movimentação',
  zeroed: 'Estoque zerado',
  still_zero: 'Permanece zerado',
};

export async function stockImportRequest<T>(
  action: string, store: string, id: string | null = null, payload: unknown = {},
): Promise<T> {
  const client = getDbClient();
  if (!client || !store) throw new Error('Conecte-se à loja para usar a importação de estoque.');
  const { data, error } = await client.rpc('stock_import', {
    p_action: action, p_store: store, p_id: id, p_data: payload,
  });
  if (error) {
    if (error.code === '23505') throw new Error('Existem códigos de barras duplicados na planilha.');
    if (error.code === '55P03') throw new Error('O estoque está sendo atualizado. Tente novamente em instantes.');
    throw new Error(error.message);
  }
  return data as T;
}

export async function prepareStockImport(
  store: string, filename: string, mode: StockImportMode, items: SpreadsheetProductItem[],
  onProgress: (percent: number) => void,
) {
  if (!items.length || items.some(item => !item.isValid)) {
    throw new Error('Corrija todas as linhas inválidas antes de importar o estoque da loja.');
  }
  if (new Set(items.map(item => item.ean)).size !== items.length) {
    throw new Error('Existem códigos de barras duplicados na planilha.');
  }
  const id = crypto.randomUUID();
  await stockImportRequest('begin', store, id, { filename, mode, count: items.length });
  const chunkSize = 300;
  for (let offset = 0; offset < items.length; offset += chunkSize) {
    const chunk = items.slice(offset, offset + chunkSize);
    const [hashes, encrypted] = await Promise.all([
      hashEanBatch(chunk.map(item => item.ean)),
      encryptProductList(chunk),
    ]);
    const rows = encrypted.map(({ original, encrypted: payload }, index) => ({
      ean_hash: hashes[index],
      quantity: original.quantity,
      nome: encryptSingleField(original.name),
      codigo_barras: encryptSingleField(original.ean),
      plu: original.reducedCode ? encryptSingleField(original.reducedCode) : null,
      codigo_fornecedor: original.supplierCode ? encryptSingleField(original.supplierCode) : null,
      setor: original.setor,
      departamento: original.department ?? null,
      ...payload,
    }));
    await stockImportRequest('stage', store, id, rows);
    onProgress(Math.round((offset + chunk.length) * 100 / items.length));
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return { id, summary: await stockImportRequest<StockImportSummary>('preview', store, id) };
}

export async function saveStockImport(action: 'apply' | 'revert', store: string, id: string) {
  await stockImportRequest(action, store, id);
  invalidateStockCache(store);
  invalidateProductIndex(store);
}
