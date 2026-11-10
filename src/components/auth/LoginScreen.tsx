import React, { useState } from 'react';
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
  Building2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PatchNotesModal } from '../modals/PatchNotesModal';
import { TermsModal } from '../modals/TermsModal';

export const LoginScreen: React.FC = () => {
  const { login, darkMode, disconnectedMessage, clearDisconnectedMessage } = useApp();

  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modais auxiliares
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Detecção dinâmica de Administrador SaaS para mudar detalhes visuais para vermelho
  const isSaasAdminLogin = matricula.trim() === '@200309' || matricula.trim() === '111111';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricula.trim() || !senha.trim()) {
      setErrorMessage('Por favor, preencha a matrícula e a senha de acesso.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await login(matricula, senha);
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
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
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
                  placeholder="Ex: @200309 ou sua matrícula"
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

        {/* Aviso de No-Copyright explícito conforme solicitado */}
        <div className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">
          <span className="font-bold">No-Copyright (Domínio Público)</span> — Software livre e desimpedido para operações comerciais de varejo e auditoria de supermercados.
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
    </div>
  );
};
