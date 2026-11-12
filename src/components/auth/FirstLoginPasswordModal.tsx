import React, { useState, useMemo } from 'react';
import { 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  ShieldCheck, 
  AlertTriangle,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

interface FirstLoginPasswordModalProps {
  isOpen: boolean;
  matricula: string;
  userName: string;
  isSaasAdmin?: boolean;
  onPasswordChanged: (newPassword: string) => Promise<{ success: boolean; message?: string }>;
  onClose?: () => void;
}

export const FirstLoginPasswordModal: React.FC<FirstLoginPasswordModalProps> = ({
  isOpen,
  matricula,
  userName,
  isSaasAdmin = false,
  onPasswordChanged,
  onClose,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cálculo da Força da Senha
  const strength = useMemo(() => {
    const pwd = newPassword;
    const checks = {
      length: pwd.length >= 7,
      hasUpper: /[A-Z]/.test(pwd),
      hasLower: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[^A-Za-z0-9]/.test(pwd),
    };

    let score = 0;
    if (checks.length) score += 1;
    if (checks.hasUpper && checks.hasLower) score += 1;
    if (checks.hasNumber) score += 1;
    if (checks.hasSpecial) score += 1;

    let label = 'Muito Fraca';
    let color = 'bg-rose-500';
    let textColor = 'text-rose-500';
    let widthPercent = 20;

    if (!checks.length) {
      label = 'Muito Fraca (mínimo 7 caracteres)';
      color = 'bg-rose-500';
      textColor = 'text-rose-500';
      widthPercent = 20;
    } else if (score <= 1) {
      label = 'Fraca';
      color = 'bg-rose-500';
      textColor = 'text-rose-500';
      widthPercent = 35;
    } else if (score === 2) {
      label = 'Média';
      color = 'bg-amber-500';
      textColor = 'text-amber-500';
      widthPercent = 65;
    } else {
      label = 'Forte';
      color = 'bg-emerald-500';
      textColor = 'text-emerald-500';
      widthPercent = 100;
    }

    return {
      checks,
      score,
      label,
      color,
      textColor,
      widthPercent,
      isValid: checks.length,
    };
  }, [newPassword]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 7) {
      setErrorMessage('A nova senha deve ter no mínimo 7 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('A confirmação de senha não coincide com a nova senha digitada.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await onPasswordChanged(newPassword);
      if (!result.success) {
        setErrorMessage(result.message || 'Erro ao atualizar a senha. Tente novamente.');
      }
    } catch {
      setErrorMessage('Ocorreu um erro ao salvar a nova senha.');
    } finally {
      setIsLoading(false);
    }
  };

  const accentColorClass = isSaasAdmin ? 'text-rose-500' : 'text-emerald-500';
  const buttonGradientClass = isSaasAdmin 
    ? 'from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-600/30' 
    : 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/25';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Fechar (definir senha mais tarde)"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        
        {/* Cabeçalho */}
        <div className="text-center space-y-2">
          <div className={`w-14 h-14 mx-auto rounded-3xl flex items-center justify-center text-white font-black text-2xl shadow-lg ring-4 ${
            isSaasAdmin 
              ? 'bg-gradient-to-tr from-rose-600 to-red-500 shadow-rose-600/30 ring-rose-500/15'
              : 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-600/30 ring-emerald-500/15'
          }`}>
            <KeyRound className="w-7 h-7" />
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Primeiro Acesso ao Sistema
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1.5">
              Alteração Obrigatória de Senha
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Olá, <strong>{userName}</strong> ({matricula}). Por motivos de segurança, defina sua nova senha pessoal antes de acessar.
            </p>
          </div>
        </div>

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Nova Senha */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
              Nova Senha (Mínimo 7 caracteres)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Crie sua nova senha segura"
                required
                autoFocus
                className="w-full pl-10 pr-11 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-medium transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Medidor de Força da Senha */}
          {newPassword.length > 0 && (
            <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-750">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-bold">Força da Senha:</span>
                <span className={`font-black ${strength.textColor}`}>
                  {strength.label}
                </span>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${strength.color}`} 
                  style={{ width: `${strength.widthPercent}%` }}
                />
              </div>

              {/* Checklist de Critérios */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                <div className={`flex items-center gap-1 font-semibold ${
                  strength.checks.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                }`}>
                  {strength.checks.length ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  <span>Mínimo 7 caracteres</span>
                </div>
                <div className={`flex items-center gap-1 font-semibold ${
                  strength.checks.hasUpper && strength.checks.hasLower ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                }`}>
                  {strength.checks.hasUpper && strength.checks.hasLower ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  <span>Maiúsculas e minúsculas</span>
                </div>
                <div className={`flex items-center gap-1 font-semibold ${
                  strength.checks.hasNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                }`}>
                  {strength.checks.hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  <span>Números (0-9)</span>
                </div>
                <div className={`flex items-center gap-1 font-semibold ${
                  strength.checks.hasSpecial ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                }`}>
                  {strength.checks.hasSpecial ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  <span>Símbolo especial (@, #, $)</span>
                </div>
              </div>
            </div>
          )}

          {/* Confirmar Nova Senha */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                required
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-medium transition"
              />
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] text-rose-500 font-semibold pt-0.5">
                As senhas digitadas não coincidem.
              </p>
            )}
          </div>

          {/* Botão de Confirmação */}
          <button
            type="submit"
            disabled={isLoading || !strength.isValid || newPassword !== confirmPassword}
            className={`w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${buttonGradientClass}`}
          >
            {isLoading ? (
              <span>Salvando nova senha...</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Salvar Nova Senha e Acessar</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              Lembrar mais tarde (Fechar)
            </button>
          )}
        </form>

        <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>Sua nova senha criptografada será exigida nos próximos acessos.</span>
        </div>
      </div>
    </div>
  );
};
