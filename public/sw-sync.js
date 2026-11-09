/**
 * Service Worker Background Sync Listener
 * Dispara a sincronização de dados pendentes com o Supabase assim que o dispositivo
 * recuperar a conexão com a internet.
 */

const SYNC_TAG_SUPABASE = 'sync-supabase-pending-data';
const SYNC_TAG_OFFLINE_QUEUE = 'sync-offline-queue';

// 1. Listener do evento 'sync' da Background Sync API
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Evento sync recebido:', event.tag);

  if (
    event.tag === SYNC_TAG_SUPABASE ||
    event.tag === SYNC_TAG_OFFLINE_QUEUE ||
    event.tag === 'supabase-sync'
  ) {
    event.waitUntil(
      dispatchSupabaseSyncToClients(event.tag)
    );
  }
});

// 2. Listener para o evento 'periodicsync' (quando suportado por PWA instalada)
self.addEventListener('periodicsync', (event) => {
  console.log('[Service Worker] Evento periodicSync recebido:', event.tag);
  if (event.tag === 'periodic-supabase-sync') {
    event.waitUntil(
      dispatchSupabaseSyncToClients('periodic-supabase-sync')
    );
  }
});

// 3. Listener para mensagens de controle vindas dos clientes
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REGISTER_BACKGROUND_SYNC') {
    console.log('[Service Worker] Solicitado registro de Background Sync pelo cliente.');
    if ('sync' in self.registration) {
      self.registration.sync
        .register(SYNC_TAG_SUPABASE)
        .then(() => {
          console.log('[Service Worker] Tag de sync registrada com sucesso:', SYNC_TAG_SUPABASE);
        })
        .catch((err) => {
          console.warn('[Service Worker] Falha ao registrar tag de sync:', err);
        });
    }
  }
});

/**
 * Notifica todas as janelas/abas ativas do PWA para executarem
 * a consolidação da fila de alterações locais com o banco Supabase.
 */
async function dispatchSupabaseSyncToClients(tag) {
  try {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: 'window',
    });

    console.log(`[Service Worker] Notificando ${clients.length} cliente(s) para sincronização do Supabase.`);

    for (const client of clients) {
      client.postMessage({
        type: 'TRIGGER_SUPABASE_BACKGROUND_SYNC',
        tag,
        timestamp: Date.now(),
        reason: 'CONEXAO_RESTABELECIDA_BACKGROUND_SYNC',
      });
    }
  } catch (error) {
    console.error('[Service Worker] Erro ao disparar sincronização com os clientes:', error);
  }
}
