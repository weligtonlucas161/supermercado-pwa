import React, { useState, useEffect } from 'react';
import { Download, ShieldCheck, RefreshCw, User, ChevronRight, Check } from 'lucide-react';

export default function ConfiguracoesTab({ isOnline }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') setIsInstalled(true);
        setDeferredPrompt(null);
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Configurações & PWA</h2>
        <p className="text-xs text-slate-500">Ajustes do dispositivo e sincronização.</p>
      </div>

      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-bold">Aplicativo PWA OpSys</h3>
            <p className="text-[11px] text-slate-300">Instale na tela inicial para usar o scanner.</p>
          </div>
        </div>
        <button 
          onClick={handleInstallClick}
          disabled={!deferredPrompt && !isInstalled}
          className={`mt-3 w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
            deferredPrompt ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isInstalled ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          {isInstalled ? 'Aplicativo Instalado' : deferredPrompt ? 'Instalar App' : 'PWA Pronto'}
        </button>
      </div>

      <div className="rounded-2xl border bg-white border-slate-200 divide-y divide-slate-100">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-xs font-bold">Sincronização Offline</p>
              <p className="text-[11px] text-slate-400">{isOnline ? 'Sincronizado' : 'Salvando localmente'}</p>
            </div>
          </div>
          <RefreshCw className={`w-4 h-4 text-slate-400 ${isOnline ? 'animate-spin' : ''}`} />
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-xs font-bold">Operador</p>
              <p className="text-[11px] text-slate-400">Carlos Silva (#4092)</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </div>
  );
}