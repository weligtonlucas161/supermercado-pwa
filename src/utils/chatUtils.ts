import { ChatMessage, SETORES_DISPONIVEIS, SetorLoja, StoreEmployee } from '../types';

// ============================================================================
// 1. CORES ÚNICAS E CONSISTENTES POR USUÁRIO
// ============================================================================

export interface UserAccentColor {
  nameClass: string;
  avatarBgClass: string;
  ringClass: string;
}

const USER_COLOR_PALETTE: UserAccentColor[] = [
  {
    nameClass: 'text-emerald-700 dark:text-emerald-400',
    avatarBgClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    ringClass: 'border-l-emerald-500',
  },
  {
    nameClass: 'text-sky-700 dark:text-sky-400',
    avatarBgClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    ringClass: 'border-l-sky-500',
  },
  {
    nameClass: 'text-amber-700 dark:text-amber-400',
    avatarBgClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    ringClass: 'border-l-amber-500',
  },
  {
    nameClass: 'text-violet-700 dark:text-violet-400',
    avatarBgClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
    ringClass: 'border-l-violet-500',
  },
  {
    nameClass: 'text-rose-700 dark:text-rose-400',
    avatarBgClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    ringClass: 'border-l-rose-500',
  },
  {
    nameClass: 'text-teal-700 dark:text-teal-400',
    avatarBgClass: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
    ringClass: 'border-l-teal-500',
  },
  {
    nameClass: 'text-orange-700 dark:text-orange-400',
    avatarBgClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
    ringClass: 'border-l-orange-500',
  },
  {
    nameClass: 'text-cyan-700 dark:text-cyan-400',
    avatarBgClass: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    ringClass: 'border-l-cyan-500',
  },
  {
    nameClass: 'text-fuchsia-700 dark:text-fuchsia-400',
    avatarBgClass: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30',
    ringClass: 'border-l-fuchsia-500',
  },
  {
    nameClass: 'text-lime-700 dark:text-lime-400',
    avatarBgClass: 'bg-lime-500/15 text-lime-700 dark:text-lime-300 border-lime-500/30',
    ringClass: 'border-l-lime-500',
  },
];

export function getUserAccentColor(identifier: string): UserAccentColor {
  const key = (identifier || 'default').trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const index = Math.abs(hash) % USER_COLOR_PALETTE.length;
  return USER_COLOR_PALETTE[index];
}

// ============================================================================
// 2. TAG DE CARGO COMPLETA
// ============================================================================

const ROLE_FULL_LABELS: Record<string, string> = {
  saas_admin: 'Administrador SaaS',
  gerente: 'Gerente Geral da Loja',
  adm: 'Administrador da Loja',
  master: 'Líder Master',
  operador: 'Operador de Loja',
};

export function resolveFullRoleLabel(
  rawRole?: string,
  matricula?: string,
  employees?: StoreEmployee[]
): string {
  if (matricula && employees && employees.length > 0) {
    const matched = employees.find(
      e => e.matricula.toLowerCase() === matricula.toLowerCase()
    );
    if (matched?.cargo && matched.cargo.trim()) {
      const normalized = matched.cargo.trim().toLowerCase();
      return ROLE_FULL_LABELS[normalized] || matched.cargo.trim();
    }
  }

  if (!rawRole || !rawRole.trim()) return 'Operador de Loja';
  const trimmed = rawRole.trim();
  const mapped = ROLE_FULL_LABELS[trimmed.toLowerCase()];
  return mapped || trimmed;
}

// ============================================================================
// 3. FILTRO DE CONTEÚDO (MODERAÇÃO / CENSURA)
// ============================================================================

