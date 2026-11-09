import React, { useState } from 'react';
import { Download, Check, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

interface PWAInstallBannerProps {
  compact?: boolean;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500 font-bold">
          <Check className="w-3.5 h-3.5" /> PWA Ativo
        </span>
      );
    }
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-3xl p-4 flex items-center gap-3.5 shadow-xs">
        <div className="p-2.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
          <Check className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">SuperPWA OpSys Instalado</h4>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            O PWA já está ativo neste dispositivo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-lg border border-slate-700 relative overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Instalar SuperPWA OpSys</h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Instale no coletor ou smartphone para usar o leitor e operar sem internet.
              </p>
            </div>
          </div>
          {compact && (
            <button
              onClick={() => setDismissed(true)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="mt-3">
          {isInstallable ? (
            <button
              onClick={install}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Instalar SuperPWA OpSys
            </button>
          ) : isIOS ? (
            <button
              onClick={() => setShowIOSModal(true)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <Share2 className="w-4 h-4" />
              Instalar no iPhone / iPad (Safari)
            </button>
          ) : (
            <div className="flex items-center justify-between bg-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300 border border-slate-700/60">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                PWA Ativo no Navegador
              </span>
              <span className="text-[11px] text-slate-400">Use "Adicionar à Tela Inicial"</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal Guia para iOS Safari */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-500" /> Como Instalar no iOS
              </h3>
              <button
                onClick={() => setShowIOSModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  1
                </div>
                <div>
                  No Safari, toque no botão <strong>Compartilhar</strong> (ícone com quadrado e seta para cima no rodapé).
                </div>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  2
                </div>
                <div>
                  Role para baixo na lista de opções e selecione <strong>Adicionar à Tela de Início</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-slate-400" />.
                </div>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  3
                </div>
                <div>
                  Toque em <strong>Adicionar</strong> no canto superior direito para finalizar.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};
