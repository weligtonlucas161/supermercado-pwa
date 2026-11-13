/**
 * SuperPWA OpSys - Service Worker Background Sync & Offline Transaction Queue
 * Gerenciamento avançado de fila de espera de transações offline via IndexedDB
 * e sincronização de fundo com a Background Sync API.
 * 
 * Suporta:
 * - Auditorias de presença e inventário realizadas sem conexão
 * - Registros e ajustes de estoque
 * - Lançamentos de validade e perdas
 * - Mensagens do chat operacional enviadas offline
 */

const DB_NAME = 'superpwa_offline_db';
const DB_VERSION = 1;
const QUEUE_STORE = 'transaction_queue';

const SYNC_TAG_OFFLINE_QUEUE = 'sync-offline-queue';
const SYNC_TAG_SUPABASE = 'sync-supabase-pending-data';
const SYNC_TAG_AUDITORIAS_ESTOQUE = 'sync-auditorias-estoque';

// ============================================================================
// 1. GERENCIADOR DE BANCO DE DADOS INDEXEDDB NO WORKER
// ============================================================================

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function enqueueTransaction(transaction) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const item = {
        id: transaction.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        type: transaction.type, // 'ADD_AUDIT', 'UPDATE_STOCK', 'ADD_PRODUCT', 'ADD_VALIDITY', 'CHAT_MESSAGE'
        payload: transaction.payload,
        timestamp: transaction.timestamp || Date.now(),
        status: 'pending', // 'pending' | 'processing' | 'synced' | 'failed'
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error('[SW-Sync] Erro ao enfileirar transação no IndexedDB:', error);
    throw error;
  }
}

async function getPendingTransactions() {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const store = tx.objectStore(QUEUE_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result || [];
        const pending = all.filter(t => t.status === 'pending' || t.status === 'failed');
        resolve(pending);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW-Sync] Erro ao buscar transações pendentes:', error);
    return [];
  }
}

async function markTransactionSynced(id) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[SW-Sync] Erro ao remover transação concluída:', e);
  }
}

async function updateTransactionStatus(id, status, errorMsg) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) return resolve(false);
        item.status = status;
        item.retryCount = (item.retryCount || 0) + 1;
        if (errorMsg) item.lastError = errorMsg;
        const putReq = store.put(item);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (e) {
    console.warn('[SW-Sync] Erro ao atualizar status de transação:', e);
  }
}

async function clearSyncedOrAllTransactions() {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[SW-Sync] Erro ao limpar transações:', e);
  }
}

// ============================================================================
// 2. DISPATCHER & NOTIFICADOR PARA CLIENTES ATIVOS DO PWA
// ============================================================================

async function broadcastToClients(message) {
  try {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: 'window',
    });

    for (const client of clients) {
      client.postMessage(message);
    }
  } catch (err) {
    console.error('[SW-Sync] Erro no broadcast aos clientes:', err);
  }
}

/**
 * Processa a sincronização de fundo (Background Sync Strategy)
 */
async function processBackgroundSync(tag) {
  console.log(`[SW-Sync] Iniciando processamento da fila de transações offline. Tag: ${tag}`);
  
  const pending = await getPendingTransactions();
  console.log(`[SW-Sync] ${pending.length} transação(ões) pendente(s) identificada(s) para sincronização.`);

  // Notifica o app de que o evento de background sync foi acionado pela rede restabelecida
  await broadcastToClients({
    type: 'BACKGROUND_SYNC_TRIGGERED',
    tag,
    pendingCount: pending.length,
    timestamp: Date.now(),
    transactions: pending,
  });

  return pending;
}

// ============================================================================
// 3. LISTENERS DA BACKGROUND SYNC API E PERIODIC SYNC API
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW-Sync] Evento background sync capturado:', event.tag);

  if (
    event.tag === SYNC_TAG_OFFLINE_QUEUE ||
    event.tag === SYNC_TAG_SUPABASE ||
    event.tag === SYNC_TAG_AUDITORIAS_ESTOQUE ||
    event.tag === 'supabase-sync'
  ) {
    event.waitUntil(
      processBackgroundSync(event.tag).catch((err) => {
        console.error('[SW-Sync] Falha na execução do Background Sync:', err);
      })
    );
  }
});

self.addEventListener('periodicsync', (event) => {
  console.log('[SW-Sync] Evento periodicSync recebido:', event.tag);
  if (event.tag === 'periodic-supabase-sync') {
    event.waitUntil(processBackgroundSync(event.tag));
  }
});

// ============================================================================
// 4. LISTENER DE MENSAGENS DOS CLIENTES (ENQUEUE / STATUS / MANUAL SYNC)
// ============================================================================

self.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'ENQUEUE_OFFLINE_TRANSACTION': {
      try {
        const saved = await enqueueTransaction(data.transaction || data.payload);
        console.log('[SW-Sync] Transação enfileirada no IndexedDB com sucesso:', saved.id, saved.type);

        // Registra tag na Background Sync API se suportado
        if ('sync' in self.registration) {
          self.registration.sync
            .register(SYNC_TAG_OFFLINE_QUEUE)
            .then(() => console.log('[SW-Sync] Tag de background sync registrada:', SYNC_TAG_OFFLINE_QUEUE))
            .catch((e) => console.warn('[SW-Sync] Registro de sync descartado pelo navegador:', e));
        }

        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true, item: saved });
        }
      } catch (err) {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: false, error: String(err) });
        }
      }
      break;
    }

    case 'GET_OFFLINE_QUEUE_STATUS': {
      const items = await getPendingTransactions();
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          count: items.length,
          items,
          timestamp: Date.now(),
        });
      }
      break;
    }

    case 'MARK_TRANSACTION_SYNCED': {
      if (data.id) {
        await markTransactionSynced(data.id);
      }
      break;
    }

    case 'CLEAR_OFFLINE_QUEUE': {
      await clearSyncedOrAllTransactions();
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
      break;
    }

    case 'TRIGGER_SYNC_NOW': {
      await processBackgroundSync('manual-client-trigger');
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
      break;
    }

    case 'REGISTER_BACKGROUND_SYNC': {
      if ('sync' in self.registration) {
        self.registration.sync
          .register(SYNC_TAG_SUPABASE)
          .then(() => console.log('[SW-Sync] Tag SYNC_TAG_SUPABASE registrada.'))
          .catch((e) => console.warn('[SW-Sync] Falha no registro de sync:', e));
      }
      break;
    }

    default:
      break;
  }
});

// ============================================================================
// 5. LISTENERS DE NOTIFICAÇÃO PUSH PWA E CLICK NA NOTIFICAÇÃO
// ============================================================================

self.addEventListener('push', (event) => {
  let payload = {
    title: 'SuperPWA Chat Operacional',
    body: 'Nova mensagem recebida na loja.',
    tag: 'chat-push',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag,
      data: { url: '/', action: 'open_chat' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'OPEN_CHAT_FROM_NOTIFICATION' });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
