/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { getDbClient } from './services/db/client';
import { fetchStockPaginatedFromSupabase } from './services/supabaseService';
import { setEncryptedCache, invalidateStockCache } from './utils/encryptedCache';
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

import { PasskeyEnrollmentModal } from './components/auth/PasskeyEnrollmentModal';
import { FirstLoginPasswordModal } from './components/auth/FirstLoginPasswordModal';
import { StoreChatModal } from './components/chat/StoreChatModal';

function AppContent() {
  const { 
    activeTab, 
    darkMode, 
    effectiveOnline, 
    isAuthenticated, 
    isSaasAdmin, 
    currentUser, 
    updateUserPassword,
    logout,
    storeColor
  } = useApp();

  // Modal de Alteração de Senha no Primeiro Login com opção de fechar
  const [isFirstLoginDismissed, setIsFirstLoginDismissed] = useState(false);
  const showFirstLoginModal = Boolean(currentUser && currentUser.primeiro_login) && !isFirstLoginDismissed;

  // Presença leve: um único ping/minuto por sessão; nunca consulta catálogo.
  const lastInteraction = useRef(Date.now());
  const lastConfirmedPing = useRef(Date.now());
  const sendingPing = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    let disposed = false;
    const client = getDbClient();
    if (!client) return;
    lastInteraction.current = Date.now();
    lastConfirmedPing.current = Date.now();
    const markActivity = () => { lastInteraction.current = Date.now(); };
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach(event => window.addEventListener(event, markActivity, { passive: true }));
    const ping = async () => {
      if (disposed || sendingPing.current) return;
      // Abas suspensas não executam timers: verificar imediatamente ao retornar.
      if (Date.now() - lastConfirmedPing.current >= 5 * 60_000) {
        disposed = true;
        void client.auth.signOut();
        logout(true);
        return;
      }
      sendingPing.current = true;
      try {
        const { data: identity, error: identityError } = await client.auth.getUser();
        if (disposed || identityError || !identity.user) return;
        const status = document.visibilityState === 'hidden' || Date.now() - lastInteraction.current >= 2 * 60_000
          ? 'repouso' : 'ativo';
        const { error } = await client.from('presenca_usuarios').upsert({
          auth_user_id: identity.user.id,
          loja_id: currentUser.loja_id || null,
          status,
          ultimo_ping: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'auth_user_id' });
        if (!error && !disposed) lastConfirmedPing.current = Date.now();
      } catch (error) {
        console.warn('Falha no ping de presença:', error);
      } finally {
        sendingPing.current = false;
      }
    };
    const interval = window.setInterval(() => { void ping(); }, 60_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') void ping(); };
    document.addEventListener('visibilitychange', onVisibility);
    void ping();
    return () => {
      disposed = true;
      window.clearInterval(interval);
      events.forEach(event => window.removeEventListener(event, markActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated, currentUser?.id, currentUser?.loja_id]);

  const [preparingData, setPreparingData] = useState(false);
  const [preparedUser, setPreparedUser] = useState('');
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id || isSaasAdmin || !currentUser.loja_id) {
      setPreparingData(false);
      return;
    }
    const userKey = currentUser.id + ':' + currentUser.loja_id + ':' + currentUser.setor;
    if (preparedUser === userKey) return;
    let cancelled = false;
    setPreparingData(true);
    // Remover caches de outros usuários/setores antes de preparar a sessão.
    invalidateStockCache(currentUser.loja_id);
    const prepare = async () => {
      try {
        const result = await fetchStockPaginatedFromSupabase({
          lojaId: currentUser.loja_id!, page: 0, pageSize: 50,
        });
        if (!cancelled) await setEncryptedCache(
          `${currentUser.loja_id}_${currentUser.matricula}_${currentUser.setor}_initial`,
          { items: result.items, totalCount: result.totalCount, loadedAt: Date.now() }
        );
      } catch (error) { console.warn('Preparação inicial do estoque:', error); }
      finally { if (!cancelled) { setPreparedUser(userKey); setPreparingData(false); } }
    };
    void prepare();
    return () => { cancelled = true; };
  }, [isAuthenticated, currentUser?.id, currentUser?.loja_id, currentUser?.setor, isSaasAdmin, preparedUser]);

  // 1. Se não estiver autenticado, exibe a tela de login
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (preparingData && !isSaasAdmin) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-4"><div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /><h1 className="text-lg font-bold">Preparando os dados do seu setor</h1><p className="text-sm text-slate-300">Carregando estoque autorizado e preparando cache criptografado...</p></div>;

  // 3. Se for o Administrador de SaaS (@200309 / 2003@09), renderiza a página exclusiva de gestão de servidor
  if (isSaasAdmin) {
    return (
      <>
        <AdminSaasScreen />
        {currentUser && <PasskeyEnrollmentModal userId={currentUser.id} firstLogin={Boolean(currentUser.primeiro_login)} />}
        {showFirstLoginModal && (
          <FirstLoginPasswordModal
            isOpen={true}
            matricula={currentUser?.matricula || ''}
            userName={currentUser?.nome || 'Administrador SaaS'}
            isSaasAdmin={true}
            onPasswordChanged={updateUserPassword}
            onClose={() => setIsFirstLoginDismissed(true)}
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

      {/* Faixa decorativa sutil da identidade visual da loja */}
      <div
        className="h-1 w-full shrink-0"
        style={{ backgroundColor: storeColor, opacity: 0.75 }}
        aria-hidden="true"
      />

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

      {/* Modal Global de Chat Operacional da Loja e Canal de Líderes */}
      <StoreChatModal />

      {currentUser && <PasskeyEnrollmentModal userId={currentUser.id} firstLogin={Boolean(currentUser.primeiro_login)} />}
      {/* Modal de Alteração de Senha no Primeiro Login */}
      {showFirstLoginModal && (
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
