import React, { useState } from 'react';
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
  FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Store, StoreEmployee } from '../../types';
import { triggerScanBeep } from '../../utils/haptics';

export const AdminSaasScreen: React.FC = () => {
  const { 
    logout, 
    stores, 
    addStore, 
    employees, 
    addOrUpdateEmployee, 
    effectiveOnline,
    darkMode,
    isDesktop 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'lojas' | 'gerentes' | 'servidor'>('lojas');

  // Modal de Detalhes da Loja com Hierarquia de Usuários e Revelação de Senhas
  const [selectedStoreForDetails, setSelectedStoreForDetails] = useState<Store | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  const togglePasswordReveal = (empId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [empId]: !prev[empId]
    }));
  };

  // Modais de Criação
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

  // Form Nova Loja
  const [newStoreId, setNewStoreId] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCnpj, setNewStoreCnpj] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStorePhone, setNewStorePhone] = useState('');
  const [newStoreUserLimit, setNewStoreUserLimit] = useState(15);
  const [newStoreColor, setNewStoreColor] = useState('#e11d48');

  // Form Novo Gerente de Loja
  const [managerName, setManagerName] = useState('');
  const [managerMatricula, setManagerMatricula] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [managerStoreId, setManagerStoreId] = useState(stores[0]?.id || 'loja_padrao_001');

  // Feedback
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtro de gerentes
  const storeManagers = employees.filter(
    e => e.cargo.toLowerCase().includes('gerente') || e.cargo.toLowerCase().includes('admin') || e.cargo.toLowerCase().includes('master')
  );

  const totalUserCapacity = stores.reduce((acc, s) => acc + (s.limite_usuarios || 0), 0);

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

    const res = await addStore(newStore);
    if (res.success) {
      triggerScanBeep(true);
      setFeedbackMessage({ type: 'success', text: `Loja "${newStore.nome_loja}" criada com limite de ${newStore.limite_usuarios} usuários!` });
      setIsStoreModalOpen(false);
      setNewStoreId('');
      setNewStoreName('');
      setNewStoreCnpj('');
      setNewStoreAddress('');
      setNewStorePhone('');
      setNewStoreUserLimit(15);
    } else {
      setFeedbackMessage({ type: 'error', text: res.error || 'Erro ao criar loja no banco.' });
    }
  };

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerName.trim() || !managerMatricula.trim() || !managerPassword.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Preencha todos os campos do gerente de loja.' });
      return;
    }

    const newEmp: StoreEmployee = {
      id: `usr_mgr_${Date.now()}`,
      matricula: managerMatricula.trim(),
      nome: managerName.trim(),
      senha: managerPassword.trim(),
      cargo: 'Gerente Geral da Loja',
      setor_restrito: 'TODOS',
      loja_id: managerStoreId,
      ativo: true,
      created_at: new Date().toISOString(),
    };

    const res = await addOrUpdateEmployee(newEmp);
    if (res.success) {
      triggerScanBeep(true);
      setFeedbackMessage({ type: 'success', text: `Gerente "${newEmp.nome}" provisionado com sucesso para a loja selecionada!` });
      setIsManagerModalOpen(false);
      setManagerName('');
      setManagerMatricula('');
      setManagerPassword('');
    } else {
      setFeedbackMessage({ type: 'error', text: res.error || 'Erro ao salvar gerente.' });
    }
  };

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

        {/* Estatísticas do Servidor SaaS (Cards com detalhes em Vermelho) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Lojas Contratadas</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{stores.length}</h3>
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                {stores.filter(s => s.ativa).length} ativas
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Capacidade Total</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{totalUserCapacity}</h3>
              <span className="text-[10px] text-slate-400">licenças contratadas</span>
            </div>
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Gerentes de Loja</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{storeManagers.length}</h3>
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">habilitados</span>
            </div>
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <KeyRound className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Status do Servidor</p>
              <h3 className="text-base font-black text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                Operacional
              </h3>
              <span className="text-[10px] text-slate-400">PostgreSQL + Realtime</span>
            </div>
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <HardDrive className="w-5 h-5" />
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
              <KeyRound className="w-4 h-4" />
              <span>Gerentes de Loja ({storeManagers.length})</span>
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
                onClick={() => setIsManagerModalOpen(true)}
                className="py-2 px-3.5 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Gerente de Loja</span>
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
                  className="mt-3 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
                >
                  Criar Primeira Loja
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.map(store => {
                  const storeEmps = employees.filter(e => e.loja_id === store.id);
                  const isNearLimit = storeEmps.length >= (store.limite_usuarios || 15);

                  return (
                    <div 
                      key={store.id}
                      onClick={() => setSelectedStoreForDetails(store)}
                      className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5 hover:shadow-lg hover:border-rose-500/50 transition cursor-pointer group"
                      title="Clique para abrir detalhes completos, equipe e senhas desta loja"
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

                      {/* Medidor de Limite de Usuários */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-500">Usuários Vinculados</span>
                          <span className={isNearLimit ? 'text-amber-500 font-black' : 'text-slate-800 dark:text-slate-200'}>
                            {storeEmps.length} / {store.limite_usuarios}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              isNearLimit ? 'bg-amber-500' : 'bg-rose-600'
                            }`}
                            style={{ width: `${Math.min(100, (storeEmps.length / (store.limite_usuarios || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Dica de Clique */}
                      <div className="pt-1 flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400 font-bold group-hover:underline">
                        <span>Ver detalhes, gerentes e senhas</span>
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
        {/* SEÇÃO 2: GERENTES DE LOJA (ADMINISTRADORES DE UNIDADE) */}
        {/* ================================================================= */}
        {activeTab === 'gerentes' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Gerentes de Loja Cadastrados
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Estes usuários possuem acesso ao painel de gestão de equipe e cargos de suas respectivas lojas.
                  </p>
                </div>
              </div>

              {storeManagers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum gerente cadastrado ainda. Clique em "Criar Gerente de Loja" para provisionar o primeiro.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3.5">Nome do Gerente</th>
                        <th className="p-3.5">Matrícula de Login</th>
                        <th className="p-3.5">Senha de Acesso</th>
                        <th className="p-3.5">Loja Vinculada</th>
                        <th className="p-3.5">Cargo</th>
                        <th className="p-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {storeManagers.map(mgr => {
                        const store = stores.find(s => s.id === mgr.loja_id);
                        const isRevealed = Boolean(revealedPasswords[mgr.id]);

                        return (
                          <tr key={mgr.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                            <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                              {mgr.nome}
                            </td>
                            <td className="p-3.5 font-mono font-semibold text-rose-600 dark:text-rose-400">
                              {mgr.matricula}
                            </td>
                            <td className="p-3.5">
                              <button
                                type="button"
                                onClick={() => togglePasswordReveal(mgr.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-mono text-[11px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                                title="Clique para ver ou ocultar a senha deste usuário"
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                                <span>{isRevealed ? (mgr.senha || 'Não cadastrada') : '••••••••'}</span>
                              </button>
                            </td>
                            <td className="p-3.5 text-slate-600 dark:text-slate-300">
                              {store ? store.nome_loja : mgr.loja_id}
                            </td>
                            <td className="p-3.5 text-slate-500">
                              {mgr.cargo}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                Ativo
                              </span>
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
      {/* POP-UP DETALHADO DA LOJA: DADOS, HIERARQUIA E VISUALIZAÇÃO DE SENHAS */}
      {/* =================================================================== */}
      {selectedStoreForDetails && (() => {
        const storeEmps = employees.filter(e => e.loja_id === selectedStoreForDetails.id);
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
                  onClick={() => setSelectedStoreForDetails(null)}
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
                    {selectedStoreForDetails.id === 'loja_padrao_001' ? 'Matriz' : 'Filial'}
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

              {/* Seção Hierárquica: Gerentes vs Funcionários */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* 1. HIERARQUIA 1: GERENTES E LIDERANÇAS */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>1. Gerentes & Lideranças da Loja ({gerentes.length})</span>
                    </h4>
                    <span className="text-[10px] text-slate-400">Nível Hierárquico 1</span>
                  </div>

                  {gerentes.length === 0 ? (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-400 text-center">
                      Nenhum gerente cadastrado nesta loja.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {gerentes.map(emp => {
                        const isRevealed = Boolean(revealedPasswords[emp.id]);
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
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono">
                                Matrícula: <strong>{emp.matricula}</strong> • Setor: {emp.setor_restrito || 'TODOS'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <span className="text-[11px] text-slate-400 font-semibold">Senha:</span>
                              <button
                                type="button"
                                onClick={() => togglePasswordReveal(emp.id)}
                                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 font-mono text-xs font-bold text-slate-900 dark:text-white border border-rose-300 dark:border-rose-900/50 shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                                title="Clique para ver ou ocultar a senha deste usuário"
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                                <span>{isRevealed ? (emp.senha || 'Não cadastrada') : '••••••••'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. HIERARQUIA 2: FUNCIONÁRIOS E OPERADORES */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>2. Funcionários & Operadores de Área ({funcionarios.length})</span>
                    </h4>
                    <span className="text-[10px] text-slate-400">Nível Hierárquico 2</span>
                  </div>

                  {funcionarios.length === 0 ? (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-400 text-center">
                      Nenhum operador cadastrado nesta loja ainda.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {funcionarios.map(emp => {
                        const isRevealed = Boolean(revealedPasswords[emp.id]);
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
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono">
                                Matrícula: <strong>{emp.matricula}</strong> • Setor: {emp.setor_restrito || 'Geral'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <span className="text-[11px] text-slate-400 font-semibold">Senha:</span>
                              <button
                                type="button"
                                onClick={() => togglePasswordReveal(emp.id)}
                                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-650 font-mono text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                                title="Clique para ver ou ocultar a senha deste funcionário"
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                                <span>{isRevealed ? (emp.senha || 'Não cadastrada') : '••••••••'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-semibold">
                  Total de {storeEmps.length} colaboradores na base da unidade
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedStoreForDetails(null)}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 transition cursor-pointer"
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
                  <p className="text-[11px] text-slate-400">Defina os dados da unidade e o limite contratado de operadores</p>
                </div>
              </div>
              <button onClick={() => setIsStoreModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Nome da Loja *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Supermercado Silva - Loja 02 (Bairro Novo)"
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

      {/* Modal Criar Gerente */}
      {isManagerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Criar Gerente de Loja</h3>
                  <p className="text-[11px] text-slate-400">Provisione o administrador da loja selecionada</p>
                </div>
              </div>
              <button onClick={() => setIsManagerModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManager} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Vincular à Loja *
                </label>
                <select
                  value={managerStoreId}
                  onChange={e => setManagerStoreId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                >
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nome_loja} (Limite: {s.limite_usuarios} usuários)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Nome Completo do Gerente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mariana Albuquerque"
                  value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Matrícula de Login *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: GER-002 ou 5001"
                  value={managerMatricula}
                  onChange={e => setManagerMatricula(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Senha Provisória de Acesso *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Digite uma senha forte"
                  value={managerPassword}
                  onChange={e => setManagerPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsManagerModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 cursor-pointer"
                >
                  Provisionar Gerente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
