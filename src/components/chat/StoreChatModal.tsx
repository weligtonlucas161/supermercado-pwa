import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Users, 
  ShieldAlert, 
  Lock, 
  EyeOff, 
  Eye, 
  MessageSquare, 
  AlertTriangle, 
  CheckCheck, 
  Clock, 
  Building2,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ChatMessage, StoreEmployee } from '../../types';

export const StoreChatModal: React.FC = () => {
  const { 
    isChatOpen, 
    closeChat, 
    chatMessages, 
    sendChatMessage, 
    operator, 
    employees, 
    directLeaderMatricula, 
    darkMode 
  } = useApp();

  const [activeChannel, setActiveChannel] = useState<'grupo' | 'direto_lider'>('grupo');
  const [inputText, setInputText] = useState('');
  const [isAnonimo, setIsAnonimo] = useState(false);
  const [selectedLeaderMatricula, setSelectedLeaderMatricula] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Lista de líderes disponíveis na loja (Gerente, GS, Supervisor, Lider, Adm)
  const storeLeaders = employees.filter(e => {
    const cargoLower = (e.cargo || '').toLowerCase();
    return (
      cargoLower.includes('gerente') ||
      cargoLower.includes('supervisor') ||
      cargoLower.includes('gs') ||
      cargoLower.includes('lider') ||
      cargoLower.includes('líder') ||
      cargoLower.includes('fiscal') ||
      cargoLower.includes('adm')
    );
  });

  // Define líder selecionado
  useEffect(() => {
    if (directLeaderMatricula) {
      setActiveChannel('direto_lider');
      setSelectedLeaderMatricula(directLeaderMatricula);
    } else if (storeLeaders.length > 0 && !selectedLeaderMatricula) {
      setSelectedLeaderMatricula(storeLeaders[0].matricula);
    }
  }, [directLeaderMatricula, storeLeaders]);

  // Rola até o final ao receber mensagens
  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeChannel, selectedLeaderMatricula, isChatOpen]);

  if (!isChatOpen) return null;

  const selectedLeader = storeLeaders.find(l => l.matricula === selectedLeaderMatricula) || storeLeaders[0];
  const userMatricula = operator.code || operator.matricula || '';

  // Filtra as mensagens pelo canal ativo
  const filteredMessages = chatMessages.filter(m => {
    if (activeChannel === 'grupo') {
      return m.canal_tipo === 'grupo';
    } else {
      if (m.canal_tipo !== 'direto_lider') return false;
      // Se for o operador atual falando com o líder selecionado
      const isSenderToLeader = m.remetente_matricula === userMatricula && m.destinatario_id === selectedLeaderMatricula;
      const isLeaderToSender = m.remetente_matricula === selectedLeaderMatricula && m.destinatario_id === userMatricula;
      // Se o próprio usuário for líder e estiver visualizando conversas direcionadas a ele
      const isDirectedToUser = m.destinatario_id === userMatricula && (!selectedLeaderMatricula || m.remetente_matricula === selectedLeaderMatricula);
      return isSenderToLeader || isLeaderToSender || isDirectedToUser;
    }
  });

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText('');

    if (activeChannel === 'grupo') {
      await sendChatMessage({
        canal_tipo: 'grupo',
        conteudo: textToSend,
        is_anonimo: false, // Canal do grupo sempre identificado
      });
    } else {
      await sendChatMessage({
        canal_tipo: 'direto_lider',
        destinatario_id: selectedLeader?.matricula || 'gerente',
        destinatario_nome: selectedLeader?.nome || 'Gerente da Loja',
        conteudo: textToSend,
        is_anonimo: isAnonimo,
      });
    }
  };

  const handleQuickChip = (text: string) => {
    setInputText(prev => (prev ? `${prev} - ${text}` : text));
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl h-[88vh] sm:h-[82vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header do Chat */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  Chat Operacional
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  {operator.store || 'Loja 01'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {activeChannel === 'grupo' 
                  ? 'Canal Geral com todos os colaboradores da unidade' 
                  : `Canal Privado Direto com a Liderança`}
              </p>
            </div>
          </div>

          <button
            onClick={closeChat}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            title="Fechar chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seleção de Abas do Chat */}
        <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveChannel('grupo')}
            className={`flex-1 py-2 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeChannel === 'grupo'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>💬 Grupo Geral da Loja</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveChannel('direto_lider')}
            className={`flex-1 py-2 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeChannel === 'direto_lider'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>🔒 Falar com Líderes</span>
          </button>
        </div>

        {/* Barra de Configuração do Canal Privado com Líderes */}
        {activeChannel === 'direto_lider' && (
          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/40 space-y-2.5 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Destinatário:
                </span>
                <select
                  value={selectedLeaderMatricula}
                  onChange={e => setSelectedLeaderMatricula(e.target.value)}
                  className="text-xs font-bold p-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {storeLeaders.length === 0 ? (
                    <option value="gerente">Gerente Geral da Loja</option>
                  ) : (
                    storeLeaders.map(l => (
                      <option key={l.id} value={l.matricula}>
                        {l.nome} ({l.cargo})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Botão Modo Anônimo com Sigilo */}
              <button
                type="button"
                onClick={() => setIsAnonimo(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer border ${
                  isAnonimo
                    ? 'bg-rose-600 text-white border-rose-500 shadow-sm animate-pulse'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-400'
                }`}
                title="Ativar/desativar envio anônimo para relatar ocorrências sigilosas"
              >
                {isAnonimo ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-white" />
                    <span>🎭 Modo Anônimo ATIVO</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>Modo Anônimo (Desativado)</span>
                  </>
                )}
              </button>
            </div>

            {isAnonimo && (
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Sigilo Operacional Garantido:</strong> Suas mensagens serão exibidas para a liderança como <strong>"Operador Anônimo"</strong>, sem expor seu nome ou matrícula.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Área de Mensagens (Scrollable) */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-12 h-12 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-slate-400" />
              </div>
              <p className="font-bold text-xs text-slate-600 dark:text-slate-300">
                Nenhuma mensagem neste canal ainda
              </p>
              <p className="text-[11px] mt-1 max-w-xs text-slate-400">
                {activeChannel === 'grupo'
                  ? 'Envie alertas operacionais, fotos de produtos ou avisos de reposição para toda a equipe da loja.'
                  : 'Inicie uma conversa direta ou envie um relato confidencial para a liderança.'}
              </p>
            </div>
          ) : (
            filteredMessages.map(msg => {
              const isMe = msg.remetente_matricula === userMatricula;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                >
                  {/* Identificador do Remetente */}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
                    {msg.is_anonimo ? (
                      <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 bg-rose-500/10 px-1.5 py-0.2 rounded-md">
                        <EyeOff className="w-3 h-3" /> Operador Anônimo
                      </span>
                    ) : (
                      <>
                        <span className="font-extrabold text-slate-700 dark:text-slate-300">
                          {isMe ? 'Você' : msg.remetente_nome}
                        </span>
                        {msg.remetente_cargo && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {msg.remetente_cargo}
                          </span>
                        )}
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
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chips Operacionais Rápidos */}
        <div className="px-3 pt-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => handleQuickChip('🚨 Ruptura na gôndola')}
            className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-bold whitespace-nowrap transition cursor-pointer"
          >
            🚨 Ruptura na gôndola
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('📦 Reposição urgente')}
            className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-bold whitespace-nowrap transition cursor-pointer"
          >
            📦 Reposição urgente
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('⏰ Validade próxima detectada')}
            className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-bold whitespace-nowrap transition cursor-pointer"
          >
            ⏰ Validade próxima
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('🔍 Auditoria de presença finalizada')}
            className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-bold whitespace-nowrap transition cursor-pointer"
          >
            🔍 Auditoria finalizada
          </button>
        </div>

        {/* Formulário de Envio de Mensagem */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={
              activeChannel === 'grupo'
                ? 'Digite uma mensagem para a equipe da loja...'
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