const PROFANITY_LIST = [
  'porra',
  'caralho',
  'cacete',
  'puta',
  'puto',
  'putaria',
  'merda',
  'bosta',
  'arrombado',
  'arrombada',
  'fdp',
  'filho da puta',
  'desgraca',
  'desgracado',
  'desgracada',
  'vagabundo',
  'vagabunda',
  'otario',
  'otaria',
  'babaca',
  'imbecil',
  'idiota',
  'cuzao',
  'cuzona',
  'buceta',
  'xoxota',
  'piroca',
  'pica',
  'viado',
  'bicha',
  'corno',
  'corna',
  'pqp',
  'vsf',
  'tnc',
  'krl',
  'fuck',
  'shit',
  'bitch',
  'asshole',
];

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function censorProfanity(text: string): string {
  if (!text) return text;

  // Divide preservando espaços para mapear posições exatas com/sem acento
  const normalized = stripAccents(text).toLowerCase();
  const maskChars = new Set<number>();

  for (const term of PROFANITY_LIST) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(normalized)) !== null) {
      for (let i = match.index; i < match.index + match[0].length; i++) {
        if (text[i] !== ' ') {
          maskChars.add(i);
        }
      }
    }
  }

  if (maskChars.size === 0) return text;

  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += maskChars.has(i) ? '*' : text[i];
  }
  return result;
}

// ============================================================================
// 4. MENÇÕES (@usuario E @setor) E NOTIFICAÇÃO DIRECIONADA
// ============================================================================

export interface ParsedMentions {
  sectors: SetorLoja[];
  userMatriculas: string[];
  rawUserTokens: string[];
  hasGeneralBroadcast: boolean;
}

