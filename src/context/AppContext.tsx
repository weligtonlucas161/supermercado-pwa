import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  Product, 
  ValidityItem, 
  AuditItem, 
  Operator, 
  NotificationItem, 
  TabId, 
  OfflineAction,
  AuthUser,
  Store,
  StoreEmployee,
  StoreRole
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
import { useBackgroundSync } from '../pwa/useBackgroundSync';
import { triggerScanBeep } from '../utils/haptics';
import { 
  loginUser, 
  isSupabaseConfigured, 
  syncOfflineQueueToSupabase, 
  fetchProductsFromSupabase, 
  subscribeToProductsRealtime,
  fetchStoresFromDatabase,
  createStoreInDatabase,
  fetchStoreEmployees,
  saveStoreEmployee,
  toggleStoreEmployeeActive,
  saveStoreRole,
  getStoredStores,
  getStoredEmployees,
  getStoredRoles
} from '../services/supabaseService';

interface AppContextType {
  // Navigation & UI
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  darkMode: boolean;
  isDesktop: boolean;

  // Connectivity & Real Sync
  isOnline: boolean;
  effectiveOnline: boolean;
  offlineQueue: OfflineAction[];
  syncOfflineQueue: () => void;
  clearOfflineQueue: () => void;

  // Domain Entities
  products: Product[];
  validities: ValidityItem[];
  audits: AuditItem[];
  operator: Operator;
  updateOperator: (operator: Partial<Operator>) => void;

