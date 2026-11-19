import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  Sparkles, 
  FileText,
  Building2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PatchNotesModal } from '../modals/PatchNotesModal';
import { TermsModal } from '../modals/TermsModal';
import { sanitizeIdentifier } from '../../utils/security';

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
    <div className={`h-dvh w-full flex flex-col justify-between overflow-hidden p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-colors duration-200 ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50/30 text-slate-800'
    }`}>
      {/* Top Bar com Status & Versão Clicável */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between gap-2 pt-1 shrink-0">
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
      <div className="w-full max-w-md mx-auto flex-1 min-h-0 flex items-center justify-center py-2 sm:py-4">
        <div className={`w-full max-h-full overflow-hidden bg-white dark:bg-slate-900 border rounded-3xl shadow-xl p-5 sm:p-8 space-y-4 sm:space-y-6 [@media(max-height:700px)]:p-4 [@media(max-height:700px)]:space-y-3 transition-all duration-300 ${
          isSaasAdminLogin 
            ? 'border-rose-500/50 ring-2 ring-rose-500/20 shadow-rose-950/20' 
            : 'border-slate-200 dark:border-slate-800'
        }`}>
          {/* Logo & Headline */}
          <div className="text-center space-y-2 [@media(max-height:700px)]:space-y-1">
            <div className={`w-14 h-14 [@media(max-height:700px)]:w-11 [@media(max-height:700px)]:h-11 [@media(max-height:700px)]:text-xl mx-auto rounded-3xl flex items-center justify-center text-white font-black text-2xl shadow-lg ring-4 transition-all duration-300 ${
              isSaasAdminLogin
                ? 'bg-gradient-to-tr from-rose-600 via-red-500 to-rose-400 shadow-rose-500/30 ring-rose-500/20'
                : 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 shadow-emerald-500/30 ring-emerald-500/15'
            }`}>
              S
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl [@media(max-height:700px)]:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                SuperPWA <span className={`transition-colors duration-200 ${isSaasAdminLogin ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {isSaasAdminLogin ? 'Master SaaS' : 'OpSys'}
                </span>
              </h2>
              <p className="text-xs [@media(max-height:700px)]:text-[11px] text-slate-500 dark:text-slate-400 mt-1 [@media(max-height:700px)]:mt-0.5">
                {isSaasAdminLogin 
                  ? 'Acesso Master: Painel de Gestão de Lojas e Servidor' 
                  : 'Acesse o painel operacional com sua matrícula e senha'}
              </p>
            </div>
          </div>

          {/* Feedback de Desconexão por Desligamento da Empresa */}
          {disconnectedMessage && (
            <div className="p-3 [@media(max-height:700px)]:p-2.5 rounded-2xl bg-rose-500/15 border-2 border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex flex-col gap-2 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 font-black text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
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
            <div className="p-3 [@media(max-height:700px)]:p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 [@media(max-height:700px)]:space-y-2.5 text-xs">
            {/* Campo Usuário / Matrícula (sempre em MAIÚSCULAS) */}
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
                  onChange={e => setMatricula(e.target.value.toUpperCase())}
                  placeholder="DIGITE SUA MATRÍCULA (EX: OPERADOR, ADMIN OU @200309)"
                  required
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="username"
                  spellCheck={false}
                  maxLength={64}
                  className={`w-full pl-10 pr-4 py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none font-medium uppercase transition ${
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
                  autoComplete="current-password"
                  className={`w-full pl-10 pr-11 py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none font-medium transition ${
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
              className={`w-full py-3.5 [@media(max-height:700px)]:py-3 px-4 rounded-2xl bg-gradient-to-r text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 disabled:opacity-50 ${
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
      <footer className="w-full max-w-md mx-auto text-center space-y-1.5 shrink-0">
        <div className="flex items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400 [@media(max-height:600px)]:hidden">
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
        <div className="text-[11px] [@media(max-height:600px)]:text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
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
    </div>
  );
};
