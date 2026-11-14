/**
 * @license
 * Arquivo: scripts/recrypt-acervo.mjs
 *
 * Script de recriptografia e saneamento de acervo legado.
 * Cifra em lote (AES-256 via CryptoJS) os campos sensíveis que ainda
 * estejam em texto claro e recalcula o ean_hash determinístico (HMAC-SHA256).
 *
 * Uso:
 *   node scripts/recrypt-acervo.mjs
 */

import 'dotenv/config';
import CryptoJS from 'crypto-js';
import { createHmac, createHash } from 'node:crypto';

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const ENCRYPTION_KEY = process.env.VITE_ENCRYPTION_KEY || '';
const EAN_PEPPER = process.env.VITE_EAN_HASH_PEPPER || ENCRYPTION_KEY;
const CONCURRENCY = 25;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[ERRO] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não informados no .env');
  process.exit(1);
}

if (!ENCRYPTION_KEY) {
  console.error('[ERRO] VITE_ENCRYPTION_KEY não configurada no .env');
  process.exit(1);
}

function isEncrypted(val) {
  return typeof val === 'string' && val.startsWith('U2FsdGVk');
}

function encrypt(val) {
  if (val === null || val === undefined || val === '') return val;
  const str = String(val).trim();
  if (!str) return str;
  if (isEncrypted(str)) return str;
  return CryptoJS.AES.encrypt(str, ENCRYPTION_KEY).toString();
}

function sanitizeBarcode(val, maxLen = 32) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[^a-zA-Z0-9]/g, '').trim().slice(0, maxLen);
}

function hashEan(rawEan) {
  const ean = sanitizeBarcode(rawEan);
  if (!ean) return null;
  const payload = `v1:${ean}`;
  if (EAN_PEPPER) {
    const hmac = createHmac('sha256', EAN_PEPPER);
    hmac.update(payload);
    return `h1:${hmac.digest('hex')}`;
  }
  const hash = createHash('sha256');
  hash.update(payload);
  return `h0:${hash.digest('hex')}`;
}

