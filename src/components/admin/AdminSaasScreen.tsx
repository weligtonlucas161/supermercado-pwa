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
  Settings2
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
  const [newStoreColor, setNewStoreColor] = useState('#059669');

  // Form Novo Gerente de Loja
  const [managerName, setManagerName] = useState('');
  const [managerMatricula, setManagerMatricula] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [managerStoreId, setManagerStoreId] = useState(stores[0]?.id || 'loja_padrao_001');

  // Feedback
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtro de gerentes
  const storeManagers = employees.filter(
    e => e.cargo.toLowerCase().includes('gerente') || e.cargo.toLowerCase().includes('admin')
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
      {/* Top Bar Header SaaS Admin */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40 px-4 sm:px-6 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-600/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Painel do Administrador SaaS
                </h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Master Servidor
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Gestão de Lojas, Limites de Usuários e Gerentes de Unidade
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              <span>Servidor Synk 2026.1</span>
            </span>

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition cursor-pointer"
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
        
        {/* Aviso de Isolamento Estrito de Segurança */}
        <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-900 dark:text-indigo-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              <strong>Isolamento Multi-Tenant Garantido:</strong> O Administrador de SaaS gerencia a infraestrutura, criação de lojas e limites de usuários, sem acesso visual a estoques, produtos ou auditorias internas.
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/20 shrink-0 hidden md:inline">
            Zero-Knowledge Tenant Isolation
          </span>
        </div>

        {feedbackMessage && (
          <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
            feedbackMessage.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
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

        {/* Estatísticas do Servidor SaaS (Cards Responsivos) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Lojas Contratadas</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{stores.length}</h3>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {stores.filter(s => s.ativa).length} ativas
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Capacidade Total</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{totalUserCapacity}</h3>
              <span className="text-[10px] text-slate-400">licenças contratadas</span>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Gerentes de Loja</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{storeManagers.length}</h3>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">habilitados</span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Status do Servidor</p>
              <h3 className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Operacional
              </h3>
              <span className="text-[10px] text-slate-400">PostgreSQL + Realtime</span>
            </div>
            <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
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
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Lojas Contratadas ({stores.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('gerentes')}
              className={`py-2 px-4 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'gerentes'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
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
                className="py-2 px-3.5 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Nova Loja</span>
              </button>
            )}

            {activeTab === 'gerentes' && (
              <button
                onClick={() => setIsManagerModalOpen(true)}
                className="py-2 px-3.5 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Gerente de Loja</span>
              </button>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* SEÇÃO 1: TABELA E CARDS DE LOJAS */}
        {/* ================================================================= */}
        {activeTab === 'lojas' && (
          <div className="space-y-4">
            {stores.length === 0 ? (
              <div className="text-center py-16 rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800">
                <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nenhuma loja cadastrada no servidor</p>
                <button
                  onClick={() => setIsStoreModalOpen(true)}
                  className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
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
                      className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5 hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md"
                            style={{ backgroundColor: store.cor_primaria || '#059669' }}
                          >
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
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
                          <span className="text-slate-500">Limite de Usuários Contratados</span>
                          <span className={isNearLimit ? 'text-amber-500 font-black' : 'text-slate-800 dark:text-slate-200'}>
                            {storeEmps.length} / {store.limite_usuarios}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              isNearLimit ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, (storeEmps.length / (store.limite_usuarios || 1)) * 100)}%` }}
                          />
                        </div>
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
                        <th className="p-3.5">Loja Vinculada</th>
                        <th className="p-3.5">Cargo</th>
                        <th className="p-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {storeManagers.map(mgr => {
                        const store = stores.find(s => s.id === mgr.loja_id);
                        return (
                          <tr key={mgr.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                            <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                              {mgr.nome}
                            </td>
                            <td className="p-3.5 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              {mgr.matricula}
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

      {/* Modal Criar Loja */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600">
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
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
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
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-black text-emerald-600"
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
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer"
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
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600">
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
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md cursor-pointer"
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
