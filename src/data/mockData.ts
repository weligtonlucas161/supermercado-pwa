import { Product, ValidityItem, AuditItem, Operator, NotificationItem } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  { id: '1', ean: '7891000100011', name: 'Leite Integral 1L', category: 'Laticínios', stock: 142, minStock: 50, price: 4.89, location: 'Corredor 2 - Prateleira A' },
  { id: '2', ean: '7891000100028', name: 'Iogurte Natural 170g', category: 'Laticínios', stock: 18, minStock: 30, price: 3.29, location: 'Geladeira 4' },
  { id: '3', ean: '7891000100035', name: 'Arroz Tipo 1 5kg', category: 'Mercearia', stock: 85, minStock: 40, price: 24.90, location: 'Corredor 5 - Palete 1' },
  { id: '4', ean: '7891000100042', name: 'Feijão Preto 1kg', category: 'Mercearia', stock: 12, minStock: 25, price: 7.49, location: 'Corredor 5 - Prateleira C' },
  { id: '5', ean: '7891000100059', name: 'Café Torrado 500g', category: 'Mercearia', stock: 64, minStock: 20, price: 16.99, location: 'Corredor 4 - Prateleira B' },
  { id: '6', ean: '7891000100066', name: 'Sabão em Pó 1kg', category: 'Limpeza', stock: 30, minStock: 15, price: 12.50, location: 'Corredor 8 - Prateleira A' },
  { id: '7', ean: '7891000100073', name: 'Azeite de Oliva Extra Virgem 500ml', category: 'Mercearia', stock: 19, minStock: 20, price: 38.90, location: 'Corredor 3 - Prateleira B' },
  { id: '8', ean: '7891000100080', name: 'Queijo Mussarela Fatiado 200g', category: 'Laticínios', stock: 14, minStock: 25, price: 11.90, location: 'Geladeira 2' },
];

export const INITIAL_VALIDITIES: ValidityItem[] = [
  { id: 'v1', productId: '2', name: 'Iogurte Natural 170g', batch: 'L-9942', dueDate: '2026-11-10', quantity: 18, status: 'urgent' },
  { id: 'v2', productId: '1', name: 'Leite Integral 1L', batch: 'L-8821', dueDate: '2026-11-18', quantity: 45, status: 'warning' },
  { id: 'v3', productId: '5', name: 'Café Torrado 500g', batch: 'L-1022', dueDate: '2026-12-05', quantity: 20, status: 'ok' },
  { id: 'v4', productId: '4', name: 'Feijão Preto 1kg', batch: 'L-5541', dueDate: '2026-11-12', quantity: 12, status: 'urgent' },
  { id: 'v5', productId: '8', name: 'Queijo Mussarela Fatiado 200g', batch: 'L-3310', dueDate: '2026-11-11', quantity: 14, status: 'urgent' },
];

export const INITIAL_AUDITS: AuditItem[] = [
  { id: 'a1', title: 'Auditoria Matinal - Laticínios', date: '2026-11-07', itemsCount: 24, status: 'Concluída', auditor: 'Carlos Silva', department: 'Laticínios', discrepanciesCount: 1 },
  { id: 'a2', title: 'Conferência de Ruptura - Corredor 5', date: '2026-11-07', itemsCount: 15, status: 'Em Andamento', auditor: 'Ana Maria', department: 'Mercearia', discrepanciesCount: 3 },
  { id: 'a3', title: 'Auditoria Semanal - Limpeza', date: '2026-11-05', itemsCount: 40, status: 'Concluída', auditor: 'Carlos Silva', department: 'Limpeza', discrepanciesCount: 0 },
];

export const INITIAL_OPERATOR: Operator = {
  id: 'usr_op_carlos_4092',
  name: 'Carlos Silva',
  code: '4092',
  matricula: '4092',
  role: 'operador',
  store: 'Supermercado Silva - Loja 01 (Matriz)',
  loja_id: 'loja_padrao_001',
  shift: 'Manhã (07:00 - 15:20)',
};

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Risco de Ruptura - Feijão Preto 1kg',
    message: 'Estoque atual (12 un) está abaixo do mínimo configurado (25 un).',
    type: 'warning',
    timestamp: 'Há 15 min',
    read: false,
  },
  {
    id: 'n2',
    title: 'Lote Crítico - Iogurte Natural 170g',
    message: 'Lote L-9942 vence em menos de 72 horas. Recomenda-se aplicar desconto.',
    type: 'urgent',
    timestamp: 'Há 32 min',
    read: false,
  },
  {
    id: 'n3',
    title: 'Auditoria Agendada',
    message: 'Conferência cega de carnes e perecíveis programada para as 14:00.',
    type: 'info',
    timestamp: 'Há 1 hora',
    read: true,
  },
];

const STORAGE_KEYS = {
  PRODUCTS: 'superpwa_products_v1',
  VALIDITIES: 'superpwa_validities_v1',
  AUDITS: 'superpwa_audits_v1',
  OPERATOR: 'superpwa_operator_v1',
  NOTIFICATIONS: 'superpwa_notifications_v1',
  OFFLINE_QUEUE: 'superpwa_offline_queue_v1',
  DARK_MODE: 'superpwa_darkmode_v1',
};

export function loadStoredData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveStoredData<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }
}

export { STORAGE_KEYS };
