import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  ShieldCheck, 
  Sparkles, 
  FileText,
  KeyRound,
  CheckCircle2,
  Building2,
  Trash2,
  X,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PatchNotesModal } from '../modals/PatchNotesModal';
import { TermsModal } from '../modals/TermsModal';
import { sanitizeIdentifier } from '../../utils/security';
import { fetchStoresFromDatabase } from '../../services/supabaseService';
import { Store } from '../../types';

export const LoginScreen: React.FC = () => {
  const { login, deleteStore, darkMode, disconnectedMessage, clearDisconnectedMessage } = useApp();

  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modais auxiliares
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Modal e Estados de Exclusão Funcional de Lojas
  const [isManageStoresOpen, setIsManageStoresOpen] = useState(false);
  const [storesList, setStoresList] = useState<Store[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const [isDeletingStore, setIsDeletingStore] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const loadStoresList = async () => {
    setIsLoadingStores(true);
    setDeleteErrorMessage(null);
    try {
      const data = await fetchStoresFromDatabase();
      setStoresList(data);
    } catch {
      setDeleteErrorMessage('Erro ao carregar a lista de lojas.');
    } finally {
      setIsLoadingStores(false);
    }
  };

  const handleOpenManageStores = () => {
    setIsManageStoresOpen(true);
    setDeleteSuccessMessage(null);
    setDeleteErrorMessage(null);
    setStoreToDelete(null);
    loadStoresList();
  };

  const handleConfirmDeleteStore = async () => {
    if (!storeToDelete) return;
    setIsDeletingStore(true);
    setDeleteErrorMessage(null);
    setDeleteSuccessMessage(null);

    try {
      const res = await deleteStore(storeToDelete.id);
      if (res.success) {
        setDeleteSuccessMessage(
          `Loja "${res.lojaNome || storeToDelete.nome_loja}" excluída com sucesso do banco de dados! Todas as sessões e usuários vinculados foram desconectados.`
        );
        setStoreToDelete(null);
        await loadStoresList();
      } else {
        setDeleteErrorMessage(res.message || 'Falha ao excluir a loja no servidor.');
      }
    } catch {
      setDeleteErrorMessage('Erro de conexão ao excluir a loja. Tente novamente.');
    } finally {
      setIsDeletingStore(false);
    }
  };

  // Detecção dinâmica de Administrador SaaS para mudar detalhes visuais para vermelho
  const cleanMat = matricula.trim().toLowerCase();
  const isSaasAdminLogin = cleanMat === '@200309' || cleanMat === '200309' || cleanMat === '111111';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMatricula = sanitizeIdentifier(matricula, 64);
    if (!cleanMatricula || !senha.trim()) {
      setErrorMessage('Por favor, preencha uma matrícula válida e a senha de acesso.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await login(cleanMatricula, senha);
      if (!result.success) {
        setErrorMessage(result.message || 'Credenciais inválidas. Verifique os dados digitados.');
      }
    } catch {
      setErrorMessage('Erro de conexão ao validar usuário. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200 ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50/30 text-slate-800'
    }`}>
      {/* Top Bar com Status & Versão Clicável */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between pt-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Building2 className={`w-3.5 h-3.5 ${isSaasAdminLogin ? 'text-rose-500' : 'text-emerald-500'}`} />
          <span>{isSaasAdminLogin ? 'Infraestrutura SaaS • Synk' : 'Varejo Alimentar • Synk'}</span>
        </div>

        {/* Versão que ao clicar abre o Patchnote da última atualização */}
        <button
          onClick={() => setShowPatchNotes(true)}
          title="Clique para ver o que há de novo na versão 2026.1.4"
          className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer border ${
            isSaasAdminLogin
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
          }`}
        >
          <Sparkles className="w-3 h-3 group-hover:rotate-12 transition-transform" />
          <span>v2026.1.4</span>
          <span className="text-[10px] font-normal opacity-70 underline ml-0.5">Patchnotes</span>
        </button>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className={`bg-white dark:bg-slate-900 border rounded-3xl shadow-xl p-6 sm:p-8 space-y-6 transition-all duration-300 ${
          isSaasAdminLogin 
            ? 'border-rose-500/50 ring-2 ring-rose-500/20 shadow-rose-950/20' 
            : 'border-slate-200 dark:border-slate-800'
        }`}>
          {/* Logo & Headline */}
          <div className="text-center space-y-2">
            <div className={`w-14 h-14 mx-auto rounded-3xl flex items-center justify-center text-white font-black text-2xl shadow-lg ring-4 transition-all duration-300 ${
              isSaasAdminLogin
                ? 'bg-gradient-to-tr from-rose-600 via-red-500 to-rose-400 shadow-rose-500/30 ring-rose-500/20'
                : 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 shadow-emerald-500/30 ring-emerald-500/15'
            }`}>
              S
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                SuperPWA <span className={`transition-colors duration-200 ${isSaasAdminLogin ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {isSaasAdminLogin ? 'Master SaaS' : 'OpSys'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isSaasAdminLogin 
                  ? 'Acesso Master: Painel de Gestão de Lojas e Servidor' 
                  : 'Acesse o painel operacional com sua matrícula e senha'}
              </p>
            </div>
          </div>

          {/* Feedback de Desconexão por Desligamento da Empresa */}
          {disconnectedMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border-2 border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex flex-col gap-2 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 font-black text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Acesso Revogado</span>
              </div>
              <p className="leading-relaxed">
                {disconnectedMessage}
              </p>
              <button
                type="button"
                onClick={clearDisconnectedMessage}
                className="self-end px-3 py-1 rounded-xl bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 transition"
              >
                Entendido
              </button>
            </div>
          )}

          {/* Feedback de Erro */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Campo Usuário / Matrícula */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
                Usuário (Matrícula)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={matricula}
                  onChange={e => setMatricula(e.target.value)}
                  placeholder={isSaasAdminLogin ? "@200309" : "Digite sua matrícula (ex: operador, admin ou @200309)"}
                  required
                  autoFocus
                  className={`w-full pl-10 pr-4 py-3 rounded-2xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none font-medium transition ${
                    isSaasAdminLogin 
                      ? 'border-rose-400 dark:border-rose-600 focus:ring-2 focus:ring-rose-500' 
                      : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
                Senha de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                  className={`w-full pl-10 pr-11 py-3 rounded-2xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none font-medium transition ${
                    isSaasAdminLogin 
                      ? 'border-rose-400 dark:border-rose-600 focus:ring-2 focus:ring-rose-500' 
                      : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão de Entrar */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 disabled:opacity-50 ${
                isSaasAdminLogin
                  ? 'from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-600/30'
                  : 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/25'
              }`}
            >
              {isLoading ? (
                <span>Validando credenciais...</span>
              ) : (
                <>
                  <span>{isSaasAdminLogin ? 'Acessar Servidor SaaS' : 'Entrar no Sistema'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Gerenciamento e Exclusão Funcional de Lojas */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-center">
              <button
                type="button"
                onClick={handleOpenManageStores}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                title="Visualizar e excluir lojas cadastradas no servidor"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Gerenciar / Excluir Lojas</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer com Aviso de No-Copyright & Termos de Uso */}
      <footer className="w-full max-w-md mx-auto text-center space-y-2 pb-2">
        <div className="flex items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <button
            onClick={() => setShowTerms(true)}
            className="hover:underline flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Termos de Uso</span>
          </button>
          <span>•</span>
          <button
            onClick={() => setShowPatchNotes(true)}
            className="hover:underline flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Notas da Versão (Patchnotes)</span>
          </button>
        </div>

        {/* Aviso de Copyright */}
        <div className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">
          <span className="font-bold">Copyright © 2026 SuperPWA OpSys</span> — Todos os direitos reservados.
        </div>
      </footer>

      {/* Modais */}
      <PatchNotesModal
        isOpen={showPatchNotes}
        onClose={() => setShowPatchNotes(false)}
      />

      <TermsModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
      />

      {/* Modal de Gerenciamento e Exclusão Funcional de Lojas */}
      {isManageStoresOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            
            {/* Cabeçalho */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Gerenciar & Excluir Lojas
                  </h3>
                  <p className="text-xs text-slate-400">
                    Remova lojas do servidor e encerre sessões ativas
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsManageStoresOpen(false);
                  setStoreToDelete(null);
                  setDeleteSuccessMessage(null);
                  setDeleteErrorMessage(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alertas de Sucesso / Erro */}
            {deleteSuccessMessage && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{deleteSuccessMessage}</span>
              </div>
            )}

            {deleteErrorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{deleteErrorMessage}</span>
              </div>
            )}

            {/* Diálogo de Confirmação de Exclusão */}
            {storeToDelete ? (
              <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 space-y-3 animate-in zoom-in-95 duration-150">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-extrabold text-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>Confirmar Exclusão Definitiva</span>
                </div>

                <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 leading-relaxed">
                  <p>
                    Você está prestes a excluir a loja <strong>{storeToDelete.nome_loja}</strong> (ID: <code className="font-mono text-rose-600 dark:text-rose-400">{storeToDelete.id}</code>).
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    ⚠️ <strong>Atenção:</strong> Esta ação é irreversível. O estoque de produtos, os usuários cadastrados e as auditorias vinculadas a esta loja serão permanentemente apagados do servidor. Todos os usuários com sessão aberta nesta unidade serão <strong>imediatamente desconectados</strong>.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isDeletingStore}
                    onClick={() => setStoreToDelete(null)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingStore}
                    onClick={handleConfirmDeleteStore}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/30 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {isDeletingStore ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Excluindo loja...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Sim, Excluir Definitivamente</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Lista de Lojas Cadastradas */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1">
                <span>Lojas Disponíveis ({storesList.length})</span>
                <button
                  type="button"
                  onClick={loadStoresList}
                  disabled={isLoadingStores}
                  className="hover:text-emerald-500 transition flex items-center gap-1 text-[11px]"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingStores ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>

              {isLoadingStores ? (
                <div className="py-10 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
                  <span>Carregando lojas do banco...</span>
                </div>
              ) : storesList.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  Nenhuma loja cadastrada no servidor.
                </div>
              ) : (
                storesList.map((store) => (
                  <div
                    key={store.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
                        style={{ backgroundColor: store.cor_primaria || '#059669' }}
                      >
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                          {store.nome_loja}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>ID: {store.id}</span>
                          <span>•</span>
                          <span className={store.ativa ? 'text-emerald-500' : 'text-rose-500'}>
                            {store.ativa ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isDeletingStore}
                      onClick={() => {
                        setStoreToDelete(store);
                        setDeleteSuccessMessage(null);
                        setDeleteErrorMessage(null);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-500/20 text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                      title={`Excluir loja ${store.nome_loja}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsManageStoresOpen(false);
                  setStoreToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
