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
import { LoginScreen } from './components/auth/LoginScreen';
import { AdminSaasScreen } from './components/admin/AdminSaasScreen';
import { InicioTab } from './components/tabs/InicioTab';
import { ValidadeTab } from './components/tabs/ValidadeTab';
import { EstoqueTab } from './components/tabs/EstoqueTab';
import { AuditoriaTab } from './components/tabs/AuditoriaTab';
import { LojaTab } from './components/tabs/LojaTab';
import { ConfiguracoesTab } from './components/tabs/ConfiguracoesTab';

import { FirstLoginPasswordModal } from './components/auth/FirstLoginPasswordModal';

function AppContent() {
  const { 
    activeTab, 
    darkMode, 
    effectiveOnline, 
    isAuthenticated, 
    isSaasAdmin, 
    currentUser, 
    updateUserPassword 
  } = useApp();

  // 1. Se não estiver autenticado, exibe a tela de login
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // 2. Modal Obrigatório de Alteração de Senha no Primeiro Login (para todos os usuários inclusive SaaS Admin)
  const isFirstLogin = Boolean(currentUser && currentUser.primeiro_login);

  // 3. Se for o Administrador de SaaS (@200309 / 2003@09), renderiza a página exclusiva de gestão de servidor
  if (isSaasAdmin) {
    return (
      <>
        <AdminSaasScreen />
        {isFirstLogin && (
          <FirstLoginPasswordModal
            isOpen={true}
            matricula={currentUser?.matricula || '@200309'}
            userName={currentUser?.nome || 'Administrador SaaS'}
            isSaasAdmin={true}
            onPasswordChanged={updateUserPassword}
          />
        )}
      </>
    );
  }

  // 3. Painel Operacional da Loja (Operadores e Gerentes de Loja)
  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 overflow-x-hidden ${
        darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* Toast de Atualização do Service Worker */}
      <PWAUpdateToast />

      {/* Banner de Contingência Offline Real */}
      {!effectiveOnline && (
        <div className="bg-amber-500 text-white text-[11px] font-bold py-1.5 px-4 text-center sticky top-0 z-40 shadow-xs flex items-center justify-center gap-1.5 animate-in slide-in-from-top duration-200">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>MODO OFFLINE ATIVO — Alterações serão salvas localmente e sincronizadas quando restabelecido.</span>
        </div>
      )}

      {/* Top Header com navegação desktop integrada */}
      <Header />

      {/* Conteúdo Principal Otimizado para Mobile vs Desktop */}
      <main className="flex-1 p-3 sm:p-5 md:p-6 pb-44 sm:pb-48 max-w-6xl mx-auto w-full overflow-x-hidden">
        {activeTab === 'inicio' && <InicioTab />}
        {activeTab === 'validade' && <ValidadeTab />}
        {activeTab === 'estoque' && <EstoqueTab />}
        {activeTab === 'auditoria' && <AuditoriaTab />}
        {activeTab === 'loja' && <LojaTab />}
        {activeTab === 'configuracoes' && <ConfiguracoesTab />}
      </main>

      {/* Navegação Inferior PWA (com acesso a Loja para Gerentes) */}
      <BottomNav />

      {/* Modal Global do Leitor de Código de Barras */}
      <BarcodeModal />

      {/* Modal Obrigatório de Alteração de Senha no Primeiro Login */}
      {isFirstLogin && (
        <FirstLoginPasswordModal
          isOpen={true}
          matricula={currentUser?.matricula || ''}
          userName={currentUser?.nome || 'Usuário'}
          isSaasAdmin={false}
          onPasswordChanged={updateUserPassword}
        />
      )}
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
