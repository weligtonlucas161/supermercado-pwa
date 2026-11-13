import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Send,
  Users,
  ShieldAlert,
  Lock,
  EyeOff,
  Eye,
  MessageSquare,
  Bell,
  BellRing,
  AtSign,
  Tag,
  UserCheck,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SETORES_DISPONIVEIS } from '../../types';
import {
  censorProfanity,
  getUserAccentColor,
  normalizeMentionToken,
  parseChatMentions,
  requestPWANotificationPermission,
  resolveFullRoleLabel,
} from '../../utils/chatUtils';

interface MentionOption {
  type: 'setor' | 'usuario';
  insertText: string;
  label: string;
  subtitle: string;
}

export const StoreChatModal: React.FC = () => {
  const {
    isChatOpen,
    closeChat,
    chatMessages,
    sendChatMessage,
    operator,
    employees,
    directLeaderMatricula,
  } = useApp();

  const [activeChannel, setActiveChannel] = useState<'grupo' | 'direto_lider'>('grupo');
  const [publicDraft, setPublicDraft] = useState('');
  const [anonDraft, setAnonDraft] = useState('');
  const [isAnonimo, setIsAnonimo] = useState(false);
  const [selectedLeaderMatricula, setSelectedLeaderMatricula] = useState<string>('');
  const inputText = activeChannel === 'direto_lider' && isAnonimo ? anonDraft : publicDraft;
  const setInputText = (val: string | ((prev: string) => string)) => {
    if (activeChannel === 'direto_lider' && isAnonimo) {
      setAnonDraft(val);
    } else {
      setPublicDraft(val);
    }
  };
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lista de líderes disponíveis na loja (Gerente, GS, Supervisor, Lider, Fiscal, Adm)
  const storeLeaders = useMemo(() => {
    return employees.filter(e => {
      const cargoLower = (e.cargo || '').toLowerCase();
      return (
        cargoLower.includes('gerente') ||
        cargoLower.includes('supervisor') ||
        cargoLower.includes('gs') ||
        cargoLower.includes('lider') ||
        cargoLower.includes('líder') ||
        cargoLower.includes('fiscal') ||
        cargoLower.includes('adm') ||
        cargoLower.includes('master')
      );
    });
  }, [employees]);

  // Define líder selecionado
  useEffect(() => {
    if (directLeaderMatricula) {
      setActiveChannel('direto_lider');
      setSelectedLeaderMatricula(directLeaderMatricula);
    } else if (storeLeaders.length > 0 && !selectedLeaderMatricula) {
      setSelectedLeaderMatricula(storeLeaders[0].matricula);
    }
  }, [directLeaderMatricula, storeLeaders, selectedLeaderMatricula]);

  // Sincroniza status da permissão de push ao abrir o chat
  useEffect(() => {
    if (isChatOpen && typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, [isChatOpen]);

  // Rola até o final ao receber mensagens ou trocar contexto de perfil
  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeChannel, selectedLeaderMatricula, isAnonimo, isChatOpen]);

  // Opções de autocomplete para @setor e @usuario
  const mentionOptions = useMemo<MentionOption[]>(() => {
    if (mentionQuery === null) return [];
    const q = normalizeMentionToken(mentionQuery);

    const sectorOptions: MentionOption[] = [
      ...SETORES_DISPONIVEIS.map(setor => ({
        type: 'setor' as const,
        insertText: `@${setor}`,
        label: `@${setor}`,
        subtitle: `Notificar membros de ${setor}`,
      })),
      {
        type: 'setor' as const,
        insertText: '@TODOS',
        label: '@TODOS',
        subtitle: 'Notificar toda a equipe da loja',
      },
    ];

    const userOptions: MentionOption[] = employees
      .filter(e => e.ativo !== false)
      .map(emp => {
        const firstToken = emp.nome.trim().split(/\s+/)[0] || emp.matricula;
        return {
          type: 'usuario' as const,
          insertText: `@${firstToken}`,
          label: `@${emp.nome}`,
          subtitle: `${resolveFullRoleLabel(emp.cargo)} • Mat. ${emp.matricula}`,
        };
      });

    const all = [...sectorOptions, ...userOptions];
    if (!q) return all.slice(0, 8);

    return all
      .filter(
        opt =>
          normalizeMentionToken(opt.label).includes(q) ||
          normalizeMentionToken(opt.subtitle).includes(q)
      )
      .slice(0, 8);
  }, [mentionQuery, employees]);

  if (!isChatOpen) return null;

  const selectedLeader =
    storeLeaders.find(l => l.matricula === selectedLeaderMatricula) || storeLeaders[0];
  const userMatricula = operator.code || operator.matricula || '';

  // Filtra as mensagens pelo canal ativo e isola estritamente Perfil Anônimo vs Perfil Público
  const filteredMessages = chatMessages.filter(m => {
    if (activeChannel === 'grupo') {
      return m.canal_tipo === 'grupo' && !m.is_anonimo;
    } else {
      if (m.canal_tipo !== 'direto_lider') return false;
      if (Boolean(m.is_anonimo) !== isAnonimo) return false;
      const isViewingOwnInbox = selectedLeaderMatricula === userMatricula;
      const isSenderToLeader =
        m.remetente_matricula === userMatricula && m.destinatario_id === selectedLeaderMatricula;
      const isLeaderToSender =
        m.remetente_matricula === selectedLeaderMatricula && m.destinatario_id === userMatricula;
      const isDirectedToUser =
        m.destinatario_id === userMatricula &&
        (isViewingOwnInbox || !selectedLeaderMatricula || m.remetente_matricula === selectedLeaderMatricula);
      return isSenderToLeader || isLeaderToSender || isDirectedToUser;
    }
  });

  const handleInputChange = (val: string) => {
    setInputText(val);
    const match = val.match(/(?:^|\s)@([a-zA-ZÀ-ÿ0-9_.-]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const handleSelectMention = (option: MentionOption) => {
    const updated = inputText.replace(/(?:^|\s)@([a-zA-ZÀ-ÿ0-9_.-]*)$/, match => {
      const leadingSpace = match.startsWith(' ') ? ' ' : '';
      return `${leadingSpace}${option.insertText} `;
    });
    setInputText(updated);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleTriggerMentionButton = () => {
    const needsSpace = inputText.length > 0 && !inputText.endsWith(' ');
    const next = `${inputText}${needsSpace ? ' ' : ''}@`;
    setInputText(next);
    setMentionQuery('');
    inputRef.current?.focus();
  };

  const handleRequestPush = async () => {
    const perm = await requestPWANotificationPermission();
    setNotifPermission(perm);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText('');
    setMentionQuery(null);

    if (activeChannel === 'grupo') {
      await sendChatMessage({
        canal_tipo: 'grupo',
        conteudo: textToSend,
        is_anonimo: false,
      });
    } else {
      await sendChatMessage({
        canal_tipo: 'direto_lider',
        destinatario_id: selectedLeader?.matricula || 'gerente',
        destinatario_nome: selectedLeader?.nome || 'Gerente Geral da Loja',
        conteudo: textToSend,
        is_anonimo: isAnonimo,
      });
    }
  };

  const handleQuickChip = (text: string) => {
    setInputText(prev => (prev ? `${prev} - ${text}` : text));
    inputRef.current?.focus();
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Renderiza o texto da mensagem destacando @setor e @usuario
  const renderMessageContent = (rawContent: string, isMe: boolean) => {
    const censored = censorProfanity(rawContent);
    const parsed = parseChatMentions(censored, employees);
    const parts = censored.split(/(@[a-zA-ZÀ-ÿ0-9_.-]+)/g);

    return parts.map((part, idx) => {
      if (!part.startsWith('@') || part.length < 2) {
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      }

      const norm = normalizeMentionToken(part.slice(1));
      const isSector = parsed.sectors.some(s => normalizeMentionToken(s) === norm) || norm === 'todos' || norm === 'geral';

      return (
        <span
          key={idx}
          className={`inline-flex items-center px-1.5 py-0.2 rounded-md font-bold mx-0.5 ${
            isMe
              ? 'bg-white/20 text-white'
              : isSector
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
          }`}
        >
          {part}
        </span>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl h-[88vh] sm:h-[82vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header do Chat */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  Chat Operacional
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  {operator.store || 'Loja 01'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {activeChannel === 'grupo'
                  ? 'Canal Geral • Use @setor ou @usuario para notificar'
                  : 'Canal Privado Direto com a Liderança da Unidade'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {notifPermission === 'default' && (
              <button
                type="button"
                onClick={handleRequestPush}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                title="Ativar notificações push no aparelho"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ativar Push</span>
              </button>
            )}
            {notifPermission === 'granted' && (
              <span
                className="px-2 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold hidden sm:inline-flex items-center gap-1"
                title="Notificações push PWA ativas"
              >
                <BellRing className="w-3 h-3" />
                Push ativo
              </span>
            )}

            <button
              onClick={closeChat}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              title="Fechar chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Seleção de Abas do Chat (Padrão OpSys Emerald/Slate) */}
        <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveChannel('grupo');
              setMentionQuery(null);
            }}
            className={`flex-1 py-2 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeChannel === 'grupo'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-750'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Grupo Geral da Loja</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveChannel('direto_lider');
              setMentionQuery(null);
            }}
            className={`flex-1 py-2 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeChannel === 'direto_lider'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-750'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Falar com Líderes</span>
          </button>
        </div>

        {/* Barra de Configuração do Canal Privado com Líderes (Alinhada ao padrão OpSys) */}
        {activeChannel === 'direto_lider' && (
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                    Líder:
                  </span>
                  <select
                    value={selectedLeaderMatricula}
                    onChange={e => setSelectedLeaderMatricula(e.target.value)}
                    className="w-full sm:w-auto flex-1 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {storeLeaders.length === 0 ? (
                      <option value="gerente">Gerente Geral da Loja</option>
                    ) : (
                      storeLeaders.map(l => (
                        <option key={l.id} value={l.matricula}>
                          {l.nome} — {resolveFullRoleLabel(l.cargo)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Seletor Isolado de Perfil (Público vs Anônimo) */}
              <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsAnonimo(false);
                    setMentionQuery(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    !isAnonimo
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Conversa identificada (Perfil Público isolado)"
                >
                  <Eye className="w-3 h-3" />
                  <span>Perfil Público</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAnonimo(true);
                    setMentionQuery(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    isAnonimo
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Conversa sigilosa (Perfil Anônimo isolado)"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Perfil Anônimo</span>
                </button>
              </div>
            </div>

            {isAnonimo ? (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>
                  <strong>Sigilo Operacional Garantido:</strong> Suas mensagens serão exibidas como{' '}
                  <strong>"Operador Anônimo"</strong>, sem expor seu nome ou matrícula.
                </span>
              </div>
            ) : (
              <div className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Conversa privada 1-a-1 com{' '}
                  <strong>{selectedLeader?.nome || 'Gerente Geral da Loja'}</strong> (
                  {resolveFullRoleLabel(selectedLeader?.cargo)}).
                </span>
              </div>
            )}
          </div>
        )}

        {/* Área de Mensagens (Scrollable) */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-3">
                {activeChannel === 'grupo' ? (
                  <MessageSquare className="w-6 h-6" />
                ) : (
                  <ShieldCheck className="w-6 h-6" />
                )}
              </div>
              <p className="font-bold text-xs text-slate-700 dark:text-slate-200">
                {activeChannel === 'grupo'
                  ? 'Nenhuma mensagem no grupo ainda'
                  : isAnonimo
                  ? 'Nenhuma mensagem no Perfil Anônimo'
                  : 'Nenhuma mensagem no Perfil Público'}
              </p>
              <p className="text-[11px] mt-1 max-w-xs text-slate-400">
                {activeChannel === 'grupo'
                  ? 'Envie alertas operacionais ou mencione @setor / @usuario para notificar membros específicos.'
                  : isAnonimo
                  ? 'Contexto sigiloso isolado. Mensagens do Perfil Público nunca aparecem aqui.'
                  : 'Conversa identificada isolada. Mensagens do Perfil Anônimo nunca aparecem aqui.'}
              </p>
            </div>
          ) : (
            filteredMessages.map(msg => {
              if (msg.remetente_matricula === 'SISTEMA') {
                return (
                  <div key={msg.id} className="flex justify-center my-1.5">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 shadow-2xs max-w-[92%] text-center">
                      <UserPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{msg.conteudo}</span>
                      <span className="text-[10px] text-emerald-600/75 dark:text-emerald-400/75 shrink-0">
                        • {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              }

              const isMe = msg.remetente_matricula === userMatricula;
              const userColor = getUserAccentColor(msg.remetente_matricula || msg.remetente_nome);
              const fullRole = msg.is_anonimo
                ? 'Sigilo Operacional'
                : resolveFullRoleLabel(msg.remetente_cargo, msg.remetente_matricula, employees);

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                >
                  {/* Identificador do Remetente com Cor Única e Tag de Cargo Completa */}
                  <div className="flex items-center flex-wrap gap-1.5 text-[10px] text-slate-400 px-1 max-w-[92%]">
                    {msg.is_anonimo ? (
                      <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 bg-rose-500/10 px-1.5 py-0.5 rounded-md border border-rose-500/20">
                        <EyeOff className="w-3 h-3" /> Operador Anônimo
                      </span>
                    ) : (
                      <>
                        <span
                          className={`font-extrabold ${userColor.nameClass}`}
                        >
                          {isMe ? `Você (${msg.remetente_nome})` : msg.remetente_nome}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${userColor.avatarBgClass}`}
                        >
                          {fullRole}
                        </span>
                      </>
                    )}
                    <span>• {formatTime(msg.timestamp)}</span>
                  </div>

                  {/* Balão da Mensagem */}
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                      isMe
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : msg.is_anonimo
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-slate-900 dark:text-rose-100 border border-rose-200 dark:border-rose-900/50 rounded-tl-none'
                        : `bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 border-l-4 ${userColor.ringClass} rounded-tl-none`
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {renderMessageContent(msg.conteudo, isMe)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Autocomplete de Menções (@usuario e @setor) */}
        {mentionQuery !== null && mentionOptions.length > 0 && (
          <div className="mx-3 mb-1 p-1.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg max-h-44 overflow-y-auto shrink-0">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <AtSign className="w-3 h-3 text-emerald-500" />
              <span>Mencionar setor ou colaborador</span>
            </div>
            {mentionOptions.map((opt, idx) => (
              <button
                key={`${opt.type}-${opt.insertText}-${idx}`}
                type="button"
                onClick={() => handleSelectMention(opt)}
                className="w-full px-2.5 py-1.5 rounded-xl hover:bg-emerald-500/10 text-left flex items-center justify-between gap-2 transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`p-1 rounded-lg shrink-0 ${
                      opt.type === 'setor'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {opt.type === 'setor' ? (
                      <Tag className="w-3 h-3" />
                    ) : (
                      <Users className="w-3 h-3" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{opt.subtitle}</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                  {opt.insertText}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Chips Operacionais Rápidos */}
        <div className="px-3 pt-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => handleQuickChip('🚨 Ruptura na gôndola')}
            className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[10px] font-bold whitespace-nowrap transition cursor-pointer"
          >
            🚨 Ruptura na gôndola
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('📦 Reposição urgente')}
            className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[10px] font-bold whitespace-nowrap transition cursor-pointer"
          >
            📦 Reposição urgente
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('⏰ Validade próxima detectada')}
            className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[10px] font-bold whitespace-nowrap transition cursor-pointer"
          >
            ⏰ Validade próxima
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('🔍 Auditoria de presença finalizada')}
            className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[10px] font-bold whitespace-nowrap transition cursor-pointer"
          >
            🔍 Auditoria finalizada
          </button>
        </div>

        {/* Formulário de Envio de Mensagem */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0"
        >
          <button
            type="button"
            onClick={handleTriggerMentionButton}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/10 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200/70 dark:border-slate-700 transition cursor-pointer shrink-0"
            title="Mencionar @usuario ou @setor"
          >
            <AtSign className="w-4 h-4" />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={e => handleInputChange(e.target.value)}
            placeholder={
              activeChannel === 'grupo'
                ? 'Mensagem ou @setor / @usuario...'
                : isAnonimo
                ? 'Mensagem anônima para a liderança...'
                : `Mensagem direta para ${selectedLeader?.nome || 'Líder'}...`
            }
            className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer shrink-0"
            title="Enviar mensagem"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
