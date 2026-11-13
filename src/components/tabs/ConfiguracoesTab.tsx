import React, { useState } from 'react';
import { 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Vibrate, 
  Bell, 
  Tag, 
  User, 
  Building2, 
  LogOut, 
  Trash2, 
  Sparkles, 
  FileText,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PWAInstallBanner } from '../../pwa/PWAInstallBanner';
import { SETORES_DISPONIVEIS, SetorLoja } from '../../types';
import { PatchNotesModal } from '../modals/PatchNotesModal';
import { TermsModal } from '../modals/TermsModal';
import { triggerScanBeep } from '../../utils/haptics';

export const ConfiguracoesTab: React.FC = () => {
  const { 
    operator, 
    currentUser, 
    updateUserPassword, 
    resetAllData, 
    logout, 
    darkMode,
    storeName,
    storeColor
  } = useApp();

  // Estados de Alteração de Senha
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Preferências Operacionais Locais
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('superpwa_sound_enabled') !== 'false';
  });
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(() => {
    return localStorage.getItem('superpwa_vibration_enabled') !== 'false';
  });
  const [chatNotifsEnabled, setChatNotifsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('superpwa_chat_notifs_enabled') !== 'false';
  });
  const [preferredSector, setPreferredSector] = useState<string>(() => {
    return localStorage.getItem('superpwa_preferred_sector') || 'TODOS';
  });

  // Modais Informativos
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('superpwa_sound_enabled', String(enabled));
    if (enabled) triggerScanBeep(true);
    showTempPreferencesSaved();
  };

  const handleToggleVibration = (enabled: boolean) => {
    setVibrationEnabled(enabled);
    localStorage.setItem('superpwa_vibration_enabled', String(enabled));
    if (enabled && 'vibrate' in navigator) navigator.vibrate(50);
    showTempPreferencesSaved();
  };

  const handleToggleChatNotifs = async (enabled: boolean) => {
    setChatNotifsEnabled(enabled);
    localStorage.setItem('superpwa_chat_notifs_enabled', String(enabled));
    if (enabled && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
    showTempPreferencesSaved();
  };

  const handleSectorChange = (sector: string) => {
    setPreferredSector(sector);
    localStorage.setItem('superpwa_preferred_sector', sector);
    showTempPreferencesSaved();
  };

  const showTempPreferencesSaved = () => {
    setPreferencesSaved(true);
    setTimeout(() => setPreferencesSaved(false), 2000);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordNotice(null);

    if (newPasswordInput.length < 7) {
      setPasswordNotice({
        type: 'error',
        message: 'A nova senha deve ter no mínimo 7 caracteres.',
      });
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordNotice({
        type: 'error',
        message: 'A confirmação de senha não coincide com a nova senha digitada.',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await updateUserPassword(newPasswordInput);
      if (res.success) {
        triggerScanBeep(true);
        setPasswordNotice({
          type: 'success',
          message: 'Sua senha foi alterada com sucesso! Use a nova senha nos próximos logins.',
        });
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
      } else {
        setPasswordNotice({
          type: 'error',
          message: res.message || 'Erro ao alterar a senha. Tente novamente.',
        });
      }
    } catch {
      setPasswordNotice({
        type: 'error',
        message: 'Falha de comunicação ao atualizar senha. Verifique sua conexão.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: storeColor }}
            aria-hidden="true"
          />
          Ajustes & Preferências
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Personalização operacional, segurança de acesso da conta e configurações da unidade.
        </p>
      </div>

      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* 1. SEÇÃO DE SEGURANÇA: ALTERAÇÃO DE SENHA */}
      <div className={`p-4 sm:p-5 rounded-3xl border ${
        darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
      } shadow-sm space-y-4`}>
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Segurança da Conta & Alteração de Senha
            </h3>
            <p className="text-[11px] text-slate-400">
              Altere a sua senha de login no sistema SuperPWA OpSys (mínimo de 7 caracteres).
            </p>
          </div>
        </div>

        {passwordNotice && (
          <div className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in ${
            passwordNotice.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
          }`}>
            {passwordNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{passwordNotice.message}</span>
          </div>
        )}

        <form onSubmit={handleChangePasswordSubmit} className="space-y-3 max-w-md text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
              Nova Senha (Mínimo 7 caracteres) *
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                value={newPasswordInput}
                onChange={e => setNewPasswordInput(e.target.value)}
                placeholder="Digite a nova senha segura"
                className="w-full p-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
              Confirmar Nova Senha *
            </label>
            <input
              type={showNewPassword ? 'text' : 'password'}
              required
              value={confirmPasswordInput}
              onChange={e => setConfirmPasswordInput(e.target.value)}
              placeholder="Digite novamente a nova senha"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {confirmPasswordInput && newPasswordInput !== confirmPasswordInput && (
              <p className="text-[10px] text-rose-500 font-bold mt-1">As senhas não coincidem.</p>
            )}
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isChangingPassword || newPasswordInput.length < 7 || newPasswordInput !== confirmPasswordInput}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isChangingPassword ? 'Atualizando Senha...' : 'Salvar Nova Senha'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. SEÇÃO: PREFERÊNCIAS OPERACIONAIS */}
      <div className={`p-4 sm:p-5 rounded-3xl border ${
        darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
      } shadow-sm space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Alertas Sonoros & Resposta Tátil
              </h3>
              <p className="text-[11px] text-slate-400">
                Ajuste os feedbacks de áudio e vibração para leituras com coletores e celulares.
              </p>
            </div>
          </div>
          {preferencesSaved && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
              ✓ Preferência salva
            </span>
          )}
        </div>

        <div className="space-y-2.5 text-xs">
          <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 cursor-pointer">
            <div className="flex items-center gap-3">
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                  Bip Sonoro na Leitura de Código de Barras
                </span>
                <span className="text-[10px] text-slate-400">
                  Emite um som agudo característico de coletor a cada bipagem confirmada.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={e => handleToggleSound(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 cursor-pointer">
            <div className="flex items-center gap-3">
              <Vibrate className="w-4 h-4 text-emerald-500" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                  Vibração ao Identificar Produto
                </span>
                <span className="text-[10px] text-slate-400">
                  Gera feedback háptico em smartphones e coletores móveis compatíveis.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={vibrationEnabled}
              onChange={e => handleToggleVibration(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 cursor-pointer">
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-emerald-500" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                  Notificações de Mensagens do Chat da Loja
                </span>
                <span className="text-[10px] text-slate-400">
                  Alerta sonoro e visual instantâneo quando colaboradores enviarem comunicados no grupo.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={chatNotifsEnabled}
              onChange={e => handleToggleChatNotifs(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* 3. SEÇÃO: PREFERÊNCIA DE SETOR OPERACIONAL */}
      <div className={`p-4 sm:p-5 rounded-3xl border ${
        darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
      } shadow-sm space-y-3`}>
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Setor Operacional de Preferência
            </h3>
            <p className="text-[11px] text-slate-400">
              Selecione o setor padrão que será pré-selecionado automaticamente na consulta e auditoria.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <button
            type="button"
            onClick={() => handleSectorChange('TODOS')}
            className={`p-2.5 rounded-2xl font-bold border transition text-center cursor-pointer ${
              preferredSector === 'TODOS'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-750'
            }`}
          >
            Todos os Setores
          </button>
          {SETORES_DISPONIVEIS.map(setor => (
            <button
              key={setor}
              type="button"
              onClick={() => handleSectorChange(setor)}
              className={`p-2.5 rounded-2xl font-bold border transition text-center cursor-pointer ${
                preferredSector === setor
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-750'
              }`}
            >
              {setor}
            </button>
          ))}
        </div>
      </div>

      {/* 4. SEÇÃO: DADOS DO PERFIL & SESSÃO */}
      <div className={`rounded-3xl border divide-y ${
        darkMode ? 'bg-slate-800/80 border-slate-700 divide-slate-700' : 'bg-white border-slate-200 divide-slate-100'
      } shadow-sm overflow-hidden text-xs`}>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
              {operator.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                {operator.name}
              </p>
              <p className="text-[11px] text-slate-400">
                Matrícula: {operator.code} • Cargo: <span className="font-bold text-emerald-600 dark:text-emerald-400">{operator.role}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">
              {storeName}
            </span>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Encerrar Sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* Limpeza de Armazenamento Local Temporário */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200">Limpar Dados Temporários Locais</p>
            <p className="text-[11px] text-slate-400">
              Redefine caches locais e dados temporários do dispositivo em caso de manutenção.
            </p>
          </div>

          {!resetConfirm ? (
            <button
              onClick={() => setResetConfirm(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-rose-600 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/20 transition cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Local</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  resetAllData();
                  setResetConfirm(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Confirmar
              </button>
              <button
                onClick={() => setResetConfirm(false)}
                className="text-xs text-slate-400 hover:underline cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. RODAPÉ INSTITUCIONAL */}
      <div className="text-center pt-2 pb-6 space-y-2">
        <div className="flex items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <button
            onClick={() => setShowTerms(true)}
            className="hover:underline flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Termos de Uso</span>
          </button>
          <span>•</span>
          <button
            onClick={() => setShowPatchNotes(true)}
            className="hover:underline flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Notas da Versão (v2026.1.4)</span>
          </button>
        </div>

        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
          Copyright © 2026 SuperPWA OpSys. Todos os direitos reservados.
        </p>
        <p className="text-[10px] text-slate-400">
          Compatível com Chrome, Safari iOS, Edge e coletores Android Zebra / Honeywell.
        </p>
      </div>

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
