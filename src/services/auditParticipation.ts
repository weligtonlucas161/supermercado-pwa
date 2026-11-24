import { AUDIT_SESSION_MAX_INACTIVITY_MS } from './supabaseService';

export type AuditParticipation = {
  type: 'VALIDADE' | 'PRESENCA' | 'INVENTARIO';
  startedAt: number;
  store: string;
  sector: string;
  sessionId?: string;
  selected?: string[];
  confirmed?: string[];
};

export function readAuditParticipation(key: string): AuditParticipation | null {
  if (!key) return null;
  try {
    const entry = JSON.parse(localStorage.getItem(key) || 'null') as AuditParticipation | null;
    if (entry && Number.isFinite(entry.startedAt) && Date.now() - entry.startedAt < AUDIT_SESSION_MAX_INACTIVITY_MS) return entry;
  } catch {
    return null;
  }
  return null;
}

export function writeAuditParticipation(key: string, entry: AuditParticipation | null) {
  if (!key) return;
  if (entry) localStorage.setItem(key, JSON.stringify(entry));
  else localStorage.removeItem(key);
}
