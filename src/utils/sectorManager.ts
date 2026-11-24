import type { AuthUser } from '../types';

export function isSectorManager(user: AuthUser | null): boolean {
  return Boolean(user?.loja_id && user.setor && user.setor.trim().toUpperCase() !== 'GERAL' &&
    /^gestor de setor(?:\s*-\s*.+)?$/i.test(user.cargoCompleto?.trim() || ''));
}
