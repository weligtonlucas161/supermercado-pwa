import { getDbClient } from './db/client';
import { decryptSingleField } from '../utils/security';

const b64 = (value: string): ArrayBuffer => {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0)).buffer;
};

export function supportsPasskeys(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && !!window.PublicKeyCredential && !!navigator.credentials;
}

async function invoke(action: string, data: Record<string, unknown> = {}) {
  const db = getDbClient();
  if (!db) throw new Error('Servidor indisponível.');
  const { data: response, error } = await db.functions.invoke('passkey', { body: { action, ...data } });
  if (error || response?.error) throw new Error(response?.error || error?.message || 'Falha na autenticação.');
  return response;
}

export async function registerPasskey(): Promise<void> {
  if (!supportsPasskeys()) throw new Error('Seu navegador não oferece suporte a chaves de acesso.');
  const { options } = await invoke('register-options');
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: b64(options.challenge),
    user: { ...options.user, id: b64(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({ ...c, id: b64(c.id) })),
  };
  const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential | null;
  if (!credential) throw new Error('Criação da chave cancelada.');
  await invoke('register-verify', { credential: credential.toJSON() });
}

export async function authenticateWithPasskey() {
  if (!supportsPasskeys()) throw new Error('Este dispositivo não oferece suporte a chaves de acesso.');
  const { options } = await invoke('authenticate-options');
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: b64(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((c: any) => ({ ...c, id: b64(c.id) })),
  };
  const credential = await navigator.credentials.get({ publicKey }) as PublicKeyCredential | null;
  if (!credential) throw new Error('Autenticação cancelada.');
  const { token_hash } = await invoke('authenticate-verify', { credential: credential.toJSON() });
  const db = getDbClient();
  if (!db || !token_hash) throw new Error('Não foi possível criar uma sessão segura.');
  const { data: session, error: authError } = await db.auth.verifyOtp({ token_hash, type: 'magiclink' });
  if (authError || !session.user || !session.session) throw new Error('Não foi possível validar a sessão.');
  const { data: user, error } = await db.from('usuarios')
    .select('id,matricula,nome,cargo,setor,loja_id,ativo,primeiro_login,codigo_fornecedor')
    .eq('auth_user_id',session.user.id).eq('ativo',true).maybeSingle();
  if (error || !user) {
    await db.auth.signOut();
    throw new Error('Conta desativada ou não autorizada.');
  }
  const cargo = String(user.cargo || 'operador').toLowerCase();
  const mappedCargo = cargo.includes('saas') ? 'saas_admin' : cargo.includes('gerente') ? 'gerente' : cargo === 'promotor' ? 'promotor' : 'operador';
  return {
    success: true as const,
    token: session.session.access_token,
    user: {
      id: String(user.id),
      matricula: String(user.matricula),
      nome: decryptSingleField(String(user.nome || '')),
      cargo: mappedCargo,
      cargoCompleto: String(user.cargo || 'Operador de Loja'),
      setor: String(user.setor || 'Geral'),
      loja_id: String(user.loja_id || ''),
      loja_nome: mappedCargo === 'saas_admin' ? 'Servidor Central SaaS' : '',
      codigo_fornecedor: mappedCargo === 'promotor' ? String(user.codigo_fornecedor || '') : undefined,
      primeiro_login: Boolean(user.primeiro_login),
    },
  };
}

export async function listPasskeys(): Promise<number> {
  const result = await invoke('list');
  return Array.isArray(result.credentials) ? result.credentials.length : 0;
}
