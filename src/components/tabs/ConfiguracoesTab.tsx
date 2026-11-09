import React, { useState } from 'react';
import { 
  Moon, 
  Sun, 
  ShieldCheck, 
  RefreshCw, 
  User, 
  ChevronRight, 
  Download, 
  Trash2, 
  HardDrive, 
  Radio, 
  Check, 
  Layers,
  Database,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Sparkles,
  FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PWAInstallBanner } from '../../pwa/PWAInstallBanner';
import { 
  isSupabaseConfigured, 
  testSupabaseConnection, 
  setCustomSupabaseConfig, 
  clearCustomSupabaseConfig, 
  getSupabaseConfigInfo 
} from '../../services/supabaseService';
import { PatchNotesModal } from '../modals/PatchNotesModal';
import { TermsModal } from '../modals/TermsModal';

export const ConfiguracoesTab: React.FC = () => {
  const { 
    darkMode, 
    toggleDarkMode, 
    effectiveOnline, 
    isSimulatedOffline, 
    toggleSimulatedOffline, 
    offlineQueue, 
    syncOfflineQueue, 
    operator, 
    resetAllData,
    logout 
  } = useApp();

  const [resetConfirm, setResetConfirm] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Estados de Configuração do Supabase
  const configInfo = getSupabaseConfigInfo();
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(configInfo.url || '');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState('');
  const [isEditingConfig, setIsEditingConfig] = useState(!configInfo.isConfigured);
  const [configFeedback, setConfigFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const handleClearCache = async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2000);
  };

  const handleSaveSupabaseConfig = async () => {
    setConfigFeedback(null);
    setSupabaseTestResult(null);

    const result = setCustomSupabaseConfig(supabaseUrlInput, supabaseKeyInput);
    if (!result.success) {
      setConfigFeedback(result);
      return;
    }

    // Testa a conexão imediatamente após salvar
    setTestingSupabase(true);
    const testResult = await testSupabaseConnection();
    setTestingSupabase(false);
    setSupabaseTestResult(testResult);
    if (testResult.success) {
      setConfigFeedback({ success: true, message: 'Supabase conectado com sucesso!' });
      setIsEditingConfig(false);
    } else {
      setConfigFeedback({ success: false, message: testResult.message });
    }
  };

  const handleDisconnectSupabase = () => {
    clearCustomSupabaseConfig();
    setSupabaseUrlInput('');
    setSupabaseKeyInput('');
    setSupabaseTestResult(null);
    setConfigFeedback({ success: true, message: 'Configuração do Supabase removida. O app está operando em Modo Local.' });
    setIsEditingConfig(true);
  };

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    setSupabaseTestResult(null);
    const result = await testSupabaseConnection();
    setSupabaseTestResult(result);
    setTestingSupabase(false);
  };

  const hasSupabase = isSupabaseConfigured();

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
          Configurações & PWA
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Ajustes do dispositivo, diagnóstico do Service Worker, banco Supabase e preferências operacionais.
        </p>
      </div>

      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Card de Conexão com o Banco de Dados Supabase */}
      <div
        className={`p-4 sm:p-5 rounded-3xl border ${
          darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
        } shadow-sm space-y-4`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-2xl ${hasSupabase ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                Banco de Dados Supabase (PostgreSQL)
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  hasSupabase 
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}>
                  {hasSupabase ? 'Conectado na Nuvem' : 'Modo Local / Desconectado'}
                </span>
              </h4>
              <p className="text-[11px] text-slate-400">
                {hasSupabase 
                  ? 'Sincronização em nuvem ativa com as tabelas produtos, catálogo universal e logs.' 
                  : 'Insira a URL e Chave Anon do seu projeto Supabase para gravar e importar dados na nuvem.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingConfig(!isEditingConfig)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition"
            >
              {isEditingConfig ? 'Fechar Edição' : 'Configurar Conexão'}
            </button>
            {hasSupabase && (
              <button
                onClick={handleTestSupabase}
                disabled={testingSupabase}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingSupabase ? 'animate-spin' : ''}`} />
                <span>Testar Conexão</span>
              </button>
            )}
          </div>
        </div>

        {/* Formulário de Configuração do Supabase */}
        {isEditingConfig && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Credenciais do Projeto Supabase
              </span>
              <span className="text-[10px] text-slate-400">
                Obtido em Supabase Dashboard → Settings → API
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  URL do Projeto (Project URL)
                </label>
                <input
                  type="text"
                  value={supabaseUrlInput}
                  onChange={e => setSupabaseUrlInput(e.target.value)}
                  placeholder="https://seu-projeto-id.supabase.co"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Chave Pública Anônima (Anon Key / Public API Key)
                </label>
                <input
                  type="password"
                  value={supabaseKeyInput}
                  onChange={e => setSupabaseKeyInput(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {hasSupabase && (
                  <button
                    type="button"
                    onClick={handleDisconnectSupabase}
                    className="text-xs text-rose-500 hover:underline font-semibold"
                  >
                    Desconectar Supabase
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveSupabaseConfig}
                  disabled={!supabaseUrlInput || !supabaseKeyInput || testingSupabase}
                  className="ml-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar & Conectar ao Banco</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {configFeedback && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in ${
              configFeedback.success
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
            }`}
          >
            {configFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            )}
            <span>{configFeedback.message}</span>
          </div>
        )}

        {supabaseTestResult && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in ${
              supabaseTestResult.success
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
            }`}
          >
            {supabaseTestResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
            )}
            <span>{supabaseTestResult.message}</span>
          </div>
        )}
      </div>

      {/* Painel de Preferências */}
      <div
        className={`rounded-3xl border divide-y ${
          darkMode
            ? 'bg-slate-800/80 border-slate-700 divide-slate-700'
            : 'bg-white border-slate-200 divide-slate-100'
        } shadow-sm overflow-hidden`}
      >
        {/* Dark Mode */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${darkMode ? 'bg-indigo-500/15 text-indigo-400' : 'bg-amber-500/15 text-amber-500'}`}>
              {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Modo Escuro (Dark Theme)</p>
              <p className="text-[11px] text-slate-400">Economiza bateria em coletores e displays OLED</p>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
              darkMode ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
            }`}
            aria-label="Alternar tema"
          >
            <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
          </button>
        </div>

        {/* Simular Offline (Ideal para testes em bancada) */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isSimulatedOffline ? 'bg-amber-500/15 text-amber-500' : 'bg-blue-500/15 text-blue-500'}`}>
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Simular Modo Offline</p>
              <p className="text-[11px] text-slate-400">
                {isSimulatedOffline ? 'Forçado offline para teste de contingência' : 'Conexão padrão do navegador'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleSimulatedOffline}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              isSimulatedOffline
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {isSimulatedOffline ? 'Offline Ativo' : 'Simular'}
          </button>
        </div>

        {/* Status de Sincronização */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-500">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Fila de Sincronização Local</p>
              <p className="text-[11px] text-slate-400">
                {offlineQueue.length > 0
                  ? `${offlineQueue.length} alterações gravadas localmente aguardando envio`
                  : 'Nenhuma alteração pendente (tudo sincronizado)'}
              </p>
            </div>
          </div>
          {offlineQueue.length > 0 && (
            <button
              onClick={syncOfflineQueue}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sincronizar
            </button>
          )}
        </div>

        {/* Perfil Operador & Logout */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-500">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">{operator.name}</p>
              <p className="text-[11px] text-slate-400">
                Matrícula {operator.code} • Cargo: {operator.role}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">{operator.store}</span>
            <button
              onClick={logout}
              className="px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-bold flex items-center gap-1.5 transition"
              title="Encerrar Sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Diagnóstico PWA & Armazenamento */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 ${
          darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
        } shadow-sm space-y-3`}
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Layers className="w-4 h-4 text-emerald-500" />
          <span>Diagnóstico de Service Worker & Cache</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Service Worker</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Ativo & Registrado</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Estratégia Workbox</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">Stale-While-Revalidate</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={handleClearCache}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition"
          >
            <HardDrive className="w-3.5 h-3.5" />
            {cacheCleared ? 'Cache Limpo!' : 'Limpar Caches do Navegador'}
          </button>

          {!resetConfirm ? (
            <button
              onClick={() => setResetConfirm(true)}
              className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Resetar Dados Locais
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  resetAllData();
                  setResetConfirm(false);
                }}
                className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
              >
                Confirmar Reset Geral
              </button>
              <button
                onClick={() => setResetConfirm(false)}
                className="text-xs text-slate-400 hover:underline"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé Informativo */}
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
          SuperPWA OpSys • No-Copyright (Domínio Público) • Synk 2026.1
        </p>
        <p className="text-[10px] text-slate-400">
          Suporte completo a Chrome, Edge, Safari iOS, coletores Zebra / Honeywell e Android PWA
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
