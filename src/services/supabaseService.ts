import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, ValidityItem, AuditItem, SpreadsheetProductItem } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://seu-projeto.supabase.co') {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn('Erro ao inicializar Supabase client:', err);
    client = null;
  }
}

export const supabase = client;

export function isSupabaseConfigured(): boolean {
  return !!client;
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!client) {
    return {
      success: false,
      message: 'Supabase operando em modo local/offline. Para sincronizar em nuvem, configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.',
    };
  }

  try {
    const { error } = await client.from('products').select('id').limit(1);
    if (error) throw error;
    return {
      success: true,
      message: 'Conexão com o banco de dados Supabase estabelecida com sucesso!',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Erro na conexão: ${msg}`,
    };
  }
}

/**
 * Upload em Realtime dos Produtos Criptografados (com as 5 colunas protegidas)
 */
export async function uploadEncryptedProductsRealtime(
  items: Array<{
    original: SpreadsheetProductItem;
    encrypted: { ciphertext: string; iv: string };
  }>,
  onRealtimeProgress?: (uploadedCount: number, total: number, percent: number) => void
): Promise<{ success: boolean; totalUploaded: number; error?: string }> {
  const total = items.length;

  if (!client) {
    // Simulação de upload em tempo real quando operando em modo local
    for (let i = 0; i < total; i++) {
      if (onRealtimeProgress && (i % 2 === 0 || i === total - 1)) {
        const cur = i + 1;
        onRealtimeProgress(cur, total, Math.round((cur / total) * 100));
        await new Promise(r => setTimeout(r, 15));
      }
    }
    return { success: true, totalUploaded: total };
  }

  try {
    const batchSize = 10;
    let uploaded = 0;

    for (let i = 0; i < total; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);

      const payload = chunk.map(c => ({
        ean: c.original.ean,
        name: c.original.name,
        supplier_code: c.original.supplierCode,
        reduced_code: c.original.reducedCode,
        stock: c.original.quantity,
        is_encrypted: true,
        ciphertext: c.encrypted.ciphertext,
        iv: c.encrypted.iv,
      }));

      const { error } = await client.from('products').upsert(payload, { onConflict: 'ean' });
      if (error) {
        console.warn('Erro parcial no chunk Supabase:', error);
      }

      uploaded += chunk.length;
      if (onRealtimeProgress) {
        const pct = Math.round((uploaded / total) * 100);
        onRealtimeProgress(uploaded, total, pct);
      }
    }

    return { success: true, totalUploaded: uploaded };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Falha no upload criptografado:', msg);
    return { success: false, totalUploaded: 0, error: msg };
  }
}

/**
 * Importa múltiplos produtos para o Supabase (usando a RPC criada ou upsert na tabela)
 */
export async function importProductsToSupabase(
  products: Array<Omit<Product, 'id'> & { id?: string }>,
  overwrite = true
): Promise<{ success: boolean; importedCount: number; error?: string }> {
  if (!client) {
    return { success: true, importedCount: products.length };
  }

  try {
    const payload = products.map(p => ({
      ean: p.ean.trim(),
      name: p.name.trim(),
      supplier_code: p.supplierCode || '',
      reduced_code: p.reducedCode || '',
      category: p.category || 'Mercearia',
      stock: Number(p.stock) || 0,
      min_stock: Number(p.minStock) || 10,
      price: Number(p.price) || 0,
      location: p.location || 'Gôndola',
      is_encrypted: p.isEncryptedInStorage || false,
      ciphertext: p.encryptedPayload?.ciphertext || null,
      iv: p.encryptedPayload?.iv || null,
    }));

    const { data, error } = await client.rpc('import_products_bulk', {
      products_payload: payload,
      overwrite_existing: overwrite,
    });

    if (!error && data) {
      return {
        success: true,
        importedCount: data.total_processed || products.length,
      };
    }

    const { error: upsertError } = await client
      .from('products')
      .upsert(payload, { onConflict: 'ean' });

    if (upsertError) throw upsertError;

    return { success: true, importedCount: products.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Falha ao importar para o Supabase:', msg);
    return { success: false, importedCount: 0, error: msg };
  }
}

/**
 * Salva um lote de validade no Supabase
 */
export async function saveValidityToSupabase(validity: ValidityItem): Promise<boolean> {
  if (!client) return true;

  try {
    const { error } = await client.from('validities').insert({
      product_name: validity.name,
      batch: validity.batch,
      due_date: validity.dueDate,
      quantity: validity.quantity,
      status: validity.status,
      discount_applied: validity.discountApplied || false,
    });
    return !error;
  } catch (err) {
    console.warn('Erro ao salvar validade no Supabase:', err);
    return false;
  }
}