async function request(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: options.prefer || 'return=representation',
    ...options.headers,
  };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status} em ${path}: ${errText}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function runConcurrent(items, fn, concurrency = CONCURRENCY) {
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function recryptProdutos() {
  console.log('--- Verificando: produtos ---');
  const rows = await request(`produtos?nome=not.like.U2FsdGVk*&select=id,nome,codigo_barras,codigo_barras_secundario,plu,codigo_fornecedor,locked_by,ean_hash&limit=1000`);
  if (!rows || rows.length === 0) {
    console.log('[OK] produtos: todos os registros já estão cifrados.');
    return;
  }

  console.log(`produtos: ${rows.length} registros pendentes de cifragem...`);
  await runConcurrent(rows, async (r) => {
    const updates = { is_encrypted: true };
    if (r.codigo_barras && !isEncrypted(r.codigo_barras)) {
      updates.codigo_barras = encrypt(r.codigo_barras);
      updates.ean_hash = hashEan(r.codigo_barras);
    }
    if (r.nome && !isEncrypted(r.nome)) updates.nome = encrypt(r.nome);
    if (r.codigo_barras_secundario && !isEncrypted(r.codigo_barras_secundario)) updates.codigo_barras_secundario = encrypt(r.codigo_barras_secundario);
    if (r.plu && !isEncrypted(r.plu)) updates.plu = encrypt(r.plu);
    if (r.codigo_fornecedor && !isEncrypted(r.codigo_fornecedor)) updates.codigo_fornecedor = encrypt(r.codigo_fornecedor);
    if (r.locked_by && !isEncrypted(r.locked_by)) updates.locked_by = encrypt(r.locked_by);

    await request(`produtos?id=eq.${encodeURIComponent(r.id)}`, {
      method: 'PATCH',
      body: updates,
      prefer: 'return=minimal',
    });
  });
  console.log(`[OK] produtos: ${rows.length} registros recifrados.`);
}

async function recryptCatalogoUniversal() {
  console.log('--- Verificando: produtos_catalogo_universal ---');
  while (true) {
    const rows = await request(`produtos_catalogo_universal?codigo_barras=not.like.U2FsdGVk*&select=codigo_barras,nome,ean_hash&limit=200`);
    if (!rows || rows.length === 0) break;

    console.log(`produtos_catalogo_universal: processando lote de ${rows.length}...`);
    await runConcurrent(rows, async (r) => {
      const novoHash = hashEan(r.codigo_barras);
      const novoNome = encrypt(r.nome);
      const novoEan = encrypt(r.codigo_barras);

      await request(`produtos_catalogo_universal?codigo_barras=eq.${encodeURIComponent(r.codigo_barras)}`, {
        method: 'PATCH',
        body: {
          nome: novoNome,
          codigo_barras: novoEan,
          ean_hash: novoHash,
        },
        prefer: 'return=minimal',
      });
    });
  }
  console.log('[OK] produtos_catalogo_universal: 100% recifrado.');
}

async function recryptLojas() {
  console.log('--- Verificando: lojas ---');
  const rows = await request('lojas?select=id,cnpj,endereco,telefone');
  for (const r of rows || []) {
    const updates = {};
    let changed = false;
    if (r.cnpj && !isEncrypted(r.cnpj)) { updates.cnpj = encrypt(r.cnpj); changed = true; }
    if (r.endereco && !isEncrypted(r.endereco)) { updates.endereco = encrypt(r.endereco); changed = true; }
    if (r.telefone && !isEncrypted(r.telefone)) { updates.telefone = encrypt(r.telefone); changed = true; }

    if (changed) {
      await request(`lojas?id=eq.${encodeURIComponent(r.id)}`, {
        method: 'PATCH',
        body: updates,
        prefer: 'return=minimal',
      });
    }
  }
  console.log('[OK] lojas: verificado e saneado.');
}

async function recryptAuditorias() {
  console.log('--- Verificando: auditoria_presenca_bips ---');
  while (true) {
    const rows = await request(`auditoria_presenca_bips?codigo_barras=not.like.U2FsdGVk*&select=id,codigo_barras,produto_nome,operador_nome&limit=200`);
    if (!rows || rows.length === 0) break;

    await runConcurrent(rows, async (r) => {
      const updates = {};
      if (r.codigo_barras && !isEncrypted(r.codigo_barras)) updates.codigo_barras = encrypt(r.codigo_barras);
      if (r.produto_nome && !isEncrypted(r.produto_nome)) updates.produto_nome = encrypt(r.produto_nome);
      if (r.operador_nome && !isEncrypted(r.operador_nome)) updates.operador_nome = encrypt(r.operador_nome);

      await request(`auditoria_presenca_bips?id=eq.${encodeURIComponent(r.id)}`, {
        method: 'PATCH',
        body: updates,
        prefer: 'return=minimal',
      });
    });
  }
  console.log('[OK] auditoria_presenca_bips: 100% recifrado.');

  console.log('--- Verificando: auditoria_produtos ---');
  while (true) {
    const rows = await request(`auditoria_produtos?nome=not.like.U2FsdGVk*&select=id,codigo_barras,nome,operador_nome,plu&limit=300`);
    if (!rows || rows.length === 0) break;

    console.log(`auditoria_produtos: processando lote de ${rows.length}...`);
    await runConcurrent(rows, async (r) => {
      const updates = {};
      if (r.codigo_barras && !isEncrypted(r.codigo_barras)) updates.codigo_barras = encrypt(r.codigo_barras);
      if (r.nome && !isEncrypted(r.nome)) updates.nome = encrypt(r.nome);
      if (r.operador_nome && !isEncrypted(r.operador_nome)) updates.operador_nome = encrypt(r.operador_nome);
      if (r.plu && !isEncrypted(r.plu)) updates.plu = encrypt(r.plu);

      await request(`auditoria_produtos?id=eq.${encodeURIComponent(r.id)}`, {
        method: 'PATCH',
        body: updates,
        prefer: 'return=minimal',
      });
    });
  }
  console.log('[OK] auditoria_produtos: 100% recifrado.');
}

async function main() {
  console.log('Iniciando recriptografia concorrente do acervo...');
  await recryptProdutos();
  await recryptCatalogoUniversal();
  await recryptLojas();
  await recryptAuditorias();
  console.log('=== Recriptografia concluída com sucesso! ===');
}

main().catch(err => {
  console.error('[FALHA CRÍTICA]', err);
  process.exit(1);
});