export function normalizeMentionToken(token: string): string {
  return stripAccents(token).toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function parseChatMentions(
  content: string,
  employees: StoreEmployee[]
): ParsedMentions {
  const sectors = new Set<SetorLoja>();
  const userMatriculas = new Set<string>();
  const rawUserTokens: string[] = [];
  let hasGeneralBroadcast = false;

  if (!content) {
    return { sectors: [], userMatriculas: [], rawUserTokens: [], hasGeneralBroadcast: false };
  }

  const normalizedContent = stripAccents(content).toLowerCase();

  // Detecta @todos ou @geral
  if (/(^|\s)@(todos|geral)(?![a-z0-9_])/i.test(normalizedContent)) {
    hasGeneralBroadcast = true;
  }

  // Detecta @setor para os 6 setores disponíveis
  for (const setor of SETORES_DISPONIVEIS) {
    const normSetor = normalizeMentionToken(setor);
    const regex = new RegExp(`(^|\\s)@${normSetor}(?![a-z0-9_])`, 'i');
    if (regex.test(normalizedContent)) {
      sectors.add(setor);
    }
  }

  // Detecta @usuario (por matrícula ou nome/primeiro nome)
  const mentionMatches = content.match(/@([a-zA-ZÀ-ÿ0-9_.-]+)/g) || [];
  for (const raw of mentionMatches) {
    const token = raw.slice(1);
    const normToken = normalizeMentionToken(token);
    if (!normToken || normToken === 'todos' || normToken === 'geral') continue;

    const isSetor = SETORES_DISPONIVEIS.some(s => normalizeMentionToken(s) === normToken);
    if (isSetor) continue;

    rawUserTokens.push(normToken);

    for (const emp of employees) {
      const empMat = normalizeMentionToken(emp.matricula);
      const empFull = normalizeMentionToken(emp.nome);
      const empFirst = normalizeMentionToken(emp.nome.split(' ')[0] || '');
      const empUnderscore = normalizeMentionToken(emp.nome.replace(/\s+/g, '_'));

      if (
        normToken === empMat ||
        normToken === empFirst ||
        normToken === empFull ||
        normToken === empUnderscore
      ) {
        userMatriculas.add(emp.matricula);
      }
    }
  }

  return {
    sectors: Array.from(sectors),
    userMatriculas: Array.from(userMatriculas),
    rawUserTokens,
    hasGeneralBroadcast,
  };
}

export interface NotificationTargetResult {
  shouldNotify: boolean;
  isDirectMentionToMe: boolean;
  isSectorMentionToMe: boolean;
  mentionedSectors: SetorLoja[];
}

export function evaluateMessageNotificationTarget(
  msg: ChatMessage,
  currentUser: {
    matricula: string;
    name: string;
    sector?: string;
  },
  employees: StoreEmployee[]
): NotificationTargetResult {
  const parsed = parseChatMentions(msg.conteudo, employees);

  const myMatNorm = normalizeMentionToken(currentUser.matricula);
  const myFirstNorm = normalizeMentionToken((currentUser.name || '').split(' ')[0] || '');
  const myFullNorm = normalizeMentionToken(currentUser.name || '');

  const isDirectMentionToMe =
    parsed.userMatriculas.some(m => normalizeMentionToken(m) === myMatNorm) ||
    parsed.rawUserTokens.some(
      t => t === myMatNorm || (myFirstNorm && t === myFirstNorm) || (myFullNorm && t === myFullNorm)
    );

  // Resolve setor efetivo do usuário atual (operador/preferência local/cadastro)
  const matchedEmp = employees.find(e => normalizeMentionToken(e.matricula) === myMatNorm);
  const preferredLocal =
    typeof window !== 'undefined' ? localStorage.getItem('superpwa_preferred_sector') : null;
  const rawSector =
    (currentUser.sector && currentUser.sector !== 'Geral' && currentUser.sector !== 'TODOS'
      ? currentUser.sector
      : matchedEmp?.setor_restrito && matchedEmp.setor_restrito !== 'TODOS'
      ? matchedEmp.setor_restrito
      : preferredLocal && preferredLocal !== 'TODOS'
      ? preferredLocal
      : '') || '';

  const mySectorNorm = normalizeMentionToken(rawSector);
  const isSectorMentionToMe =
    mySectorNorm !== '' &&
    parsed.sectors.some(s => normalizeMentionToken(s) === mySectorNorm);

  // Mensagem direta 1-a-1 para líder: só notifica o destinatário
  if (msg.canal_tipo === 'direto_lider') {
    const isRecipient =
      !msg.destinatario_id ||
      normalizeMentionToken(msg.destinatario_id) === myMatNorm;
    return {
      shouldNotify: isRecipient,
      isDirectMentionToMe: isRecipient,
      isSectorMentionToMe: false,
      mentionedSectors: parsed.sectors,
    };
  }

  // Se houver menção direcionada a setor(es) ou usuário(s) sem @todos/@geral:
  // apenas membros do setor mencionado ou usuários mencionados recebem a notificação.
  const hasTargetedMentions =
    !parsed.hasGeneralBroadcast &&
    (parsed.sectors.length > 0 || parsed.userMatriculas.length > 0 || parsed.rawUserTokens.length > 0);

  if (hasTargetedMentions) {
    return {
      shouldNotify: isDirectMentionToMe || isSectorMentionToMe,
      isDirectMentionToMe,
      isSectorMentionToMe,
      mentionedSectors: parsed.sectors,
    };
  }

  return {
    shouldNotify: true,
    isDirectMentionToMe: false,
    isSectorMentionToMe: false,
    mentionedSectors: [],
  };
}

// ============================================================================
// 5. NOTIFICAÇÕES PUSH PWA (SERVICE WORKER + FALLBACK BROWSER API)
// ============================================================================

export async function requestPWANotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showPWAPushNotification(
  title: string,
  options: {
    body: string;
    tag?: string;
    data?: Record<string, unknown>;
  }
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (localStorage.getItem('superpwa_chat_notifs_enabled') === 'false') return false;
  if (Notification.permission !== 'granted') return false;

  const notifOptions: NotificationOptions = {
    body: options.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: options.tag || `chat-${Date.now()}`,
    data: {
      url: '/',
      action: 'open_chat',
      ...(options.data || {}),
    },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const activeReg = reg || (await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>(resolve => setTimeout(() => resolve(null), 1200)),
      ]));

      if (activeReg && 'showNotification' in activeReg) {
        await activeReg.showNotification(title, notifOptions);
        return true;
      }
    }
  } catch (err) {
    console.warn('[PWA-Push] Fallback para Notification API:', err);
  }

  try {
    const n = new Notification(title, notifOptions);
    n.onclick = () => {
      window.focus();
      window.dispatchEvent(new CustomEvent('superpwa:open-chat'));
      n.close();
    };
    return true;
  } catch (err) {
    console.warn('[PWA-Push] Falha ao exibir notificação:', err);
    return false;
  }
}
