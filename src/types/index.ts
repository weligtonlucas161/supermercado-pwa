export type UrgencyStatus = 'urgent' | 'warning' | 'ok';

export type AuditStatus = 'Concluída' | 'Em Andamento' | 'Pendente';

export type TabId = 'inicio' | 'validade' | 'estoque' | 'auditoria' | 'loja' | 'configuracoes';

export type SetorLoja = 'FRIOS' | 'AÇOUGUE' | 'PEIXARIA' | 'MERCEARIA' | 'PADARIA' | 'BAZAR';

export const SETORES_DISPONIVEIS: SetorLoja[] = [
  'FRIOS',
  'AÇOUGUE',
  'PEIXARIA',
  'MERCEARIA',
  'PADARIA',
  'BAZAR',
];

export interface Product {
  id: string;
  name: string;
  ean: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  costPrice?: number;
  expirationDate?: string;
  batch?: string;
  location?: string;
  lastUpdated?: string;
  reducedCode?: string;
  supplierCode?: string;
  sector?: string;
  loja_id?: string;
  isEncrypted?: boolean;
  isEncryptedInStorage?: boolean;
  encryptedPayload?: { iv?: string; ciphertext?: string; [key: string]: unknown };
  data_vencimento?: string;
}

export interface SpreadsheetProductItem {
  id?: string;
  name: string;
  supplierCode?: string;
  reducedCode?: string;
  ean: string;
  quantity: number;
  sector?: SetorLoja;
  setor?: SetorLoja;
  isValid?: boolean;
  errors?: string[];
}

/**
 * Interface de Lojas (Multi-tenant)
 */
export interface Store {
  id: string;
  nome_loja: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  limite_usuarios: number;
  ativa: boolean;
  cor_primaria?: string;
  created_at?: string;
}

/**
 * Cargos personalizados de Loja
 */
export interface StoreRole {
  id: string;
  loja_id: string;
  nome: string;
  descricao?: string;
  permissoes: {
    setores_permitidos?: string[]; // vazia = todos ou ['FRIOS', 'AÇOUGUE', etc.]
    pode_auditar?: boolean;
    pode_ajustar_estoque?: boolean;
    pode_importar_planilha?: boolean;
    pode_gerenciar_validade?: boolean;
  };
}

/**
 * Funcionários cadastrados pelo Gerente da Loja
 */
export interface StoreEmployee {
  id: string;
  matricula: string;
  nome: string;
  senha?: string;
  cargo: string;
  cargo_id?: string;
  setor_restrito?: string; // 'TODOS' ou setor específico e.g. 'MERCEARIA', 'FRIOS'
  loja_id: string;
  ativo: boolean;
  primeiro_login?: boolean;
  created_at?: string;
}

export interface AuthUser {
  id: string;
  matricula: string;
  nome: string;
  cargo: 'saas_admin' | 'gerente' | 'adm' | 'master' | 'operador';
  setor?: string;
  loja_id: string;
  loja_nome?: string;
  primeiro_login?: boolean;
}

export interface LoginResult {
  success: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
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
  type?: 'PRESENCA' | 'INVENTARIO' | 'VALIDADE';
  totalItems?: number;
  confirmedItems?: number;
  pendingItems?: number;
  presenceRate?: string;
  confirmedList?: Array<{ 
    name: string; 
    ean: string; 
    scannedAt: string; 
    scannedBy?: string;
    reducedCode?: string;
    supplierCode?: string;
  }>;
  pendingList?: Array<{ 
    name: string; 
    ean: string;
    reducedCode?: string;
    supplierCode?: string;
    stock?: number;
    minStock?: number;
  }>;
  ruptureList?: Array<{
    name: string;
    ean: string;
    stock: number;
    minStock: number;
    reason?: string;
  }>;
}

export interface Operator {
  id: string;
  name: string;
  code: string;         // Matrícula
  matricula?: string;
  role: 'saas_admin' | 'gerente' | 'adm' | 'master' | 'operador';
  store: string;
  loja_id: string;      // ID da loja vinculada
  shift: string;
  setor_restrito?: string;
  primeiro_login?: boolean;
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
