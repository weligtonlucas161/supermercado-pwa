/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { BarcodeModal } from './components/common/BarcodeModal';
import { PWAUpdateToast } from './pwa/PWAUpdateToast';
import { InicioTab } from './components/tabs/InicioTab';
import { ValidadeTab } from './components/tabs/ValidadeTab';
import { EstoqueTab } from './components/tabs/EstoqueTab';
import { AuditoriaTab } from './components/tabs/AuditoriaTab';
import { ConfiguracoesTab } from './components/tabs/ConfiguracoesTab';

function AppContent() {
  const { activeTab, darkMode, effectiveOnline } = useApp();

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* Toast de Atualização do Service Worker */}
      <PWAUpdateToast />

      {/* Banner de Contingência Offline */}
      {!effectiveOnline && (
        <div className="bg-amber-500 text-white text-[11px] font-bold py-1.5 px-4 text-center sticky top-0 z-40 shadow-xs flex items-center justify-center gap-1.5 animate-in slide-in-from-top duration-200">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>MODO OFFLINE ATIVO — Alterações serão salvas localmente e sincronizadas quando restabelecido.</span>
        </div>
      )}

      {/* Top Header */}
      <Header />

      {/* Conteúdo Principal da Aba Ativa */}
      <main className="flex-1 p-3.5 sm:p-5 pb-28 max-w-4xl mx-auto w-full">
        {activeTab === 'inicio' && <InicioTab />}
        {activeTab === 'validade' && <ValidadeTab />}
        {activeTab === 'estoque' && <EstoqueTab />}
        {activeTab === 'auditoria' && <AuditoriaTab />}
        {activeTab === 'configuracoes' && <ConfiguracoesTab />}
      </main>

      {/* Navegação Inferior PWA */}
      <BottomNav />

      {/* Modal Global do Leitor de Código de Barras */}
      <BarcodeModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
