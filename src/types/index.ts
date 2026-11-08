export type UrgencyStatus = 'urgent' | 'warning' | 'ok';

export type AuditStatus = 'Concluída' | 'Em Andamento' | 'Pendente';

export type TabId = 'inicio' | 'validade' | 'estoque' | 'auditoria' | 'configuracoes';

/**
 * Interface Produto sincronizada com a tabela 'produtos' e 'produtos_catalogo_universal'
 * do banco Synk (2026.1):
 * - id: TEXT
 * - nome: TEXT (Descrição do produto)
 * - codigo_barras: TEXT (Código EAN)
 * - plu: TEXT (Código reduzido)
 * - codigo_fornecedor: TEXT (Código de fornecedor)
 * - setor: TEXT
 * - quantidade: INTEGER (Quantidade em estoque)
 * - data_vencimento: TEXT (YYYY-MM-DD)
 * - loja_id: TEXT
 */
export interface Product {
  id: string;
  ean: string;                      // Código EAN (codigo_barras)
  name: string;                     // Descrição do produto (nome)
  supplierCode?: string;            // Código de fornecedor (codigo_fornecedor)
  reducedCode?: string;             // Código reduzido (plu)
  category: string;                 // Setor da loja (setor)
  stock: number;                    // Quantidade em estoque (quantidade)
  minStock: number;
  price: number;
  location: string;
  loja_id?: string;                 // Isolamento por loja
  data_vencimento?: string;         // YYYY-MM-DD
  isEncryptedInStorage?: boolean;   // Indicador de criptografia
  encryptedPayload?: {
    ciphertext: string;
    iv: string;
    encryptedAt?: string;
  };
  lastUpdated?: string;
}

/**
 * Modelo estrito das 5 colunas da planilha
 */
export interface SpreadsheetProductItem {
  name: string;             // 1. Descrição do produto
  supplierCode: string;     // 2. Código de fornecedor
  reducedCode: string;      // 3. Código reduzido
  ean: string;              // 4. Código EAN
  quantity: number;         // 5. Quantidade
  isValid: boolean;
  errors: string[];
}

export interface EncryptedProductUpload {
  ean: string;
  ciphertext: string;
  iv: string;
  createdAt: string;
}

export interface ValidityItem {
  id: string;
  productId: string;
  name: string;
  batch: string;
  dueDate: string;
  quantity: number;
  status: UrgencyStatus;
  discountApplied?: boolean;
}

export interface AuditItem {
  id: string;
  title: string;
  date: string;
  itemsCount: number;
  status: AuditStatus;
  auditor: string;
  department?: string;
  discrepanciesCount?: number;
}

export interface Operator {
  id: string;
  name: string;
  code: string;         // Matrícula
  matricula?: string;
  role: string;         // Cargo ('adm' | 'master' | 'operador')
  store: string;
  loja_id: string;      // ID da loja vinculada
  shift: string;
}

export interface OfflineAction {
  id: string;
  type: 'ADD_PRODUCT' | 'UPDATE_STOCK' | 'ADD_VALIDITY' | 'ADD_AUDIT' | 'APPLY_DISCOUNT' | 'IMPORT_ENCRYPTED_SPREADSHEET';
  payload: unknown;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'urgent' | 'warning' | 'info';
  timestamp: string;
  read: boolean;
}
