export type UrgencyStatus = 'urgent' | 'warning' | 'ok';

export type AuditStatus = 'Concluída' | 'Em Andamento' | 'Pendente';

export type TabId = 'inicio' | 'validade' | 'estoque' | 'auditoria' | 'configuracoes';

export interface Product {
  id: string;
  ean: string;                      // Código EAN
  name: string;                     // Descrição do produto
  supplierCode?: string;            // Código de fornecedor
  reducedCode?: string;             // Código reduzido
  category: string;
  stock: number;                    // Quantidade em estoque
  minStock: number;
  price: number;
  location: string;
  isEncryptedInStorage?: boolean;   // Indicador de que o registro foi cifrado antes do upload
  encryptedPayload?: {
    ciphertext: string;
    iv: string;
    encryptedAt?: string;
  };
  lastUpdated?: string;
}

/**
 * Modelo estrito das 5 colunas exigidas da planilha:
 * 1. Descrição do produto
 * 2. Código de fornecedor
 * 3. Código reduzido
 * 4. Código EAN
 * 5. Quantidade
 */
export interface SpreadsheetProductItem {
  name: string;             // Descrição do produto
  supplierCode: string;     // Código de fornecedor
  reducedCode: string;      // Código reduzido
  ean: string;              // Código EAN
  quantity: number;         // Quantidade
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
  code: string;
  role: string;
  store: string;
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
