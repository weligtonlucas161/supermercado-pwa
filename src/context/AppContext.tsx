import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Product, 
  ValidityItem, 
  AuditItem, 
  Operator, 
  NotificationItem, 
  TabId, 
  OfflineAction 
} from '../types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_VALIDITIES, 
  INITIAL_AUDITS, 
  INITIAL_OPERATOR, 
  INITIAL_NOTIFICATIONS, 
  STORAGE_KEYS, 
  loadStoredData, 
  saveStoredData 
} from '../data/mockData';
import { useOnlineStatus } from '../pwa/useOnlineStatus';
import { triggerScanBeep } from '../utils/haptics';

interface AppContextType {
  // Navigation & UI
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  toggleDarkMode: () => void;

  // Connectivity & Offline Sync
  isOnline: boolean;
  isSimulatedOffline: boolean;
  effectiveOnline: boolean;
  toggleSimulatedOffline: () => void;
  offlineQueue: OfflineAction[];
  syncOfflineQueue: () => void;
  clearOfflineQueue: () => void;

  // Domain Entities
  products: Product[];
  validities: ValidityItem[];
  audits: AuditItem[];
  operator: Operator;
  updateOperator: (operator: Partial<Operator>) => void;

  // Actions
  addProduct: (product: Omit<Product, 'id'>) => Product;
  updateProductStock: (id: string, options: { delta?: number; exact?: number }) => void;
  addValidity: (validity: Omit<ValidityItem, 'id'>) => ValidityItem;
  applyDiscount: (validityId: string, percentage: number) => void;
  addAudit: (audit: Omit<AuditItem, 'id' | 'date'>) => AuditItem;
  resetAllData: () => void;

  // Notifications
  notifications: NotificationItem[];
  unreadCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;

  // Barcode Scanner Modal Global State
  isScannerOpen: boolean;
  openScanner: (callback?: (barcode: string) => void) => void;
  closeScanner: () => void;
  scannerCallback: ((barcode: string) => void) | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation
  const [activeTab, setActiveTab] = useState<TabId>('inicio');

