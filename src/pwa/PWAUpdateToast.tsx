import React from 'react';
import { RefreshCw, CheckCircle2, X } from 'lucide-react';
import { usePWARegistration } from './useRegisterSW';

export const PWAUpdateToast: React.FC = () => {
  const { needRefresh, offlineReady, updateServiceWorker, closePrompt } = usePWARegistration();

  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
      {needRefresh ? (
        <div className="bg-slate-900/95 dark:bg-emerald-950/95 text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-500/40 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <RefreshCw className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Nova versão disponível!</p>
              <p className="text-[11px] text-slate-300">Atualize para carregar as novas melhorias.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={updateServiceWorker}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors shadow-sm"
            >
              Atualizar
            </button>
            <button
              onClick={closePrompt}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : offlineReady ? (
        <div className="bg-slate-900/95 text-white p-3 rounded-2xl shadow-2xl border border-emerald-500/30 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-xs font-medium text-slate-200">
              SuperPWA pronto para funcionar 100% offline!
            </p>
          </div>
          <button
            onClick={closePrompt}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
};
