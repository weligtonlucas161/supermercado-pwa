import { Product, ValidityItem, AuditItem, Operator, NotificationItem } from '../types';

// Banco Local: Iniciando do zero conforme solicitação do usuário
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_VALIDITIES: ValidityItem[] = [];
export const INITIAL_AUDITS: AuditItem[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export const INITIAL_OPERATOR: Operator = {
  id: 'op-local-1',
  name: 'Administrador Local',
  code: 'admin',
  matricula: 'admin',
  role: 'gerente',
  store: 'Loja Principal',
  loja_id: 'loja-local-1',
  shift: 'Geral',
};

/**
 * Chaves de persistência para o Banco de Dados Local (localStorage / PWA Offline)
 */
export const STORAGE_KEYS = {
  PRODUCTS: 'superpwa_products_v1',
  VALIDITIES: 'superpwa_validities_v1',
  AUDITS: 'superpwa_audits_v1',
  OPERATOR: 'superpwa_operator_v1',
  NOTIFICATIONS: 'superpwa_notifications_v1',
  OFFLINE_QUEUE: 'superpwa_offline_queue_v1',
  AUTH_USER: 'superpwa_auth_user_v1',
  AUTH_TOKEN: 'superpwa_auth_token_v1',
  ACTIVE_TAB: 'superpwa_active_tab_v1',
  DARK_MODE: 'superpwa_darkmode_v1',
  SOUND_ENABLED: 'superpwa_sound_enabled',
  PREFERRED_SECTOR: 'superpwa_preferred_sector',
  AVARIAS: 'superpwa_avarias_estoque_v1',
  CHAT_MESSAGES: 'superpwa_chat_messages_v1',
  STORES: 'superpwa_stores_data',
  EMPLOYEES: 'superpwa_employees_data',
  ROLES: 'superpwa_roles_data',
} as const;

/**
 * Limpa apenas chaves temporárias obsoletas, preservando os dados do banco local
 */
export function purgeDomainLocalStorage(): void {
  // Mantido para compatibilidade sem apagar os dados locais do usuário
}

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
    console.warn('Falha ao gravar no localStorage:', err);
  }
}