  // Dark Mode
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return loadStoredData<boolean>(STORAGE_KEYS.DARK_MODE, false);
  });

  // Theme Class Synchronization
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    saveStoredData(STORAGE_KEYS.DARK_MODE, darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  // Network & Offline Mode
  const browserOnline = useOnlineStatus();
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const effectiveOnline = browserOnline && !isSimulatedOffline;

  // Offline Mutation Queue
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>(() => {
    return loadStoredData<OfflineAction[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
  });

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.OFFLINE_QUEUE, offlineQueue);
  }, [offlineQueue]);

  // Domain Entities State
  const [products, setProducts] = useState<Product[]>(() => {
    return loadStoredData<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
  });

  const [validities, setValidities] = useState<ValidityItem[]>(() => {
    return loadStoredData<ValidityItem[]>(STORAGE_KEYS.VALIDITIES, INITIAL_VALIDITIES);
  });

  const [audits, setAudits] = useState<AuditItem[]>(() => {
    return loadStoredData<AuditItem[]>(STORAGE_KEYS.AUDITS, INITIAL_AUDITS);
  });

  const [operator, setOperator] = useState<Operator>(() => {
    return loadStoredData<Operator>(STORAGE_KEYS.OPERATOR, INITIAL_OPERATOR);
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    return loadStoredData<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  });

  // Save to localStorage when state changes
  useEffect(() => {
    saveStoredData(STORAGE_KEYS.PRODUCTS, products);
  }, [products]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.VALIDITIES, validities);
  }, [validities]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.AUDITS, audits);
  }, [audits]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.OPERATOR, operator);
  }, [operator]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }, [notifications]);

  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerCallback, setScannerCallback] = useState<((barcode: string) => void) | null>(null);

  const openScanner = (cb?: (barcode: string) => void) => {
    setScannerCallback(() => cb || null);
    setIsScannerOpen(true);
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
    setScannerCallback(null);
  };

  // Record an offline change if disconnected
  const trackOfflineAction = (type: OfflineAction['type'], payload: unknown) => {
    if (!effectiveOnline) {
      const newAction: OfflineAction = {
        id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        type,
        payload,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setOfflineQueue(prev => [newAction, ...prev]);
    }
  };

  // Sync Queue Action
  const syncOfflineQueue = () => {
    if (offlineQueue.length === 0) return;
    triggerScanBeep(true);
    setOfflineQueue([]);
    // Add success notification
    const syncNotif: NotificationItem = {
      id: 'n-sync-' + Date.now(),
      title: 'Sincronização Concluída',
      message: `${offlineQueue.length} alterações locais foram consolidadas no servidor central.`,
      type: 'info',
      timestamp: 'Agora',
      read: false,
    };
    setNotifications(prev => [syncNotif, ...prev]);
  };

  const clearOfflineQueue = () => {
    setOfflineQueue([]);
  };

  // Actions
  const addProduct = (p: Omit<Product, 'id'>): Product => {
    const newProduct: Product = {
      ...p,
      id: String(Date.now()),
      lastUpdated: new Date().toISOString(),
    };
    setProducts(prev => [newProduct, ...prev]);
    trackOfflineAction('ADD_PRODUCT', newProduct);
    triggerScanBeep(true);
    return newProduct;
  };

  const updateProductStock = (id: string, options: { delta?: number; exact?: number }) => {
    setProducts(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        let newStock = p.stock;
        if (typeof options.exact === 'number') {
          newStock = Math.max(0, options.exact);
        } else if (typeof options.delta === 'number') {
          newStock = Math.max(0, p.stock + options.delta);
        }
        return { ...p, stock: newStock, lastUpdated: new Date().toISOString() };
      })
    );
    trackOfflineAction('UPDATE_STOCK', { id, ...options });
    triggerScanBeep(true);
  };

  const addValidity = (v: Omit<ValidityItem, 'id'>): ValidityItem => {
    const newValidity: ValidityItem = {
      ...v,
      id: 'v-' + Date.now(),
    };
    setValidities(prev => [newValidity, ...prev]);
    trackOfflineAction('ADD_VALIDITY', newValidity);
    triggerScanBeep(true);
    return newValidity;
  };

  const applyDiscount = (validityId: string, percentage: number) => {
    setValidities(prev =>
      prev.map(v => {
        if (v.id !== validityId) return v;
        return {
          ...v,
          status: 'warning',
          discountApplied: true,
        };
      })
    );
    // Also find product and adjust or record promo
    trackOfflineAction('APPLY_DISCOUNT', { validityId, percentage });
    triggerScanBeep(true);
  };

  const addAudit = (a: Omit<AuditItem, 'id' | 'date'>): AuditItem => {
    const newAudit: AuditItem = {
      ...a,
      id: 'a-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
    };
    setAudits(prev => [newAudit, ...prev]);
    trackOfflineAction('ADD_AUDIT', newAudit);
    triggerScanBeep(true);
    return newAudit;
  };

  const resetAllData = () => {
    setProducts(INITIAL_PRODUCTS);
    setValidities(INITIAL_VALIDITIES);
    setAudits(INITIAL_AUDITS);
    setOperator(INITIAL_OPERATOR);
    setNotifications(INITIAL_NOTIFICATIONS);
    setOfflineQueue([]);
    localStorage.clear();
  };

  const updateOperator = (updated: Partial<Operator>) => {
    setOperator(prev => ({ ...prev, ...updated }));
  };

  // Notifications
  const unreadCount = notifications.filter(n => !n.read).length;

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        darkMode,
        setDarkMode,
        toggleDarkMode,
        isOnline: browserOnline,
        isSimulatedOffline,
        effectiveOnline,
        toggleSimulatedOffline: () => setIsSimulatedOffline(prev => !prev),
        offlineQueue,
        syncOfflineQueue,
        clearOfflineQueue,
        products,
        validities,
        audits,
        operator,
        updateOperator,
        addProduct,
        updateProductStock,
        addValidity,
        applyDiscount,
        addAudit,
        resetAllData,
        notifications,
        unreadCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        isScannerOpen,
        openScanner,
        closeScanner,
        scannerCallback,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
