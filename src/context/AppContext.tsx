import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  StoreRole,
  ChatMessage,
  SpreadsheetProductItem,
  SetorLoja,
  AvariaItem
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
  censorProfanity,
  resolveFullRoleLabel,
  evaluateMessageNotificationTarget,
  showPWAPushNotification,
} from '../utils/chatUtils';
import { 
  loginUser, 
  isSupabaseConfigured, 
  syncOfflineQueueToSupabase, 
  fetchProductsFromSupabase, 
  subscribeToProductsRealtime,
  fetchStoresFromDatabase,
  createStoreInDatabase,
  updateStoreUserLimitInDatabase,
  updateStoreSettingsInDatabase,
  fetchStoreEmployees,
  saveStoreEmployee,
  toggleStoreEmployeeActive,
  saveStoreRole,
  getStoredStores,
  getStoredEmployees,
  getStoredRoles,
  changeUserPassword,
  verifyUserStillActive,
  verifyUserStillActiveRemote,
  subscribeToUserStatusRealtime,
  fetchChatMessagesFromSupabase,
  sendChatMessageToSupabase,
  subscribeToChatRealtime,
  getStoredChatMessages,
  clearObsoleteChatCache,
  getStoredAvarias,
  saveAvariaInDatabase,
  fetchAvariasFromDatabase,
  subscribeToAvariasRealtime,
  lockProductInSupabase,
  unlockProductInSupabase,
  updateProductInSupabase
} from '../services/supabaseService';

interface AppContextType {
  // Navigation & UI
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  darkMode: boolean;
  isDesktop: boolean;
  storeName: string;
  storeColor: string;
  updateStoreSettings: (updates: { nome_loja?: string; cor_primaria?: string }) => Promise<{ success: boolean; error?: string }>;

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
  disconnectedMessage: string | null;
  clearDisconnectedMessage: () => void;
  updateUserPassword: (newPassword: string) => Promise<{ success: boolean; message?: string }>;

  // Lojas & Funcionários (SaaS Admin & Gerente)
  stores: Store[];
  refreshStores: () => Promise<void>;
  addStore: (store: Store) => Promise<{ success: boolean; error?: string }>;
  updateStoreUserLimit: (storeId: string, newLimit: number) => Promise<{ success: boolean; error?: string }>;
  employees: StoreEmployee[];
  refreshEmployees: (lojaId?: string) => Promise<void>;
  addOrUpdateEmployee: (emp: StoreEmployee) => Promise<{ success: boolean; error?: string }>;
  toggleEmployeeStatus: (empId: string, active: boolean) => Promise<void>;
  roles: StoreRole[];
  refreshRoles: () => Promise<void>;
  addOrUpdateRole: (role: StoreRole) => Promise<boolean>;

  // Actions
  addProduct: (product: Omit<Product, 'id'>) => Product;
  importProductsBatch: (items: SpreadsheetProductItem[], targetSetor: SetorLoja, lojaId: string) => void;
  updateProductStock: (id: string, options: { delta?: number; exact?: number }) => void;
  toggleProductRebaixa: (id: string) => void;
  removeProduct: (id: string) => void;
  lockProductForEdit: (productId: string, lockedByName: string) => boolean;
  unlockProductForEdit: (productId: string) => void;
  updateProductDetails: (productId: string, updates: Partial<Product>) => Promise<{ success: boolean; error?: string }>;
  addValidity: (validity: Omit<ValidityItem, 'id'>) => ValidityItem;
  applyDiscount: (validityId: string, percentage: number) => void;
  addAudit: (audit: Omit<AuditItem, 'id' | 'date'>) => AuditItem;
  updateAudit: (auditId: string, updated: Partial<AuditItem>) => void;
  resetAllData: () => void;

  // Avarias no Estoque (perdas, quebras e trocas)
  avarias: AvariaItem[];
  addAvaria: (
    avaria: Omit<AvariaItem, 'id' | 'registrado_em' | 'timestamp'>
  ) => Promise<{ success: boolean; data?: AvariaItem; synced: boolean }>;
  refreshAvarias: () => Promise<void>;

