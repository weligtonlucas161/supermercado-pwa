import type { Product } from '../types';
import { getCacheKey } from './encryptedCache';

const storeName = 'products';
const maxAgeMs = 4 * 60 * 60 * 1000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let connection: Promise<IDBDatabase> | undefined;

interface CatalogRecord {
  scope: string;
  id: string;
  order: number;
  expiresAt: number;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
}

function openCatalog(): Promise<IDBDatabase> {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('superpwa-encrypted-catalog', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(storeName, { keyPath: ['scope', 'id'] });
        store.createIndex('scope', 'scope');
        store.createIndex('expiresAt', 'expiresAt');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => {
      connection = undefined;
      throw error;
    });
  }
  return connection;
}

function readRecords(db: IDBDatabase, scope: string): Promise<CatalogRecord[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).index('scope').getAll(scope);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const aad = (scope: string, id: string) => encoder.encode(JSON.stringify([scope, id]));

export function catalogCacheScope(user: { id: string; loja_id?: string; cargo?: string; setor?: string; codigo_fornecedor?: string } | null): string {
  if (!user?.id || !user.loja_id) return '';
  return JSON.stringify([user.loja_id, user.id, user.cargo, user.setor, user.codigo_fornecedor]);
}

export async function readCatalogCache(scope: string): Promise<Product[]> {
  const db = await openCatalog();
  const rows = await readRecords(db, scope);
  const key = await getCacheKey();
  const now = Date.now();
  const result: Product[] = [];
  for (const row of rows.sort((a, b) => a.order - b.order)) {
    if (row.expiresAt <= now) continue;
    try {
      const clear = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: row.iv, additionalData: aad(scope, row.id) }, key, row.ciphertext
      );
      result.push(JSON.parse(decoder.decode(clear)) as Product);
    } catch {
      // As entradas ficam ilegíveis após mudança da chave da sessão.
    }
  }
  return result;
}

export async function persistCatalogChanges(scope: string, previous: Product[], products: Product[]): Promise<void> {
  const db = await openCatalog();
  const expiresAt = Date.now() + maxAgeMs;
  const previousById = new Map(previous.map(product => [product.id, product]));
  const knownIds = new Set(products.map(product => product.id));
  const obsolete = previous.length
    ? previous.filter(product => !knownIds.has(product.id)).map(product => product.id)
    : (await readRecords(db, scope)).filter(row => !knownIds.has(row.id)).map(row => row.id);
  const key = await getCacheKey();
  const changed: CatalogRecord[] = [];

  for (const [order, product] of products.entries()) {
    if (previousById.get(product.id) === product) continue;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad(scope, product.id) }, key, encoder.encode(JSON.stringify(product))
    );
    changed.push({ scope, id: product.id, order, expiresAt, iv, ciphertext });
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    for (const id of obsolete) store.delete([scope, id]);
    for (const row of changed) store.put(row);
    const expired = store.index('expiresAt').openCursor(IDBKeyRange.upperBound(Date.now()));
    expired.onsuccess = () => {
      const cursor = expired.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  });
}
