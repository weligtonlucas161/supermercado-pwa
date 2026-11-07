import { useState, useEffect } from 'react';

/**
 * Service Worker Lifecycle Hook for VitePWA
 * Manages cache updates, new version notifications, and offline readiness.
 */
export function usePWARegistration() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Try importing virtual module or use navigator.serviceWorker directly
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            setNeedRefresh(true);
          },
          onOfflineReady() {
            setOfflineReady(true);
          },
          onRegisteredSW(_swUrl, r) {
            if (r) {
              setSwRegistration(r);
              // Check for updates periodically (every 1 hour)
              setInterval(() => {
                r.update().catch(err => console.debug('SW periodic update check error:', err));
              }, 60 * 60 * 1000);
            }
          },
        });

        // Store update function on window for emergency/manual invocation if needed
        (window as unknown as { __updatePWA?: () => void }).__updatePWA = () => {
          updateSW(true);
        };
      })
      .catch((err) => {
        console.debug('Service Worker registerSW virtual module not loaded:', err);
      });
  }, []);

  const updateServiceWorker = () => {
    const updateFn = (window as unknown as { __updatePWA?: () => void }).__updatePWA;
    if (updateFn) {
      updateFn();
    } else {
      window.location.reload();
    }
  };

  const closePrompt = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return {
    needRefresh,
    offlineReady,
    swRegistration,
    updateServiceWorker,
    closePrompt,
  };
}