  // Notifications
  notifications: NotificationItem[];
  unreadCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;

  // Barcode Scanner Modal Global State
  isScannerOpen: boolean;
  scannerCameraOnly: boolean;
  openScanner: (callback?: (barcode: string) => void, options?: { cameraOnly?: boolean }) => void;
  closeScanner: () => void;
  scannerCallback: ((barcode: string) => void) | null;

  // Chat Operacional (Grupo da Loja e Canal com Líderes)
  chatMessages: ChatMessage[];
  isChatOpen: boolean;
  openChat: (targetLeaderMatricula?: string) => void;
  closeChat: () => void;
  directLeaderMatricula?: string;
  sendChatMessage: (msg: { canal_tipo: 'grupo' | 'direto_lider'; destinatario_id?: string; destinatario_nome?: string; conteudo: string; is_anonimo: boolean; }) => Promise<void>;
  unreadChatCount: number;

  // Supabase Cloud Multi-Session Sync
  isSyncingWithDatabase: boolean;
  lastDatabaseSyncTime: string | null;
  refreshProductsFromDatabase: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation - Mantém a tela atual salva no localStorage ao recarregar a página
  const [activeTab, setActiveTabState] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) as TabId;
      if (saved && ['inicio', 'validade', 'estoque', 'auditoria', 'loja', 'configuracoes'].includes(saved)) {
        return saved;
      }
    }
    return 'inicio';
  });

  const setActiveTab = (tab: TabId) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
    }
  };

  // =========================================================================
  // 1. MODO CLARO PADRÃO FIXO (SEM OPÇÃO DE MODO ESCURO)
  // =========================================================================
  const darkMode = false;

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

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
        cargoCompleto: savedUser.cargoCompleto,
        setor_restrito: savedUser.setor,
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
    const targetLoja = lojaId || (isSaasAdmin ? 'todas' : (operator.loja_id || ''));
    const emps = await fetchStoreEmployees(targetLoja);
    setEmployees(emps);
  }, [operator.loja_id, isSaasAdmin]);

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

  const updateStoreUserLimit = async (storeId: string, newLimit: number) => {
    const res = await updateStoreUserLimitInDatabase(storeId, newLimit);
    if (res.success) {
      await refreshStores();
    }
    return res;
  };

  const activeLojaId = operator.loja_id || currentUser?.loja_id || stores[0]?.id || '';
  const currentStoreObj = stores.find(s => s.id === activeLojaId) || stores[0];
  const storeName = currentStoreObj?.nome_loja || operator.store || currentUser?.loja_nome || 'Minha Loja';
  const storeColor = currentStoreObj?.cor_primaria || '#059669';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--store-color', storeColor);
    }
  }, [storeColor]);

  const updateStoreSettings = async (updates: { nome_loja?: string; cor_primaria?: string }) => {
    const targetId = activeLojaId;
    if (!targetId) {
      return { success: false, error: 'Loja atual não identificada.' };
    }

    const res = await updateStoreSettingsInDatabase(targetId, updates);

    setStores(prev => {
      const exists = prev.some(s => s.id === targetId);
      if (!exists) {
        return [
          {
            id: targetId,
            nome_loja: updates.nome_loja ?? storeName,
            cor_primaria: updates.cor_primaria ?? storeColor,
            limite_usuarios: 15,
            ativa: true,
          },
          ...prev,
        ];
      }
      return prev.map(s =>
        s.id === targetId
          ? {
              ...s,
              ...(updates.nome_loja !== undefined ? { nome_loja: updates.nome_loja } : {}),
              ...(updates.cor_primaria !== undefined ? { cor_primaria: updates.cor_primaria } : {}),
            }
          : s
      );
    });

    if (updates.nome_loja !== undefined) {
      setOperator(prev => ({ ...prev, store: updates.nome_loja! }));
      if (currentUser) {
        const updatedUser = { ...currentUser, loja_nome: updates.nome_loja };
        setCurrentUser(updatedUser);
        saveStoredData(STORAGE_KEYS.AUTH_USER, updatedUser);
      }
    }

    return res;
  };

  const addOrUpdateEmployee = async (emp: StoreEmployee) => {
    const res = await saveStoreEmployee(emp);
    if (res.success) {
      await refreshEmployees(isSaasAdmin ? 'todas' : emp.loja_id);
      if (emp.loja_id && emp.loja_id === (operator.loja_id || '')) {
        const latestMsgs = await fetchChatMessagesFromSupabase(emp.loja_id);
        if (latestMsgs !== null) {
          setChatMessages(latestMsgs);
        }
      }
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
        cargoCompleto: result.user!.cargoCompleto,
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

  const [disconnectedMessage, setDisconnectedMessage] = useState<string | null>(null);

  const clearDisconnectedMessage = () => {
    setDisconnectedMessage(null);
  };

  const updateUserPassword = async (newPassword: string): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) return { success: false, message: 'Nenhum usuário conectado.' };
    const res = await changeUserPassword(currentUser.matricula, newPassword);
    if (res.success) {
      const updatedUser: AuthUser = {
        ...currentUser,
        primeiro_login: false,
      };
      setCurrentUser(updatedUser);
      saveStoredData(STORAGE_KEYS.AUTH_USER, updatedUser);
      setOperator(prev => ({ ...prev, primeiro_login: false }));
    }
    return res;
  };

  const updateAudit = (auditId: string, updated: Partial<AuditItem>) => {
    setAudits(prev => {
      const idx = prev.findIndex(a => a.id === auditId);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updated };
      saveStoredData(STORAGE_KEYS.AUDITS, copy);
      return copy;
    });
  };

  // Watchdog de Segurança Ativa: Desconecta instantaneamente se o usuário não existir mais no servidor
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    if (currentUser.cargo === 'saas_admin') return;

    let isSubscribed = true;

    const performDisconnect = (companyName?: string) => {
      logout();
      setDisconnectedMessage(`Você foi desconectado por desligamento da empresa ${companyName || operator.store || 'da empresa'}.`);
      triggerScanBeep(false);
    };

    const checkActive = async () => {
      if (!isSubscribed) return;
      try {
        const status = await verifyUserStillActiveRemote(currentUser.matricula, currentUser.loja_id || operator.loja_id);
        if (!status.active && isSubscribed) {
          performDisconnect(status.companyName);
        }
      } catch (err) {
        console.warn('Erro verificação ativa de usuário:', err);
      }
    };

    // 1. Verificação imediata no carregamento
    checkActive();

    // 2. Verificação periódica a cada 2.5s
    const timer = setInterval(checkActive, 2500);

    // 3. Assinatura em Tempo Real (Supabase Realtime) na tabela 'usuarios'
    const unsubscribeRealtime = subscribeToUserStatusRealtime(currentUser.matricula, (comp) => {
      performDisconnect(comp);
    });

    // 4. Ouve alterações no localStorage (ex: gerente desativou ou excluiu funcionário em outra aba)
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'superpwa_employees_data') {
        checkActive();
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('focus', checkActive);

    return () => {
      isSubscribed = false;
      clearInterval(timer);
      unsubscribeRealtime();
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('focus', checkActive);
    };
  }, [isAuthenticated, currentUser, operator.store, operator.loja_id]);

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
      if (dbProducts !== null) {
        if (dbProducts.length === 0) {
          // Se no banco de dados não possuir estoque (0 produtos), limpa o local storage e o state!
          setProducts([]);
          saveStoredData(STORAGE_KEYS.PRODUCTS, []);
        } else {
          setProducts(dbProducts);
          saveStoredData(STORAGE_KEYS.PRODUCTS, dbProducts);
        }
        const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastDatabaseSyncTime(now);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar produtos da nuvem:', err);
    } finally {
      setIsSyncingWithDatabase(false);
    }
  }, [currentUser?.loja_id, operator.loja_id]);

  // Consulta automática do estoque remoto no carregamento
  useEffect(() => {
    if (isAuthenticated) {
      refreshProductsFromDatabase();
    }
  }, [isAuthenticated, refreshProductsFromDatabase]);

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

  /**
   * Importação Segura em Lote por Setor:
   * Quando importar uma planilha do setor X, os produtos do setor Y, Z, etc. NUNCA são substituídos!
   * Apenas os produtos daquele setor específico são adicionados ou atualizados.
   */
  const importProductsBatch = (newItems: SpreadsheetProductItem[], targetSetor: SetorLoja, lojaId: string) => {
    setProducts(prev => {
      // 1. Isola e preserva todos os produtos dos outros setores
      const otherSectors = prev.filter(
        p => (p.category || '').toUpperCase() !== targetSetor.toUpperCase()
      );

      // 2. Setor atual
      const currentSector = prev.filter(
        p => (p.category || '').toUpperCase() === targetSetor.toUpperCase()
      );
      const sectorMap = new Map<string, Product>();
      currentSector.forEach(p => sectorMap.set(p.ean, p));

      newItems.forEach(item => {
        const cleanEan = item.ean.trim();
        const existing = sectorMap.get(cleanEan);
        if (existing) {
          sectorMap.set(cleanEan, {
            ...existing,
            name: item.name.trim() || existing.name,
            supplierCode: item.supplierCode?.trim() || existing.supplierCode,
            reducedCode: item.reducedCode?.trim() || existing.reducedCode,
            stock: item.quantity,
            category: targetSetor,
            location: `Gôndola - ${targetSetor}`,
            lastUpdated: new Date().toISOString(),
          });
        } else {
          const newProd: Product = {
            id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: item.name.trim(),
            ean: cleanEan,
            supplierCode: item.supplierCode?.trim() || undefined,
            reducedCode: item.reducedCode?.trim() || undefined,
            category: targetSetor,
            stock: item.quantity,
            minStock: 10,
            price: 9.90,
            location: `Gôndola - ${targetSetor}`,
            loja_id: lojaId,
            lastUpdated: new Date().toISOString(),
          };
          sectorMap.set(cleanEan, newProd);
        }
      });

      const updated = [...otherSectors, ...Array.from(sectorMap.values())];
      saveStoredData(STORAGE_KEYS.PRODUCTS, updated);
      return updated;
    });
  };

  const lockProductForEdit = (productId: string, lockedByName: string): boolean => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return false;

    // Se já estiver bloqueado por outro operador (expira após 10 minutos para não travar para sempre)
    if (prod.isLockedForEdit && prod.lockedBy && prod.lockedBy !== lockedByName) {
      if (prod.lockedAt) {
        const lockAgeMs = Date.now() - new Date(prod.lockedAt).getTime();
        if (lockAgeMs < 10 * 60 * 1000) {
          return false;
        }
      } else {
        return false;
      }
    }

    setProducts(prev =>
      prev.map(p =>
        p.id === productId
          ? {
              ...p,
              isLockedForEdit: true,
              lockedBy: lockedByName,
              lockedAt: new Date().toISOString(),
            }
          : p
      )
    );
    lockProductInSupabase(productId, lockedByName);
    return true;
  };

  const unlockProductForEdit = (productId: string) => {
    setProducts(prev =>
      prev.map(p =>
        p.id === productId
          ? {
              ...p,
              isLockedForEdit: false,
              lockedBy: undefined,
              lockedAt: undefined,
            }
          : p
      )
    );
    unlockProductInSupabase(productId);
  };

  const updateProductDetails = async (
    productId: string, 
    updates: Partial<Product>
  ): Promise<{ success: boolean; error?: string }> => {
    setProducts(prev =>
      prev.map(p => {
        if (p.id !== productId) return p;
        return {
          ...p,
          ...updates,
          isLockedForEdit: false,
          lockedBy: undefined,
          lockedAt: undefined,
          lastUpdated: new Date().toISOString(),
        };
      })
    );

    const res = await updateProductInSupabase(productId, updates);
    return res;
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

  const toggleProductRebaixa = (id: string) => {
    const target = products.find(p => p.id === id);
    if (!target) return;

    const nextStatus: 'pending' | 'confirmed' =
      target.rebaixaStatus === 'pending' ? 'confirmed' : target.rebaixaStatus === 'confirmed' ? 'confirmed' : 'pending';

    setProducts(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
              rebaixaStatus: nextStatus,
              lastUpdated: new Date().toISOString(),
            }
          : p
      )
    );

    triggerScanBeep(true);
    if (nextStatus === 'confirmed') {
      setNotifications(prev => [
        {
          id: `notif-rebaixa-${id}-${Date.now()}`,
          title: 'Rebaixa Confirmada',
          message: `Rebaixa confirmada para "${target.name}".`,
          type: 'warning',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        },
        ...prev,
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

  // =========================================================================
  // AVARIAS NO ESTOQUE (PERDAS, QUEBRAS E TROCAS)
  // =========================================================================
  const [avarias, setAvarias] = useState<AvariaItem[]>(() => {
    return getStoredAvarias(operator.loja_id);
  });

  const refreshAvarias = useCallback(async () => {
    const lojaId = operator.loja_id || '';
    const list = await fetchAvariasFromDatabase(lojaId);
    setAvarias(list);
  }, [operator.loja_id]);

  const addAvaria = async (
    avariaData: Omit<AvariaItem, 'id' | 'registrado_em' | 'timestamp'>
  ): Promise<{ success: boolean; data?: AvariaItem; synced: boolean }> => {
    const res = await saveAvariaInDatabase(avariaData);

    if (res.data) {
      setAvarias(prev => [res.data!, ...prev.filter(a => a.id !== res.data!.id)]);

      // A avaria é uma perda real: dá baixa no estoque do produto afetado.
      const target = products.find(
        p => p.ean === res.data!.codigo_barras || p.secondaryEan === res.data!.codigo_barras
      );
      if (target && res.data!.quantidade > 0) {
        updateProductStock(target.id, { delta: -res.data!.quantidade });
      }

      triggerScanBeep(true);
      setNotifications(prev => [
        {
          id: `notif-avaria-${res.data!.id}`,
          title: 'Avaria Registrada',
          message: `${res.data!.quantidade}x "${res.data!.produto_nome}" registrada como ${res.data!.tipo_avaria} (${res.data!.para_troca ? 'Para Troca' : 'Sem Troca'}).`,
          type: 'warning',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        },
        ...prev,
      ]);
    }

    return { success: res.success, data: res.data, synced: res.synced };
  };

  // Carrega as avarias e assina o canal em tempo real ao autenticar
  useEffect(() => {
    if (!isAuthenticated) return;
    const lojaId = operator.loja_id || '';

    refreshAvarias();

    const unsub = subscribeToAvariasRealtime(lojaId, (newAv) => {
      setAvarias(prev => [newAv, ...prev.filter(a => a.id !== newAv.id)]);
    });

    return () => unsub();
  }, [isAuthenticated, operator.loja_id, refreshAvarias]);

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
  const [scannerCameraOnly, setScannerCameraOnly] = useState(false);

  const openScanner = (cb?: (barcode: string) => void, options?: { cameraOnly?: boolean }) => {
    if (cb) {
      setScannerCallback(() => cb);
    } else {
      setScannerCallback(null);
    }
    setScannerCameraOnly(Boolean(options?.cameraOnly));
    setIsScannerOpen(true);
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
    setScannerCallback(null);
    setScannerCameraOnly(false);
  };

  // =========================================================================
  // SISTEMA DE CHAT OPERACIONAL (GRUPO DA LOJA E CONVERSAS COM LÍDERES)
  // =========================================================================
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    if (isSupabaseConfigured()) {
      clearObsoleteChatCache();
      return [];
    }
    return getStoredChatMessages(operator.loja_id);
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [directLeaderMatricula, setDirectLeaderMatricula] = useState<string | undefined>(undefined);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const openChat = (targetLeaderMatricula?: string) => {
    setDirectLeaderMatricula(targetLeaderMatricula);
    setIsChatOpen(true);
    setUnreadChatCount(0);
    const lojaId = operator.loja_id || '';
    if (lojaId) {
      fetchChatMessagesFromSupabase(lojaId).then((msgs) => {
        if (msgs !== null) setChatMessages(msgs);
      });
    }
  };

  const closeChat = () => {
    setIsChatOpen(false);
    setDirectLeaderMatricula(undefined);
  };

  const sendChatMessage = async (msgData: {
    canal_tipo: 'grupo' | 'direto_lider';
    destinatario_id?: string;
    destinatario_nome?: string;
    conteudo: string;
    is_anonimo: boolean;
  }) => {
    const senderMatricula = operator.code || operator.matricula || '';
    const fullCargo = resolveFullRoleLabel(
      operator.cargoCompleto || operator.role,
      senderMatricula,
      employees
    );
    const filteredContent = censorProfanity(msgData.conteudo.trim());

    const res = await sendChatMessageToSupabase({
      loja_id: operator.loja_id || '',
      canal_tipo: msgData.canal_tipo,
      destinatario_id: msgData.destinatario_id,
      destinatario_nome: msgData.destinatario_nome,
      remetente_matricula: senderMatricula,
      remetente_nome: msgData.is_anonimo ? 'Operador Anônimo' : (operator.name || 'Operador'),
      remetente_cargo: msgData.is_anonimo ? 'Sigilo Operacional' : fullCargo,
      is_anonimo: msgData.is_anonimo,
      conteudo: filteredContent,
    });

    if (res.data) {
      setChatMessages(prev => {
        const filtered = prev.filter(m => m.id !== res.data!.id);
        return [...filtered, res.data!];
      });
      triggerScanBeep(true);
    }
  };

  // Refs mantêm a assinatura do canal ESTÁVEL durante toda a sessão.
  // Sem elas, abrir/fechar o chat recriaria a assinatura a cada vez,
  // derrubando e reconstruindo o WebSocket desnecessariamente.
  const isChatOpenRef = useRef(isChatOpen);
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  const chatOwnerRef = useRef<string>(operator.code || operator.matricula || '');
  useEffect(() => {
    chatOwnerRef.current = operator.code || operator.matricula || '';
  }, [operator.code, operator.matricula]);

  const operatorRef = useRef(operator);
  useEffect(() => {
    operatorRef.current = operator;
  }, [operator]);

  const employeesRef = useRef(employees);
  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  // Abre o chat automaticamente ao clicar em uma notificação PWA
  useEffect(() => {
    const onOpenChatEvent = () => setIsChatOpen(true);
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OPEN_CHAT_FROM_NOTIFICATION') {
        setIsChatOpen(true);
        setUnreadChatCount(0);
      }
    };
    window.addEventListener('superpwa:open-chat', onOpenChatEvent);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }
    return () => {
      window.removeEventListener('superpwa:open-chat', onOpenChatEvent);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
    };
  }, []);

  // Carregar mensagens do chat e registrar canal em tempo real
  useEffect(() => {
    if (!isAuthenticated) return;
    const lojaId = operator.loja_id || '';

    const syncFromDatabase = (msgs: ChatMessage[] | null) => {
      if (msgs === null) return;
      setChatMessages(msgs);
    };

    fetchChatMessagesFromSupabase(lojaId).then(syncFromDatabase);

    const unsubscribe = subscribeToChatRealtime(
      lojaId,
      (newMsg) => {
        setChatMessages(prev => {
          const idx = prev.findIndex(m => m.id === newMsg.id);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = newMsg;
            return copy;
          }
          return [...prev, newMsg];
        });

        if (newMsg.remetente_matricula === 'SISTEMA') {
          if (!isChatOpenRef.current) {
            setUnreadChatCount(c => c + 1);
          }
          return;
        }

        const myMatricula = chatOwnerRef.current;
        const isFromMe = newMsg.remetente_matricula === myMatricula;

        if (!isFromMe) {
          const targetEval = evaluateMessageNotificationTarget(
            newMsg,
            {
              matricula: myMatricula,
              name: operatorRef.current.name,
              sector: operatorRef.current.setor_restrito,
            },
            employeesRef.current
          );

          // Quando há menção direcionada (@setor ou @usuario) ou canal privado,
          // apenas os usuários-alvo recebem alerta/notificação push
          if (!targetEval.shouldNotify) {
            return;
          }

          if (!isChatOpenRef.current) {
            setUnreadChatCount(c => c + 1);
          }

          // Toca o alerta sonoro de mensagem
          const isSoundEnabled = localStorage.getItem('superpwa_sound_enabled') !== 'false';
          if (isSoundEnabled) {
            triggerScanBeep(true);
          }

          const mentionPrefix = targetEval.isDirectMentionToMe
            ? '🔔 Menção direta'
            : targetEval.isSectorMentionToMe
            ? `🏷️ Setor ${targetEval.mentionedSectors.join(', ')}`
            : null;

          const notifTitle =
            newMsg.canal_tipo === 'direto_lider'
              ? `🔒 Falar com Líderes (${newMsg.remetente_nome})`
              : mentionPrefix
              ? `${mentionPrefix} • ${newMsg.remetente_nome}`
              : `💬 Grupo (${newMsg.remetente_nome})`;

          const cleanBody = censorProfanity(newMsg.conteudo);

          // Adiciona notificação formal na central de notificações
          setNotifications(prev => [
            {
              id: `notif-chat-${newMsg.id}-${Date.now()}`,
              title: notifTitle,
              message: cleanBody,
              type: targetEval.isDirectMentionToMe || targetEval.isSectorMentionToMe ? 'urgent' : 'info',
              timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              read: false,
            },
            ...prev,
          ]);

          // Dispara Notificação Push PWA via Service Worker (mobile + desktop)
          showPWAPushNotification(notifTitle, {
            body: cleanBody,
            tag: `chat-${newMsg.canal_tipo}-${newMsg.id}`,
            data: { messageId: newMsg.id, canal: newMsg.canal_tipo },
          });
        }
      },
      (deletedId) => {
        setChatMessages(prev => prev.filter(m => m.id !== deletedId));
      }
    );

    const handleWindowFocus = () => {
      fetchChatMessagesFromSupabase(lojaId).then(syncFromDatabase);
    };
    window.addEventListener('focus', handleWindowFocus);

    // Rede de segurança: o Realtime é efêmero (não há replay). Se o app ficou
    // offline ou o canal caiu, o polling reconcilia inclusões e exclusões do banco.
    const pollTimer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      fetchChatMessagesFromSupabase(lojaId).then(syncFromDatabase);
    }, 20000);

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleWindowFocus);
      unsubscribe();
    };
  }, [isAuthenticated, operator.loja_id]);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        darkMode,
        isDesktop,
        storeName,
        storeColor,
        updateStoreSettings,

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
        disconnectedMessage,
        clearDisconnectedMessage,
        updateUserPassword,

        stores,
        refreshStores,
        addStore,
        updateStoreUserLimit,
        employees,
        refreshEmployees,
        addOrUpdateEmployee,
        toggleEmployeeStatus,
        roles,
        refreshRoles,
        addOrUpdateRole,

        addProduct,
        importProductsBatch,
        updateProductStock,
        toggleProductRebaixa,
        removeProduct,
        lockProductForEdit,
        unlockProductForEdit,
        updateProductDetails,
        addValidity,
        applyDiscount,
        addAudit,
        updateAudit,
        resetAllData,

        avarias,
        addAvaria,
        refreshAvarias,

        notifications,
        unreadCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,

        isScannerOpen,
        scannerCameraOnly,
        openScanner,
        closeScanner,
        scannerCallback,

        chatMessages,
        isChatOpen,
        openChat,
        closeChat,
        directLeaderMatricula,
        sendChatMessage,
        unreadChatCount,

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
