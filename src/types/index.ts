export type UrgencyStatus = 'urgent' | 'warning' | 'ok';

export type AuditStatus = 'Concluída' | 'Em Andamento' | 'Pendente';

export type TabId = 'inicio' | 'validade' | 'estoque' | 'auditoria' | 'configuracoes';

export interface Product {
  id: string;
  ean: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  location: string;
  lastUpdated?: string;
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
  type: 'ADD_PRODUCT' | 'UPDATE_STOCK' | 'ADD_VALIDITY' | 'ADD_AUDIT' | 'APPLY_DISCOUNT';
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
