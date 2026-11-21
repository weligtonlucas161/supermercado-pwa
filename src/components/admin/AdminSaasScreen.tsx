import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Server, 
  Users, 
  Plus, 
  LogOut, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  HardDrive, 
  Lock, 
  X,
  Search, 
  Check, 
  Zap, 
  Globe, 
  Sliders, 
  Settings2, 
  Eye, 
  EyeOff, 
  Layers, 
  Briefcase, 
  Phone, 
  MapPin, 
  FileText, 
  Save, 
  Activity, 
  Package, 
  RefreshCw, 
  Radio, 
  Trash2,
  Edit2,
  UserPlus,
  UserCheck,
  UserX,
  Filter
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Store, StoreEmployee, SETORES_DISPONIVEIS } from '../../types';
import { triggerScanBeep } from '../../utils/haptics';
import { 
  fetchSaasTelemetry, 
  SaasTelemetryData, 
  fetchStoreEmployees, 
  fetchStoreActiveSessions, 
  ActiveSession 
} from '../../services/supabaseService';

export const AdminSaasScreen: React.FC = () => {
  const { 
    logout, 
    stores, 
    addStore, 
    deleteStore,
    updateStoreUserLimit,
    employees, 
    addOrUpdateEmployee, 
    deleteEmployee,
    toggleEmployeeStatus,
    effectiveOnline,
    darkMode,
    isDesktop 
  } = useApp();

  const [isDeletingStore, setIsDeletingStore] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'lojas' | 'gerentes' | 'servidor'>('lojas');

  // Telemetria do Servidor SaaS e Consumo por Loja
  const [telemetry, setTelemetry] = useState<SaasTelemetryData | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);

  const loadTelemetry = async () => {
    setIsLoadingTelemetry(true);
    try {
      const data = await fetchSaasTelemetry();
      setTelemetry(data);
    } catch (e) {
      console.warn('Erro ao consultar telemetria:', e);
    } finally {
      setIsLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    loadTelemetry();
    const interval = setInterval(loadTelemetry, 30000);
    return () => clearInterval(interval);
  }, [stores.length, employees.length]);

  // Modal de Detalhes da Loja com Hierarquia de Usuários, Senhas e Sessões Ativas
  const [selectedStoreForDetails, setSelectedStoreForDetails] = useState<Store | null>(null);
  const [editingUserLimit, setEditingUserLimit] = useState<number>(15);
  const [isSavingLimit, setIsSavingLimit] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [storeActiveSessions, setStoreActiveSessions] = useState<ActiveSession[]>([]);
  const [localStoreEmps, setLocalStoreEmps] = useState<StoreEmployee[]>([]);
  const [isLoadingStoreDetails, setIsLoadingStoreDetails] = useState(false);

  const togglePasswordReveal = (empId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [empId]: !prev[empId]
    }));
  };

  const loadStoreDetailsData = async (storeId: string) => {
    setIsLoadingStoreDetails(true);
    try {
      const [emps, sessions] = await Promise.all([
        fetchStoreEmployees(storeId),
        fetchStoreActiveSessions(storeId),
      ]);
      setLocalStoreEmps(emps);
      setStoreActiveSessions(sessions);
    } catch (err) {
      console.warn('Erro ao carregar detalhes da loja:', err);
    } finally {
      setIsLoadingStoreDetails(false);
    }
  };

  const handleOpenStoreDetails = (store: Store) => {
    setSelectedStoreForDetails(store);
    setEditingUserLimit(store.limite_usuarios || 15);
    loadStoreDetailsData(store.id);
  };

  useEffect(() => {
    if (!selectedStoreForDetails) return;
    const interval = setInterval(() => {
      loadStoreDetailsData(selectedStoreForDetails.id);
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedStoreForDetails?.id]);

  const handleSaveStoreUserLimit = async () => {
    if (!selectedStoreForDetails) return;
    if (editingUserLimit < 1) {
      setFeedbackMessage({ type: 'error', text: 'O limite mínimo de usuários deve ser 1.' });
      return;
    }

    setIsSavingLimit(true);
    const res = await updateStoreUserLimit(selectedStoreForDetails.id, editingUserLimit);
    setIsSavingLimit(false);

    if (res.success) {
      triggerScanBeep(true);
      setSelectedStoreForDetails({ ...selectedStoreForDetails, limite_usuarios: editingUserLimit });
      setFeedbackMessage({ 
        type: 'success', 
        text: `Limite de usuários da loja "${selectedStoreForDetails.nome_loja}" atualizado para ${editingUserLimit} com sucesso!` 
      });
      loadTelemetry();
    } else {
      setFeedbackMessage({ type: 'error', text: res.error || 'Erro ao atualizar o limite de usuários.' });
    }
  };

  // Modais de Criação
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<StoreEmployee | null>(null);

  // Form Nova Loja (Registra apenas infraestrutura sem gerentes automáticos)
  const [newStoreId, setNewStoreId] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCnpj, setNewStoreCnpj] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStorePhone, setNewStorePhone] = useState('');
  const [newStoreUserLimit, setNewStoreUserLimit] = useState(15);
  const [newStoreColor, setNewStoreColor] = useState('#e11d48');

  // Form Novo / Edição de Perfil de Loja
  const [profileStoreId, setProfileStoreId] = useState(stores[0]?.id || '');
  const [profileName, setProfileName] = useState('');
  const [profileMatricula, setProfileMatricula] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileCargo, setProfileCargo] = useState('Gerente Geral da Loja');
  const [profileCustomCargo, setProfileCustomCargo] = useState('');
  const [profileSetor, setProfileSetor] = useState('TODOS');
  const [profileAtivo, setProfileAtivo] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Filtros da Aba de Perfis
  const [profileFilterStore, setProfileFilterStore] = useState<'todas' | string>('todas');
  const [profileFilterRole, setProfileFilterRole] = useState<'todos' | 'gerentes' | 'operadores'>('todos');
  const [profileSearchTerm, setProfileSearchTerm] = useState('');

  // Sincroniza profileStoreId caso a lista de lojas mude ou carregue do banco
  useEffect(() => {
    if ((!profileStoreId || !stores.some(s => s.id === profileStoreId)) && stores.length > 0) {
      setProfileStoreId(stores[0].id);
    }
  }, [stores, profileStoreId]);

  // Feedback
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Colaboradores que não são saas_admin
  const nonSaasEmployees = employees.filter(e => e.cargo.toLowerCase() !== 'saas_admin');

  // Filtro de gerentes (exclui saas_admin)
  const storeManagers = employees.filter(
    e =>
      e.cargo.toLowerCase() !== 'saas_admin' &&
      (e.cargo.toLowerCase().includes('gerente') || e.cargo.toLowerCase().includes('admin') || e.cargo.toLowerCase().includes('master'))
  );

  const totalUserCapacity = stores.reduce((acc, s) => acc + (s.limite_usuarios || 0), 0);

  const handleOpenCreateProfile = (targetStoreId?: string, defaultCargo?: string) => {
    setEditingEmployee(null);
    setProfileName('');
    setProfileMatricula('');
    setProfilePassword('');
    setProfileCargo(defaultCargo || 'Gerente Geral da Loja');
    setProfileCustomCargo('');
    setProfileSetor('TODOS');
    setProfileAtivo(true);
    if (targetStoreId) {
      setProfileStoreId(targetStoreId);
    } else if (stores.length > 0) {
      setProfileStoreId(stores[0].id);
    }
    setIsProfileModalOpen(true);
  };

  const handleOpenEditProfile = (emp: StoreEmployee) => {
    setEditingEmployee(emp);
    setProfileStoreId(emp.loja_id);
    setProfileName(emp.nome);
    setProfileMatricula(emp.matricula);
    setProfilePassword(emp.senha || '');
    const standardCargos = [
      'Gerente Geral da Loja',
      'Subgerente',
      'Encarregado de Setor',
      'Auditor de Validade',
      'Conferente de Estoque',
      'Operador de Gôndola',
      'Fiscal de Prevenção'
    ];
    if (standardCargos.includes(emp.cargo)) {
      setProfileCargo(emp.cargo);
      setProfileCustomCargo('');
    } else {
      setProfileCargo('Outro');
      setProfileCustomCargo(emp.cargo);
    }
    setProfileSetor(emp.setor_restrito || 'TODOS');
    setProfileAtivo(emp.ativo);
    setIsProfileModalOpen(true);
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Informe o nome da loja.' });
      return;
    }

    const generatedId = newStoreId.trim() || `loja_${Date.now()}`;
    const newStore: Store = {
      id: generatedId,
      nome_loja: newStoreName.trim(),
      cnpj: newStoreCnpj.trim() || undefined,
      endereco: newStoreAddress.trim() || undefined,
      telefone: newStorePhone.trim() || undefined,
      limite_usuarios: Math.max(1, newStoreUserLimit),
      ativa: true,
      cor_primaria: newStoreColor,
      created_at: new Date().toISOString(),
    };

    // Registra estritamente a infraestrutura/tenant sem criar perfis de gerente automáticos
    const res = await addStore(newStore);
    if (res.success) {
      triggerScanBeep(true);
      setFeedbackMessage({ 
        type: 'success', 
        text: `Loja "${newStore.nome_loja}" cadastrada com sucesso! Cota configurada para ${newStore.limite_usuarios} usuários.` 
      });
      setIsStoreModalOpen(false);
      setNewStoreId('');
      setNewStoreName('');
      setNewStoreCnpj('');
      setNewStoreAddress('');
      setNewStorePhone('');
      setNewStoreUserLimit(15);
      loadTelemetry();
    } else {
      setFeedbackMessage({ type: 'error', text: res.error || 'Erro ao criar loja no banco.' });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCargo = profileCargo === 'Outro' ? profileCustomCargo.trim() : profileCargo;
    const targetStoreId = profileStoreId || selectedStoreForDetails?.id || stores[0]?.id || '';

    if (!profileName.trim() || !targetStoreId) {
      setFeedbackMessage({ type: 'error', text: 'Preencha o nome e selecione uma loja válida.' });
      return;
    }

    if (!editingEmployee && !profilePassword.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Informe a senha de acesso para o novo perfil.' });
      return;
    }

    setIsSavingProfile(true);

    const empToSave: StoreEmployee = {
      id: editingEmployee ? editingEmployee.id : `usr_emp_${Date.now()}`,
      matricula: editingEmployee ? profileMatricula.trim() : '',
      nome: profileName.trim(),
      senha: profilePassword.trim() || (editingEmployee?.senha || ''),
      cargo: finalCargo || 'Operador',
      setor_restrito: profileSetor,
      loja_id: targetStoreId,
      ativo: profileAtivo,
      created_at: editingEmployee?.created_at || new Date().toISOString(),
    };

    const res = await addOrUpdateEmployee(empToSave);
    setIsSavingProfile(false);

    if (res.success) {
      triggerScanBeep(true);
      setFeedbackMessage({ 
        type: 'success', 
        text: `Perfil "${empToSave.nome}" (${empToSave.cargo}) salvo com sucesso${res.matricula ? ` com a matrícula ${res.matricula}` : ''}!`
      });
      setIsProfileModalOpen(false);
      setEditingEmployee(null);
      if (selectedStoreForDetails) {
        loadStoreDetailsData(selectedStoreForDetails.id);
      }
      loadTelemetry();
    } else {
      setFeedbackMessage({ type: 'error', text: res.error || 'Erro ao salvar perfil no banco de dados.' });
    }
  };

  const handleDeleteProfile = async (emp: StoreEmployee) => {
    if (!window.confirm(`Deseja realmente remover o perfil de "${emp.nome}" (Matrícula: ${emp.matricula}) da loja?`)) {
      return;
    }

    const res = await deleteEmployee(emp.id, emp.matricula);
    if (res.success) {
      setFeedbackMessage({ type: 'success', text: `Perfil "${emp.nome}" excluído com sucesso.` });
      if (selectedStoreForDetails) {
        loadStoreDetailsData(selectedStoreForDetails.id);
      }
      loadTelemetry();
    } else {
      setFeedbackMessage({ type: 'error', text: res.error || 'Erro ao excluir perfil.' });
    }
  };

  const handleToggleStatus = async (emp: StoreEmployee) => {
    await toggleEmployeeStatus(emp.id, !emp.ativo);
    setFeedbackMessage({ 
      type: 'success', 
      text: `Status de "${emp.nome}" alterado para ${!emp.ativo ? 'Ativo' : 'Inativo'}.` 
    });
    if (selectedStoreForDetails) {
      loadStoreDetailsData(selectedStoreForDetails.id);
    }
    loadTelemetry();
  };

  // Filtragem na tabela de perfis
  const filteredProfiles = nonSaasEmployees.filter(emp => {
    const matchesStore = profileFilterStore === 'todas' || emp.loja_id === profileFilterStore;
    const isMgr = emp.cargo.toLowerCase().includes('gerente') || emp.cargo.toLowerCase().includes('admin') || emp.cargo.toLowerCase().includes('master');
    const matchesRole = 
      profileFilterRole === 'todos' ? true :
      profileFilterRole === 'gerentes' ? isMgr :
      !isMgr;
    const matchesSearch = 
      emp.nome.toLowerCase().includes(profileSearchTerm.toLowerCase()) ||
      emp.matricula.toLowerCase().includes(profileSearchTerm.toLowerCase()) ||
      emp.cargo.toLowerCase().includes(profileSearchTerm.toLowerCase()) ||
      (stores.find(s => s.id === emp.loja_id)?.nome_loja || '').toLowerCase().includes(profileSearchTerm.toLowerCase());

    return matchesStore && matchesRole && matchesSearch;
  });

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Top Bar Header SaaS Admin - Cores Vermelhas / Rose */}
      <header className="border-b border-rose-500/20 bg-white dark:bg-slate-900 sticky top-0 z-40 px-4 sm:px-6 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 via-red-600 to-rose-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-rose-600/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Painel do Administrador SaaS
                </h1>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  Master Servidor
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Gestão Central de Lojas, Cotas de Usuários e Equipes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
              <Globe className="w-3.5 h-3.5 text-rose-500" />
              <span>Servidor Synk 2026.1 (Red Master)</span>
            </span>

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition cursor-pointer"
              title="Encerrar Sessão de Administrador SaaS"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair do Servidor</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Banner de Isolamento Multi-Tenant */}
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-950 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>
              <strong>Painel Master de Servidor (SaaS):</strong> Gerenciamento exclusivo de infraestrutura multi-loja. Clique em qualquer card de loja para abrir os detalhes completos, visualizar a hierarquia e consultar senhas de gerentes e funcionários.
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-700 dark:text-rose-300 shrink-0 hidden md:inline border border-rose-500/30">
            Multi-Tenant Zero-Knowledge
          </span>
        </div>

        {feedbackMessage && (
          <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
            feedbackMessage.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
              : 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
              <span>{feedbackMessage.text}</span>
            </div>
            <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Telemetria de Uso Geral do Servidor SaaS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-600 dark:text-rose-400 animate-pulse" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Telemetria Geral do Servidor
              </h3>
            </div>
            <button
              onClick={loadTelemetry}
              disabled={isLoadingTelemetry}
              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
              title="Recarregar dados de telemetria do servidor"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingTelemetry ? 'animate-spin' : ''}`} />
              <span>{isLoadingTelemetry ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Lojas SaaS</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {telemetry?.server ? telemetry.server.total_stores : stores.length}
                </h3>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {telemetry?.server ? telemetry.server.active_stores : stores.filter(s => s.ativa).length} ativas
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Building2 className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Usuários no Banco</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {telemetry?.server ? telemetry.server.total_users : employees.length}
                </h3>
                <span className="text-[10px] text-slate-400">
                  {totalUserCapacity} cota total
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Itens / Catálogo</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {telemetry?.server ? telemetry.server.total_products : 0}
                </h3>
                <span className="text-[10px] text-slate-400">cadastrados</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Package className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Sessões Ativas</p>
                <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {telemetry?.server ? telemetry.server.active_sessions : 0}
                </h3>
                <span className="text-[10px] text-slate-400">online agora</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Radio className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Logs & Ações</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {telemetry?.server ? telemetry.server.total_logs : 0}
                </h3>
                <span className="text-[10px] text-slate-400">registros auditados</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <FileText className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Status do Servidor</p>
                <h3 className="text-xs font-black text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  Operacional
                </h3>
                <span className="text-[10px] text-slate-400">PostgreSQL + Realtime</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Navegação entre Seções do SaaS */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('lojas')}
              className={`py-2 px-4 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'lojas'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-rose-500/40'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Lojas Contratadas ({stores.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('gerentes')}
              className={`py-2 px-4 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'gerentes'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-rose-500/40'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Perfis & Usuários ({nonSaasEmployees.length})</span>
            </button>
          </div>

          <div>
            {activeTab === 'lojas' && (
              <button
                onClick={() => setIsStoreModalOpen(true)}
                className="py-2 px-3.5 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Nova Loja</span>
              </button>
            )}

            {activeTab === 'gerentes' && (
              <button
                onClick={() => handleOpenCreateProfile()}
                className="py-2 px-3.5 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 flex items-center gap-1.5 transition cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Criar Perfil para Loja</span>
              </button>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* SEÇÃO 1: CARDS DE LOJAS (CLICÁVEIS PARA ABRIR POPUP DE DETALHES) */}
        {/* ================================================================= */}
        {activeTab === 'lojas' && (
          <div className="space-y-4">
            {stores.length === 0 ? (
              <div className="text-center py-16 rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800">
                <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nenhuma loja cadastrada no servidor</p>
                <button
                  onClick={() => setIsStoreModalOpen(true)}
                  className="mt-3 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                >
                  Criar Primeira Loja
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.map(store => {
                  const storeEmps = employees.filter(e => e.loja_id === store.id);
                  const storeMetrics = telemetry?.stores?.[store.id];
                  const usersCount = storeMetrics ? storeMetrics.users_count : storeEmps.length;
                  const limit = store.limite_usuarios || 15;
                  const percentUsed = Math.min(100, Math.round((usersCount / Math.max(1, limit)) * 100));
                  const isNearLimit = usersCount >= limit;
                  const productsCount = storeMetrics?.products_count ?? 0;
                  const sessionsCount = storeMetrics?.sessions_count ?? 0;
                  const logsCount = storeMetrics?.logs_count ?? 0;

                  return (
                    <div 
                      key={store.id}
                      onClick={() => handleOpenStoreDetails(store)}
                      className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5 hover:shadow-lg hover:border-rose-500/50 transition cursor-pointer group"
                      title="Clique para abrir detalhes completos, cota de licenças, equipe e senhas desta loja"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md transition-transform group-hover:scale-105"
                            style={{ backgroundColor: store.cor_primaria || '#e11d48' }}
                          >
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                              {store.nome_loja}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {store.id}</p>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          store.ativa 
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-rose-500/15 text-rose-600'
                        }`}>
                          {store.ativa ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>

                      <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                        {store.cnpj && <p><strong>CNPJ:</strong> {store.cnpj}</p>}
                        {store.endereco && <p className="truncate"><strong>Endereço:</strong> {store.endereco}</p>}
                        {store.telefone && <p><strong>Telefone:</strong> {store.telefone}</p>}
                      </div>

                      {/* Contagem de Usuários & Limite da Loja */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            <span>Contagem de Usuários</span>
                          </span>
                          <span className={isNearLimit ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-800 dark:text-slate-200'}>
                            {usersCount} / {limit} licenças ({percentUsed}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              percentUsed >= 100 
                                ? 'bg-rose-600' 
                                : percentUsed >= 80 
                                ? 'bg-amber-500' 
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percentUsed}%` }}
                          />
                        </div>
                      </div>

                      {/* Consumo Individual de Dados da Loja */}
                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-1.5 text-center text-[10px]">
                        <div>
                          <span className="text-slate-400 block font-medium">Produtos</span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                            {productsCount}
                          </span>
                        </div>
                        <div className="border-x border-slate-200 dark:border-slate-750">
                          <span className="text-slate-400 block font-medium">Sessões</span>
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">
                            {sessionsCount} online
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Logs/Ações</span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                            {logsCount}
                          </span>
                        </div>
                      </div>

                      {/* Dica de Clique */}
                      <div className="pt-1 flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400 font-bold group-hover:underline">
                        <span>Editar cota, gerenciar perfis e senhas</span>
                        <span>→</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* SEÇÃO 2: PERFIS & COLABORADORES DE TODAS AS LOJAS */}
        {/* ================================================================= */}
        {activeTab === 'gerentes' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-rose-600" />
                    <span>Perfis e Usuários das Lojas ({filteredProfiles.length} exibidos de {nonSaasEmployees.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Crie, edite e gerencie gerentes, subgerentes, encarregados, conferentes e operadores de cada loja.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenCreateProfile()}
                  className="self-start md:self-auto px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Novo Perfil de Loja</span>
                </button>
              </div>

              {/* Barra de Filtros e Busca */}
              <div className="p-3.5 bg-slate-50/70 dark:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shadow-xs">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={profileFilterStore}
                      onChange={e => setProfileFilterStore(e.target.value)}
                      className="bg-transparent font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="todas">Todas as Lojas ({stores.length})</option>
                      {stores.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nome_loja}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => setProfileFilterRole('todos')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                        profileFilterRole === 'todos' 
                          ? 'bg-rose-600 text-white' 
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      Todos ({nonSaasEmployees.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileFilterRole('gerentes')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                        profileFilterRole === 'gerentes' 
                          ? 'bg-rose-600 text-white' 
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      Gerentes ({storeManagers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileFilterRole('operadores')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                        profileFilterRole === 'operadores' 
                          ? 'bg-rose-600 text-white' 
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      Equipe ({Math.max(0, nonSaasEmployees.length - storeManagers.length)})
                    </button>
                  </div>
                </div>

                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar nome, matrícula, cargo..."
                    value={profileSearchTerm}
                    onChange={e => setProfileSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              {filteredProfiles.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 space-y-3">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>Nenhum perfil de colaborador encontrado com os filtros atuais.</p>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateProfile()}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Criar Novo Perfil</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3.5">Nome do Colaborador</th>
                        <th className="p-3.5">Matrícula</th>
                        <th className="p-3.5">Senha de Acesso</th>
                        <th className="p-3.5">Loja Vinculada</th>
                        <th className="p-3.5">Cargo / Perfil</th>
                        <th className="p-3.5">Setor</th>
                        <th className="p-3.5 text-center">Status</th>
                        <th className="p-3.5 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredProfiles.map(emp => {
                        const store = stores.find(s => s.id === emp.loja_id);
                        const isRevealed = Boolean(revealedPasswords[emp.id]);
                        const isOnline = storeActiveSessions.some(
                          s => s.matricula.trim().toLowerCase() === emp.matricula.trim().toLowerCase()
                        );
                        const isMgr = emp.cargo.toLowerCase().includes('gerente') || emp.cargo.toLowerCase().includes('admin');

                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                            <td className="p-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {emp.nome}
                                </span>
                                {isOnline && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Online
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3.5 font-mono font-semibold text-rose-600 dark:text-rose-400">
                              {emp.matricula}
                            </td>
                            <td className="p-3.5">
                              <button
                                type="button"
                                onClick={() => togglePasswordReveal(emp.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-mono text-[11px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                                title="Clique para ver ou ocultar a senha deste usuário"
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                                <span>{isRevealed ? (emp.senha || 'Não cadastrada') : '••••••••'}</span>
                              </button>
                            </td>
                            <td className="p-3.5">
                              <div className="flex items-center gap-1.5">
                                <span 
                                  className="w-2 h-2 rounded-full shrink-0" 
                                  style={{ backgroundColor: store?.cor_primaria || '#e11d48' }} 
                                />
                                <span className="text-slate-700 dark:text-slate-300 font-medium">
                                  {store ? store.nome_loja : emp.loja_id}
                                </span>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isMgr 
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20' 
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}>
                                {emp.cargo}
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-500 text-[11px]">
                              {emp.setor_restrito || 'TODOS'}
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(emp)}
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full transition cursor-pointer ${
                                  emp.ativo 
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25' 
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-slate-300'
                                }`}
                                title={emp.ativo ? 'Clique para desativar usuário' : 'Clique para ativar usuário'}
                              >
                                {emp.ativo ? 'Ativo' : 'Inativo'}
                              </button>
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditProfile(emp)}
                                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                                  title="Editar perfil"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProfile(emp)}
                                  className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 transition cursor-pointer"
                                  title="Excluir perfil permanentemente"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* POP-UP DETALHADO DA LOJA: DADOS, HIERARQUIA, SESSÕES E VISUALIZAÇÃO DE SENHAS */}
      {/* =================================================================== */}
      {selectedStoreForDetails && (() => {
        const storeEmps = localStoreEmps.length > 0 
          ? localStoreEmps 
          : employees.filter(e => e.loja_id === selectedStoreForDetails.id);
        const gerentes = storeEmps.filter(
          e => e.cargo.toLowerCase().includes('gerente') || e.cargo.toLowerCase().includes('admin') || e.cargo.toLowerCase().includes('master')
        );
        const funcionarios = storeEmps.filter(
          e => !(e.cargo.toLowerCase().includes('gerente') || e.cargo.toLowerCase().includes('admin') || e.cargo.toLowerCase().includes('master'))
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 max-h-[92vh] flex flex-col">
              
              {/* Header do Pop-up da Loja */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-md"
                    style={{ backgroundColor: selectedStoreForDetails.cor_primaria || '#e11d48' }}
                  >
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                      {selectedStoreForDetails.nome_loja}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      ID: {selectedStoreForDetails.id} • {selectedStoreForDetails.ativa ? '🟢 Unidade Ativa' : '🔴 Unidade Inativa'}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setSelectedStoreForDetails(null);
                    setLocalStoreEmps([]);
                    setStoreActiveSessions([]);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informações da Loja */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/70 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">CNPJ</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                    {selectedStoreForDetails.cnpj || 'Não informado'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Telefone</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                    {selectedStoreForDetails.telefone || 'Não informado'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Cota de Usuários</span>
                  <span className="font-black text-rose-600 dark:text-rose-400 block">
                    {storeEmps.length} / {selectedStoreForDetails.limite_usuarios} licenças
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Tipo</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    {selectedStoreForDetails.nome_loja.toLowerCase().includes('matriz') ? 'Matriz' : 'Unidade'}
                  </span>
                </div>
              </div>

              {/* Gestão e Alteração do Limite de Usuários da Loja */}
              <div className="p-3.5 rounded-2xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>Limite Editável de Usuários (Cota)</span>
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Em uso: <strong>{storeEmps.length}</strong> de <strong>{selectedStoreForDetails.limite_usuarios}</strong> licenças ({Math.max(0, selectedStoreForDetails.limite_usuarios - storeEmps.length)} vagas livres)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-900 rounded-xl px-2.5 py-1.5 shadow-xs">
                      <label htmlFor="modal-edit-limit-input" className="text-[10px] font-bold text-slate-400 uppercase">
                        Limite:
                      </label>
                      <input
                        id="modal-edit-limit-input"
                        type="number"
                        min={1}
                        max={500}
                        value={editingUserLimit}
                        onChange={e => setEditingUserLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-16 font-black text-xs text-rose-600 dark:text-rose-400 bg-transparent focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isSavingLimit || editingUserLimit === selectedStoreForDetails.limite_usuarios}
                      onClick={handleSaveStoreUserLimit}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                        editingUserLimit !== selectedStoreForDetails.limite_usuarios
                          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                      title={editingUserLimit === selectedStoreForDetails.limite_usuarios ? 'Modifique o valor para salvar' : 'Salvar novo limite no banco'}
                    >
                      {isSavingLimit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{isSavingLimit ? 'Salvando...' : 'Salvar Limite'}</span>
                    </button>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      storeEmps.length >= selectedStoreForDetails.limite_usuarios
                        ? 'bg-rose-600'
                        : storeEmps.length >= selectedStoreForDetails.limite_usuarios * 0.8
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (storeEmps.length / Math.max(1, selectedStoreForDetails.limite_usuarios)) * 100)}%`
                    }}
                  />
                </div>
              </div>

              {/* Métricas de Consumo da Loja no Modal */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/70 dark:border-slate-800 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium uppercase">Produtos em Estoque</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {telemetry?.stores?.[selectedStoreForDetails.id]?.products_count ?? 0} itens
                  </span>
                </div>
                <div className="border-x border-slate-200 dark:border-slate-750">
                  <span className="text-[10px] text-slate-400 block font-medium uppercase">Conexões Ativas</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                    {storeActiveSessions.length} online
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium uppercase">Logs & Auditorias</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {telemetry?.stores?.[selectedStoreForDetails.id]?.logs_count ?? 0} registros
                  </span>
                </div>
              </div>

              {/* Endereço */}
              {selectedStoreForDetails.endereco && (
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 px-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span><strong>Endereço:</strong> {selectedStoreForDetails.endereco}</span>
                </p>
              )}

              {/* Botão de Ação Rápida: Criar Perfil para Esta Loja */}
              <button
                type="button"
                onClick={() => handleOpenCreateProfile(selectedStoreForDetails.id)}
                className="w-full py-2.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Criar Novo Perfil / Colaborador para {selectedStoreForDetails.nome_loja}</span>
              </button>

              {/* Seção de Sessões Ativas e Hierarquia */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* 1. SESSÕES ATIVAS SINCRONIZADAS EM TEMPO REAL */}
                <div className="space-y-2 p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      <span>Sessões Ativas Online ({storeActiveSessions.length})</span>
                    </h4>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      Banco de Dados (sessoes_ativas)
                    </span>
                  </div>

                  {isLoadingStoreDetails && storeActiveSessions.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sincronizando sessões ativas do banco...</span>
                    </div>
                  ) : storeActiveSessions.length === 0 ? (
                    <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-800/60 text-xs text-slate-400 text-center border border-dashed border-slate-200 dark:border-slate-700">
                      Nenhuma sessão ativa conectada nesta unidade no momento.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {storeActiveSessions.map((sess, idx) => {
                        const matchedEmp = storeEmps.find(
                          e => e.matricula.trim().toLowerCase() === sess.matricula.trim().toLowerCase()
                        );
                        return (
                        <div 
                          key={sess.matricula + '_' + idx}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-2 shadow-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                              <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                {sess.usuario_nome || matchedEmp?.nome || sess.matricula}
                              </span>
                              {matchedEmp?.cargo && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  {matchedEmp.cargo}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono">
                              Matrícula: <strong>{sess.matricula}</strong>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              🟢 Ativa
                            </span>
                            {sess.last_seen && (
                              <p className="text-[9px] text-slate-400 mt-1">
                                Visto às {new Date(Number(sess.last_seen)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. HIERARQUIA 1: GERENTES E LIDERANÇAS */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>2. Gerentes & Lideranças da Loja ({gerentes.length})</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateProfile(selectedStoreForDetails.id, 'Gerente Geral da Loja')}
                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adicionar Gerente</span>
                    </button>
                  </div>

                  {isLoadingStoreDetails && gerentes.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Carregando gerentes da loja...</span>
                    </div>
                  ) : gerentes.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-400 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-700">
                      <p>Nenhum gerente cadastrado nesta loja.</p>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateProfile(selectedStoreForDetails.id, 'Gerente Geral da Loja')}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Cadastrar Gerente para esta Loja</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {gerentes.map(emp => {
                        const isRevealed = Boolean(revealedPasswords[emp.id]);
                        const isOnline = storeActiveSessions.some(
                          s => s.matricula.trim().toLowerCase() === emp.matricula.trim().toLowerCase()
                        );

                        return (
                          <div 
                            key={emp.id}
                            className="p-3 rounded-2xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 dark:text-white">{emp.nome}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500 text-white">
                                  {emp.cargo}
                                </span>
                                {isOnline ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Online
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                    Offline
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono">
                                Matrícula: <strong>{emp.matricula}</strong> • Setor: {emp.setor_restrito || 'TODOS'}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                              <span className="text-[11px] text-slate-400 font-semibold">Senha:</span>
                              <button
                                type="button"
                                onClick={() => togglePasswordReveal(emp.id)}
                                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 font-mono text-xs font-bold text-slate-900 dark:text-white border border-rose-300 dark:border-rose-900/50 shadow-xs flex items-center gap-1 transition cursor-pointer"
                                title="Clique para ver ou ocultar a senha deste usuário"
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                                <span>{isRevealed ? (emp.senha || 'Não cadastrada') : '••••••••'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleStatus(emp)}
                                className={`p-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                                  emp.ativo 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-600' 
                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400'
                                }`}
                                title={emp.ativo ? 'Usuário ativo (clique para desativar)' : 'Usuário inativo (clique para ativar)'}
                              >
                                {emp.ativo ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditProfile(emp)}
                                className="p-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                                title="Editar dados deste gerente"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteProfile(emp)}
                                className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                                title="Excluir este gerente permanentemente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. HIERARQUIA 2: FUNCIONÁRIOS E OPERADORES */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>3. Funcionários & Operadores de Área ({funcionarios.length})</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateProfile(selectedStoreForDetails.id, 'Operador de Gôndola')}
                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adicionar Operador</span>
                    </button>
                  </div>

                  {isLoadingStoreDetails && funcionarios.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Carregando funcionários da loja...</span>
                    </div>
                  ) : funcionarios.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-400 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-700">
                      <p>Nenhum operador cadastrado nesta loja ainda.</p>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateProfile(selectedStoreForDetails.id, 'Operador de Gôndola')}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Cadastrar Colaborador para esta Loja</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {funcionarios.map(emp => {
                        const isRevealed = Boolean(revealedPasswords[emp.id]);
                        const isOnline = storeActiveSessions.some(
                          s => s.matricula.trim().toLowerCase() === emp.matricula.trim().toLowerCase()
                        );

                        return (
                          <div 
                            key={emp.id}
                            className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 dark:text-white">{emp.nome}</span>
                                <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  {emp.cargo}
                                </span>
                                {isOnline ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Online
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                    Offline
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono">
                                Matrícula: <strong>{emp.matricula}</strong> • Setor: {emp.setor_restrito || 'Geral'}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                              <span className="text-[11px] text-slate-400 font-semibold">Senha:</span>
                              <button
                                type="button"
                                onClick={() => togglePasswordReveal(emp.id)}
                                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-650 font-mono text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 shadow-xs flex items-center gap-1 transition cursor-pointer"
                                title="Clique para ver ou ocultar a senha deste funcionário"
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                                <span>{isRevealed ? (emp.senha || 'Não cadastrada') : '••••••••'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleStatus(emp)}
                                className={`p-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                                  emp.ativo 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-600' 
                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400'
                                }`}
                                title={emp.ativo ? 'Usuário ativo (clique para desativar)' : 'Usuário inativo (clique para ativar)'}
                              >
                                {emp.ativo ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditProfile(emp)}
                                className="p-1.5 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-650 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 transition cursor-pointer"
                                title="Editar dados deste funcionário"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteProfile(emp)}
                                className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                                title="Excluir este funcionário permanentemente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmação de Exclusão da Loja */}
              {confirmDeleteId === selectedStoreForDetails.id && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 space-y-2 animate-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-extrabold text-xs">
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Deseja realmente excluir permanentemente a loja {selectedStoreForDetails.nome_loja}?</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Esta ação removerá do servidor todos os produtos em estoque, colaboradores, auditorias e encerrará imediatamente todas as conexões ativas.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isDeletingStore}
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingStore}
                      onClick={async () => {
                        setIsDeletingStore(true);
                        try {
                          await deleteStore(selectedStoreForDetails.id);
                          setSelectedStoreForDetails(null);
                          setLocalStoreEmps([]);
                          setStoreActiveSessions([]);
                          setConfirmDeleteId(null);
                          loadTelemetry();
                        } catch (err) {
                          console.error('Erro ao excluir loja:', err);
                        } finally {
                          setIsDeletingStore(false);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {isDeletingStore ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>{isDeletingStore ? 'Excluindo...' : 'Sim, Excluir Definitivamente'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Rodapé do Modal */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(selectedStoreForDetails.id)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Loja</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStoreForDetails(null);
                    setLocalStoreEmps([]);
                    setStoreActiveSessions([]);
                    setConfirmDeleteId(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
                >
                  Fechar Detalhes
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Modal Criar Loja */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Criar Nova Loja (Tenant)</h3>
                  <p className="text-[11px] text-slate-400">Registra apenas a infraestrutura da loja no banco de dados</p>
                </div>
              </div>
              <button onClick={() => setIsStoreModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>
                <strong>Sem criação automática de gerente:</strong> Esta rotina cadastra unicamente a infraestrutura da loja/tenant. Usuários e lideranças podem ser provisionados manualmente na aba <em>"Gerentes de Loja"</em>.
              </span>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Nome da Loja *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Supermercado Central - Loja 02"
                  value={newStoreName}
                  onChange={e => setNewStoreName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Código / ID da Loja
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: loja_02"
                    value={newStoreId}
                    onChange={e => setNewStoreId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Limite Máximo de Usuários *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={newStoreUserLimit}
                    onChange={e => setNewStoreUserLimit(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-black text-rose-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    CNPJ (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={newStoreCnpj}
                    onChange={e => setNewStoreCnpj(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Telefone de Contato
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 98765-4321"
                    value={newStorePhone}
                    onChange={e => setNewStorePhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Endereço da Unidade
                </label>
                <input
                  type="text"
                  placeholder="Rua das Palmeiras, 500 - Centro"
                  value={newStoreAddress}
                  onChange={e => setNewStoreAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 cursor-pointer"
                >
                  Criar Loja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Perfil de Loja */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {editingEmployee ? 'Editar Perfil de Colaborador' : 'Criar Perfil / Usuário para Loja'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingEmployee ? `Atualize os dados e acessos de ${editingEmployee.nome}` : 'Provisione novos acessos de gerentes ou equipe da unidade'}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsProfileModalOpen(false);
                  setEditingEmployee(null);
                }} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Vincular à Loja *
                </label>
                <select
                  value={profileStoreId || stores[0]?.id || ''}
                  onChange={e => setProfileStoreId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {stores.map(s => {
                    const count = employees.filter(e => e.loja_id === s.id && e.cargo.toLowerCase() !== 'saas_admin').length;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.nome_loja} ({count}/{s.limite_usuarios || 15} usuários contratados)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Mariana Albuquerque"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {editingEmployee && <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Matrícula de Login *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 5001 ou GER-01"
                    value={profileMatricula}
                    onChange={e => setProfileMatricula(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>}
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  {editingEmployee ? 'Nova Senha de Acesso (deixe em branco para manter a atual)' : 'Senha de Acesso *'}
                </label>
                <input
                  type="password"
                  required={!editingEmployee}
                  placeholder={editingEmployee ? 'Manter senha atual ou digitar nova' : 'Digite uma senha segura'}
                  value={profilePassword}
                  onChange={e => setProfilePassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Cargo / Função na Loja *
                  </label>
                  <select
                    value={profileCargo}
                    onChange={e => setProfileCargo(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Gerente Geral da Loja">Gerente Geral da Loja</option>
                    <option value="Subgerente">Subgerente</option>
                    <option value="Encarregado de Setor">Encarregado de Setor</option>
                    <option value="Auditor de Validade">Auditor de Validade</option>
                    <option value="Conferente de Estoque">Conferente de Estoque</option>
                    <option value="Operador de Gôndola">Operador de Gôndola</option>
                    <option value="Fiscal de Prevenção">Fiscal de Prevenção</option>
                    <option value="Outro">Outro (personalizado)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Setor Restrito
                  </label>
                  <select
                    value={profileSetor}
                    onChange={e => setProfileSetor(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {SETORES_DISPONIVEIS.map(setor => (
                      <option key={setor} value={setor}>
                        {setor}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {profileCargo === 'Outro' && (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Especifique o Cargo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Supervisor Regional, Estoquista Noturno..."
                    value={profileCustomCargo}
                    onChange={e => setProfileCustomCargo(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="profile-active-check"
                  checked={profileAtivo}
                  onChange={e => setProfileAtivo(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer w-4 h-4"
                />
                <label htmlFor="profile-active-check" className="font-bold text-slate-700 dark:text-slate-300 text-xs cursor-pointer">
                  Perfil Ativo (Permite login e operações no app da loja)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    setEditingEmployee(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isSavingProfile ? 'Salvando...' : (editingEmployee ? 'Atualizar Perfil' : 'Salvar Perfil')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
