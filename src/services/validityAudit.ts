import { getDbClient } from './db/client';

export interface ValidityCount {
  product_id: string;
  expires_on: string;
  quantity: number;
}

export async function readValidityCounts(store: string, product?: string): Promise<ValidityCount[]> {
  const db = getDbClient();
  if (!db || !store) throw new Error('Conexão com a loja indisponível.');
  const result: ValidityCount[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from('validity_audit_counts').select('product_id,expires_on,quantity')
      .eq('store_id', store).order('product_id').order('expires_on')
      .range(offset, offset + pageSize - 1);
    if (product) query = query.eq('product_id', product);
    const { data, error } = await query;
    if (error) throw error;
    result.push(...data);
    if (data.length < pageSize) return result;
  }
}

export async function saveValidityCount(
  store: string, product: string, date: string, quantity: number, expected: number, add: boolean
): Promise<boolean> {
  const db = getDbClient();
  if (!db || !store) throw new Error('Conexão com a loja indisponível.');
  const { data, error } = await db.rpc('save_validity_audit_count', {
    p_store: store, p_product: product, p_date: date, p_quantity: quantity, p_expected: expected, p_add: add,
  });
  if (error) throw error;
  return typeof data === 'number';
}

export function formatValidityDate(date: string): string {
  return date.split('-').reverse().join('/');
}
