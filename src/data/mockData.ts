import { Product, ValidityItem, AuditItem, Operator, NotificationItem } from '../types';

// Lista inicial vazia conforme solicitação (sem produtos mockados para testes reais)
export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_VALIDITIES: ValidityItem[] = [];

export const INITIAL_AUDITS: AuditItem[] = [];

export const INITIAL_OPERATOR: Operator = {
  id: '',
  name: '',
  code: '',
  matricula: '',
  role: 'operador',
  store: '',
  loja_id: '',
  shift: '',
};

// Sem notificações simuladas - apenas eventos reais do sistema
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

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
  ACTIVE_TAB: 'superpwa_active_tab_v1',
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
