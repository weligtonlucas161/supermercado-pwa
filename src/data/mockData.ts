import { Product, ValidityItem, AuditItem, Operator, NotificationItem } from '../types';

// Lista inicial vazia conforme solicitação (sem produtos mockados para testes reais)
export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_VALIDITIES: ValidityItem[] = [];

export const INITIAL_AUDITS: AuditItem[] = [];

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
  AUTH_USER: 'superpwa_auth_user_v1',
  AUTH_TOKEN: 'superpwa_auth_token_v1',
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