  // Autenticação Segura & Papéis
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  isSaasAdmin: boolean;
  isGerente: boolean;
  login: (matricula: string, senha: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;

  // Lojas & Funcionários (SaaS Admin & Gerente)
  stores: Store[];
  refreshStores: () => Promise<void>;
  addStore: (store: Store) => Promise<{ success: boolean; error?: string }>;
  employees: StoreEmployee[];
  refreshEmployees: (lojaId?: string) => Promise<void>;
  addOrUpdateEmployee: (emp: StoreEmployee) => Promise<{ success: boolean; error?: string }>;
  toggleEmployeeStatus: (empId: string, active: boolean) => Promise<void>;
  roles: StoreRole[];
  refreshRoles: () => Promise<void>;
  addOrUpdateRole: (role: StoreRole) => Promise<boolean>;

  // Actions
  addProduct: (product: Omit<Product, 'id'>) => Product;
  updateProductStock: (id: string, options: { delta?: number; exact?: number }) => void;
  removeProduct: (id: string) => void;
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

  // Supabase Cloud Multi-Session Sync
  isSyncingWithDatabase: boolean;
  lastDatabaseSyncTime: string | null;
  refreshProductsFromDatabase: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation
  const [activeTab, setActiveTab] = useState<TabId>('inicio');

  // =========================================================================
  // 1. DETECÇÃO AUTOMÁTICA DO TEMA DO DISPOSITIVO (SEM ESCOLHA MANUAL)
  // =========================================================================
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Atualiza estado inicial
    setDarkMode(media.matches);

    // Ouve alterações de preferência de tema no sistema operacional do aparelho
    const handleThemeChange = (e: MediaQueryListEvent) => {
      setDarkMode(e.matches);
    };

    try {
      media.addEventListener('change', handleThemeChange);
      return () => media.removeEventListener('change', handleThemeChange);
    } catch {
      // Fallback para navegadores legados
      media.addListener(handleThemeChange);
      return () => media.removeListener(handleThemeChange);
    }
  }, []);

  // Sincroniza a classe 'dark' no elemento raiz do documento
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // =========================================================================
  // 2. DETECÇÃO AUTOMÁTICA DE AMBIENTE: DESKTOP VS MOBILE
  // =========================================================================
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Network & Offline Mode Real (sem botões de simulação)
  const browserOnline = useOnlineStatus();
  const effectiveOnline = browserOnline;

  // Offline Mutation Queue
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>(() => {
    return loadStoredData<OfflineAction[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
  });

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.OFFLINE_QUEUE, offlineQueue);
  }, [offlineQueue]);

  // Domain Entities State (Sem produtos falsos de mock)
  const [products, setProducts] = useState<Product[]>(() => {
    const loaded = loadStoredData<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    return loaded.filter(p => !['1', '2', '3', '4', '5', '6', '7', '8'].includes(p.id));
  });

  const [validities, setValidities] = useState<ValidityItem[]>(() => {
    const loaded = loadStoredData<ValidityItem[]>(STORAGE_KEYS.VALIDITIES, INITIAL_VALIDITIES);
    return loaded.filter(v => !['v1', 'v2', 'v3', 'v4', 'v5'].includes(v.id));
  });

  const [audits, setAudits] = useState<AuditItem[]>(() => {
    return loadStoredData<AuditItem[]>(STORAGE_KEYS.AUDITS, INITIAL_AUDITS);
  });

  // Autenticação Segura & Papéis
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    return loadStoredData<AuthUser | null>(STORAGE_KEYS.AUTH_USER, null);
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!loadStoredData<AuthUser | null>(STORAGE_KEYS.AUTH_USER, null);
  });

  const [operator, setOperator] = useState<Operator>(() => {
    const savedUser = loadStoredData<AuthUser | null>(STORAGE_KEYS.AUTH_USER, null);
    if (savedUser) {
      return {
        id: savedUser.id,
        name: savedUser.nome,
        code: savedUser.matricula,
        matricula: savedUser.matricula,
        role: savedUser.cargo,
        store: savedUser.loja_nome || INITIAL_OPERATOR.store,
        loja_id: savedUser.loja_id || INITIAL_OPERATOR.loja_id,
        shift: INITIAL_OPERATOR.shift,
      };
    }
    return loadStoredData<Operator>(STORAGE_KEYS.OPERATOR, INITIAL_OPERATOR);
  });

  // Papéis de acesso
  const isSaasAdmin = currentUser?.cargo === 'saas_admin' || operator.role === 'saas_admin';
  const isGerente = currentUser?.cargo === 'gerente' || operator.role === 'gerente';

  // Lojas e Funcionários gerenciados
  const [stores, setStores] = useState<Store[]>(() => getStoredStores());
  const [employees, setEmployees] = useState<StoreEmployee[]>(() => getStoredEmployees());
  const [roles, setRoles] = useState<StoreRole[]>(() => getStoredRoles());

  const refreshStores = useCallback(async () => {
    const s = await fetchStoresFromDatabase();
    setStores(s);
  }, []);

  const refreshEmployees = useCallback(async (lojaId?: string) => {
    const targetLoja = lojaId || operator.loja_id || 'loja_padrao_001';
    const emps = await fetchStoreEmployees(targetLoja);
    setEmployees(emps);
  }, [operator.loja_id]);

  const refreshRoles = useCallback(async () => {
    const r = getStoredRoles();
    setRoles(r);
  }, []);

  const addStore = async (newStore: Store) => {
    const res = await createStoreInDatabase(newStore);
    if (res.success) {
      await refreshStores();
    }
    return res;
  };

  const addOrUpdateEmployee = async (emp: StoreEmployee) => {
    const res = await saveStoreEmployee(emp);
    if (res.success) {
      await refreshEmployees(emp.loja_id);
    }
    return res;
  };

  const toggleEmployeeStatus = async (empId: string, active: boolean) => {
    await toggleStoreEmployeeActive(empId, active);
    await refreshEmployees();
  };

  const addOrUpdateRole = async (role: StoreRole) => {
    const res = await saveStoreRole(role);
    if (res) {
      await refreshRoles();
    }
    return res;
  };

  // Carregar dados de lojas e funcionários ao autenticar
  useEffect(() => {
    if (isAuthenticated) {
      refreshStores();
      refreshEmployees();
      refreshRoles();
    }
  }, [isAuthenticated, refreshStores, refreshEmployees, refreshRoles]);

  // Login
  const login = async (matricula: string, senha: string): Promise<{ success: boolean; message?: string }> => {
    const result = await loginUser(matricula, senha);
    if (result.success && result.user) {
      setCurrentUser(result.user);
      setIsAuthenticated(true);
      saveStoredData(STORAGE_KEYS.AUTH_USER, result.user);
      if (result.token) {
        saveStoredData(STORAGE_KEYS.AUTH_TOKEN, result.token);
      }
      setOperator(prev => ({
        ...prev,
        id: result.user!.id,
        name: result.user!.nome,
        code: result.user!.matricula,
        matricula: result.user!.matricula,
        role: result.user!.cargo,
        store: result.user!.loja_nome || prev.store,
        loja_id: result.user!.loja_id || prev.loja_id,
        setor_restrito: result.user!.setor,
      }));
      triggerScanBeep(true);

      // Redireciona para início ou loja
      if (result.user.cargo === 'gerente') {
        setActiveTab('loja');
      } else {
        setActiveTab('inicio');
      }

      setTimeout(() => {
        refreshProductsFromDatabase();
      }, 100);
      return { success: true };
    }
    return { success: false, message: result.message || 'Falha na autenticação' };
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    setActiveTab('inicio');
  };

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

  // Supabase Cloud Multi-Session Sync
  const [isSyncingWithDatabase, setIsSyncingWithDatabase] = useState(false);
  const [lastDatabaseSyncTime, setLastDatabaseSyncTime] = useState<string | null>(null);

  const refreshProductsFromDatabase = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setIsSyncingWithDatabase(true);
    try {
      const lojaId = operator.loja_id || currentUser?.loja_id;
      const dbProducts = await fetchProductsFromSupabase(lojaId);
      if (dbProducts && dbProducts.length > 0) {
        setProducts(dbProducts);
        saveStoredData(STORAGE_KEYS.PRODUCTS, dbProducts);
        const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastDatabaseSyncTime(now);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar produtos da nuvem:', err);
    } finally {
      setIsSyncingWithDatabase(false);
    }
  }, [currentUser?.loja_id, operator.loja_id]);

  // Assinatura em Tempo Real (Realtime Channel) para multi-sessões
  useEffect(() => {
    if (!isAuthenticated || !isSupabaseConfigured()) return;
    const unsubscribe = subscribeToProductsRealtime(() => {
      refreshProductsFromDatabase();
    });
    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, refreshProductsFromDatabase]);

  // Background Sync when online
  useBackgroundSync({
    onSyncTriggered: async () => {
      if (offlineQueue.length > 0) {
        const res = await syncOfflineQueueToSupabase(offlineQueue, operator.loja_id);
        if (res.success) {
          setOfflineQueue([]);
          refreshProductsFromDatabase();
        }
      }
    },
    hasPendingItems: offlineQueue.length > 0
  });

  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    const res = await syncOfflineQueueToSupabase(offlineQueue, operator.loja_id);
    if (res.success) {
      setOfflineQueue([]);
      refreshProductsFromDatabase();
    }
  };

  const clearOfflineQueue = () => {
    setOfflineQueue([]);
  };

  // Actions
  const addProduct = (newProductData: Omit<Product, 'id'>): Product => {
    const newProduct: Product = {
      ...newProductData,
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      lastUpdated: new Date().toISOString(),
    };

    setProducts(prev => {
      // Se já existir pelo código EAN, atualiza os campos e a quantidade
      const existingIdx = prev.findIndex(p => p.ean === newProduct.ean);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          ...newProduct,
          stock: newProduct.stock,
          category: newProduct.category || copy[existingIdx].category,
        };
        return copy;
      }
      return [newProduct, ...prev];
    });

    if (!effectiveOnline) {
      setOfflineQueue(prev => [
        ...prev,
        {
          id: `queue-${Date.now()}`,
          type: 'ADD_PRODUCT',
          payload: newProduct,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

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
        return {
          ...p,
          stock: newStock,
          lastUpdated: new Date().toISOString(),
        };
      })
    );

    if (!effectiveOnline) {
      setOfflineQueue(prev => [
        ...prev,
        {
          id: `queue-${Date.now()}`,
          type: 'UPDATE_STOCK',
          payload: { id, ...options },
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const removeProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const addValidity = (newValidityData: Omit<ValidityItem, 'id'>): ValidityItem => {
    const newValidity: ValidityItem = {
      ...newValidityData,
      id: `val-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
    setValidities(prev => [newValidity, ...prev]);
    return newValidity;
  };

  const applyDiscount = (validityId: string, percentage: number) => {
    setValidities(prev =>
      prev.map(v => (v.id === validityId ? { ...v, discountApplied: true } : v))
    );
    const item = validities.find(v => v.id === validityId);
    if (item) {
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Desconto Aplicado',
          message: `${percentage}% de desconto aplicado em "${item.name}" para acelerar saída antes do vencimento.`,
          type: 'info',
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...prev,
      ]);
    }
  };

  const addAudit = (auditData: Omit<AuditItem, 'id' | 'date'>): AuditItem => {
    const newAudit: AuditItem = {
      ...auditData,
      id: `audit-${Date.now()}`,
      date: new Date().toISOString(),
    };
    setAudits(prev => [newAudit, ...prev]);
    return newAudit;
  };

  const resetAllData = () => {
    setProducts([]);
    setValidities([]);
    setAudits([]);
    setNotifications([]);
    setOfflineQueue([]);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.VALIDITIES);
    localStorage.removeItem(STORAGE_KEYS.AUDITS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  };

  const updateOperator = (newOperatorData: Partial<Operator>) => {
    setOperator(prev => ({ ...prev, ...newOperatorData }));
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Scanner modal global state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerCallback, setScannerCallback] = useState<((barcode: string) => void) | null>(null);

  const openScanner = (cb?: (barcode: string) => void) => {
    if (cb) {
      setScannerCallback(() => cb);
    } else {
      setScannerCallback(null);
    }
    setIsScannerOpen(true);
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
    setScannerCallback(null);
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        darkMode,
        isDesktop,

        isOnline: browserOnline,
        effectiveOnline,
        offlineQueue,
        syncOfflineQueue,
        clearOfflineQueue,

        products,
        validities,
        audits,
        operator,
        updateOperator,

        isAuthenticated,
        currentUser,
        isSaasAdmin,
        isGerente,
        login,
        logout,

        stores,
        refreshStores,
        addStore,
        employees,
        refreshEmployees,
        addOrUpdateEmployee,
        toggleEmployeeStatus,
        roles,
        refreshRoles,
        addOrUpdateRole,

        addProduct,
        updateProductStock,
        removeProduct,
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

        isSyncingWithDatabase,
        lastDatabaseSyncTime,
        refreshProductsFromDatabase,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
