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
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PWAInstallBanner } from '../../pwa/PWAInstallBanner';

export const ConfiguracoesTab: React.FC = () => {
  const { 
    darkMode, 
    toggleDarkMode, 
    effectiveOnline, 
    isSimulatedOffline, 
    toggleSimulatedOffline, 
    offlineQueue, 
    syncOfflineQueue, 
    clearOfflineQueue, 
    operator, 
    resetAllData 
  } = useApp();

  const [resetConfirm, setResetConfirm] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  const handleClearCache = async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2000);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
          Configurações & PWA
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Ajustes do dispositivo, diagnóstico do Service Worker, sincronização e preferências operacionais.
        </p>
      </div>

      {/* PWA Install Banner */}
      <PWAInstallBanner />

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

        {/* Perfil Operador */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-500">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">{operator.name}</p>
              <p className="text-[11px] text-slate-400">
                Matrícula {operator.code} • {operator.role}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-400">{operator.store}</span>
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
      <div className="text-center pt-2 pb-6 space-y-1">
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
          SuperPWA OpSys • Versão 2.1.0 PWA Standard
        </p>
        <p className="text-[10px] text-slate-400">
          Suporte completo a Chrome, Edge, Safari iOS, coletores Zebra / Honeywell e Android PWA
        </p>
      </div>
    </div>
  );
};
