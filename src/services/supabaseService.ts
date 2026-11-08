import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, ValidityItem, AuditItem } from '../types';

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
      message: 'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.',
    };
  }

  try {
    const { error } = await client.from('products').select('id').limit(1);
    if (error) throw error;
    return {
      success: true,
      message: 'Conexão com o banco Supabase estabelecida com sucesso!',
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
 * Importa múltiplos produtos para o Supabase (usando a RPC criada ou upsert na tabela)
 */
export async function importProductsToSupabase(
  products: Array<Omit<Product, 'id'> & { id?: string }>,
  overwrite = true
): Promise<{ success: boolean; importedCount: number; error?: string }> {
  if (!client) {
    // Modo local / offline
    return { success: true, importedCount: products.length };
  }

  try {
    const payload = products.map(p => ({
      ean: p.ean.trim(),
      name: p.name.trim(),
      category: p.category || 'Mercearia',
      stock: Number(p.stock) || 0,
      min_stock: Number(p.minStock) || 10,
      price: Number(p.price) || 0,
      location: p.location || 'Gôndola',
    }));

    // Tentar via Stored Procedure
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

    // Fallback: upsert direto na tabela products
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
