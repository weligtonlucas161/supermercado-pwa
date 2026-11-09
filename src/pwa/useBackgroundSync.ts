import { useEffect, useCallback } from 'react';

const SYNC_TAG = 'sync-supabase-pending-data';

interface UseBackgroundSyncOptions {
  onSyncTriggered?: () => void;
  hasPendingItems?: boolean;
}

export function useBackgroundSync({ onSyncTriggered, hasPendingItems }: UseBackgroundSyncOptions = {}) {
  // Solicita ao navegador / Service Worker para registrar a tarefa de Background Sync
  const requestBackgroundSync = useCallback(async () => {
    if (typeof window === 'undefined') return false;

    // 1. Tenta usar a Background Sync API nativa
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        // @ts-expect-error Background Sync API may not be in standard DOM TS lib yet
        if (reg && 'sync' in reg && typeof reg.sync.register === 'function') {
          // @ts-expect-error sync is on ServiceWorkerRegistration
          await reg.sync.register(SYNC_TAG);
          console.log('[BackgroundSync Client] Tag registrada no Service Worker:', SYNC_TAG);
          return true;
        } else {
          // Notifica o Service Worker via postMessage caso a API direta não esteja exposta
          if (reg.active) {
            reg.active.postMessage({ type: 'REGISTER_BACKGROUND_SYNC', tag: SYNC_TAG });
          }
        }
      } catch (err) {
        console.debug('[BackgroundSync Client] Background Sync nativo não suportado ou negado:', err);
      }
    }

    return false;
  }, []);

  // Monitora retorno de conexão via evento online e mensagens do Service Worker
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Listener para mensagens vindas do Service Worker (quando o evento 'sync' disparar)
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'TRIGGER_SUPABASE_BACKGROUND_SYNC') {
        console.log('[BackgroundSync Client] Notificação de sync recebida do Service Worker:', event.data);
        if (onSyncTriggered) {
          onSyncTriggered();
        }
      }
    };

    // Listener quando a conexão é restabelecida no navegador
    const handleOnline = () => {
      console.log('[BackgroundSync Client] Dispositivo recuperou a conexão com a internet!');
      // Dispara sincronização imediata
      if (onSyncTriggered) {
        onSyncTriggered();
      }
      // E também registra no SW para persistência em segundo plano
      requestBackgroundSync();
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }
    window.addEventListener('online', handleOnline);

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      window.removeEventListener('online', handleOnline);
    };
  }, [onSyncTriggered, requestBackgroundSync]);

  // Se houver itens pendentes e a conexão oscilar, agenda a sincronização em segundo plano
  useEffect(() => {
    if (hasPendingItems) {
      requestBackgroundSync();
    }
  }, [hasPendingItems, requestBackgroundSync]);

  return {
    requestBackgroundSync,
  };
}
