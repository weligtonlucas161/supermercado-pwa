import 'dotenv/config';
import { MASTER_KEY, EAN_HASH_PEPPER, hasMasterKey, MASTER_KEY_MISSING_MESSAGE } from '../src/utils/keys';
import { encryptSingleField, decryptSingleField, isEncrypted } from '../src/utils/encryptionUtils';

console.log('=== TESTE DO FLUXO DE CIFRAGEM E RESOLUÇÃO DE CHAVES ===\n');

let failed = false;

// 1. Verificação de chave mestra
if (!hasMasterKey()) {
  console.error('❌ FALHA: hasMasterKey() retornou false');
  failed = true;
} else {
  console.log('✅ Chave mestra carregada com sucesso.');
  console.log(`   Comprimento da chave: ${MASTER_KEY.length} caracteres`);
}

// 2. Verificação do pepper de EAN
if (!EAN_HASH_PEPPER) {
  console.error('❌ FALHA: EAN_HASH_PEPPER está vazio');
  failed = true;
} else {
  console.log('✅ Pepper de EAN carregado com sucesso.');
}

// 3. Teste de Cifragem e Decifragem de Campos
const testCases = [
  { campo: 'EAN', valor: '7891000100103' },
  { campo: 'Nome', valor: 'LEITE CONDENSADO MOCA 395G' },
  { campo: 'PLU', valor: '12345' },
  { campo: 'Fornecedor', valor: 'NESTLE_BR' },
];

for (const tc of testCases) {
  try {
    const encrypted = encryptSingleField(tc.valor);
    if (!encrypted) {
      console.error(`❌ FALHA: Cifragem de ${tc.campo} retornou vazio`);
      failed = true;
      continue;
    }
    if (!isEncrypted(encrypted)) {
      console.error(`❌ FALHA: Resultado para ${tc.campo} não possui prefixo cifrado esperado`);
      failed = true;
      continue;
    }

    const decrypted = decryptSingleField(encrypted);
    if (decrypted !== tc.valor) {
      console.error(`❌ FALHA: Decifragem de ${tc.campo} divergente! Esperado="${tc.valor}", Obtido="${decrypted}"`);
      failed = true;
      continue;
    }

    console.log(`✅ [${tc.campo}] Cifrado e decifrado com sucesso: "${tc.valor}" -> "${encrypted.substring(0, 20)}..." -> "${decrypted}"`);
  } catch (err) {
    console.error(`❌ ERRO ao processar ${tc.campo}:`, err);
    failed = true;
  }
}

// 4. Teste de simulação de linha de importação de planilha
console.log('\n--- Testando preparação de lote de produtos (como feito em uploadEncryptedProductsRealtime) ---');
try {
  const mockProduct = {
    ean: '7891000248706',
    name: 'BISCOITO OREO ORIGINAL 90G',
    reducedCode: '9876',
    supplierCode: 'MONDELEZ',
    setor: 'MERCEARIA',
    quantity: 24,
  };

  const dbRow = {
    codigo_barras: encryptSingleField(mockProduct.ean),
    nome: encryptSingleField(mockProduct.name),
    plu: mockProduct.reducedCode ? encryptSingleField(mockProduct.reducedCode) : null,
    codigo_fornecedor: mockProduct.supplierCode ? encryptSingleField(mockProduct.supplierCode) : null,
    setor: mockProduct.setor,
    quantidade: mockProduct.quantity,
  };

  console.log('✅ Linha do banco preparada sem exceções:');
  console.log('   codigo_barras cifrado:', dbRow.codigo_barras.substring(0, 25) + '...');
  console.log('   nome cifrado:', dbRow.nome.substring(0, 25) + '...');
  console.log('   plu cifrado:', dbRow.plu?.substring(0, 25) + '...');
  console.log('   fornecedor cifrado:', dbRow.codigo_fornecedor?.substring(0, 25) + '...');

  // Verifica decifragem
  const decEan = decryptSingleField(dbRow.codigo_barras);
  const decNome = decryptSingleField(dbRow.nome);
  const decPlu = decryptSingleField(dbRow.plu);
  const decForn = decryptSingleField(dbRow.codigo_fornecedor);

  if (decEan === mockProduct.ean && decNome === mockProduct.name && decPlu === mockProduct.reducedCode && decForn === mockProduct.supplierCode) {
    console.log('✅ Todos os campos da linha foram decifrados perfeitamente.');
  } else {
    console.error('❌ FALHA na validação dos campos decifrados da linha do banco.');
    failed = true;
  }
} catch (err: any) {
  if (err?.message === MASTER_KEY_MISSING_MESSAGE) {
    console.error('❌ FALHA CRÍTICA: Erro MASTER_KEY_MISSING_MESSAGE disparado!');
  } else {
    console.error('❌ ERRO inesperado:', err);
  }
  failed = true;
}

if (failed) {
  console.error('\n❌ O teste falhou. Corrija os problemas antes de prosseguir.');
  process.exit(1);
} else {
  console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
  process.exit(0);
}
