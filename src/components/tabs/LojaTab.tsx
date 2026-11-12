import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Check, 
  X, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Briefcase, 
  Tag, 
  Sliders, 
  Lock, 
  Unlock,
  KeyRound,
  Edit2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StoreEmployee, StoreRole, SETORES_DISPONIVEIS, SetorLoja } from '../../types';
import { triggerScanBeep } from '../../utils/haptics';
import { EmployeeDetailModal } from '../modals/EmployeeDetailModal';

export const LojaTab: React.FC = () => {
  const { 
    operator, 
    stores, 
    employees, 
    addOrUpdateEmployee, 
    toggleEmployeeStatus, 
    roles, 
    addOrUpdateRole, 
    darkMode,
    isDesktop 
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'funcionarios' | 'cargos'>('funcionarios');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [selectedEmployeeForDetail, setSelectedEmployeeForDetail] = useState<StoreEmployee | null>(null);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<StoreRole | null>(null);

  // Form Funcionário
  const [empMatricula, setEmpMatricula] = useState('');
  const [empNome, setEmpNome] = useState('');
  const [empSenha, setEmpSenha] = useState('123456');
  const [empCargo, setEmpCargo] = useState('Operador de Gôndola');
  const [empCodigoFornecedor, setEmpCodigoFornecedor] = useState('');
  const [empSetorRestrito, setEmpSetorRestrito] = useState<string>('TODOS');

  // Form Cargo
  const [roleNome, setRoleNome] = useState('');
  const [roleDescricao, setRoleDescricao] = useState('');
  const [rolePodeAuditar, setRolePodeAuditar] = useState(true);
  const [rolePodeAjustarEstoque, setRolePodeAjustarEstoque] = useState(true);
  const [rolePodeImportarPlanilha, setRolePodeImportarPlanilha] = useState(false);
  const [rolePodeGerenciarValidade, setRolePodeGerenciarValidade] = useState(true);
  const [roleSetorRestrito, setRoleSetorRestrito] = useState<string>('TODOS');

  // Feedback
  const [notice, setNotice] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  // Loja do gerente atual
  const currentLojaId = operator.loja_id || 'loja_padrao_001';
  const currentStore = stores.find(s => s.id === currentLojaId) || stores[0] || {
    id: currentLojaId,
    nome_loja: operator.store || 'Supermercado Silva - Loja 01',
    limite_usuarios: 15,
    ativa: true,
  };

  const storeEmployees = employees.filter(e => e.loja_id === currentLojaId);
  const userLimit = currentStore.limite_usuarios || 15;
  const isLimitReached = storeEmployees.length >= userLimit;

  // Filtragem de funcionários
  const filteredEmployees = storeEmployees.filter(e => 
    e.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.cargo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handler Adicionar Funcionário
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empMatricula.trim() || !empNome.trim()) {
      setNotice({ type: 'error', text: 'Preencha a matrícula e o nome do funcionário.' });
      return;
    }

    if (isLimitReached) {
      setNotice({ 
        type: 'error', 
        text: `Limite máximo de ${userLimit} usuários atingido para esta loja. Contate o Administrador de SaaS para ampliar a cota de licenças.` 
      });
      return;
    }

    if (empCargo === 'Promotor' && !empCodigoFornecedor.trim()) {
      setNotice({ type: 'error', text: 'Informe o Código de Fornecedor Atribuído para o cargo Promotor.' });
      return;
    }

    const isPromotorRole = empCargo === 'Promotor';

    const newEmp: StoreEmployee = {
      id: `usr_emp_${Date.now()}`,
      matricula: empMatricula.trim(),
      nome: empNome.trim(),
      senha: empSenha.trim() || '123456',
      cargo: empCargo,
      codigo_fornecedor: isPromotorRole ? empCodigoFornecedor.trim().toUpperCase() : undefined,
      setor_restrito: empSetorRestrito,
      loja_id: currentLojaId,
      ativo: true,
      permissoes: isPromotorRole ? {
        setores_permitidos: empSetorRestrito === 'TODOS' ? [] : [empSetorRestrito],
        pode_auditar: false,
        pode_ajustar_estoque: false,
        pode_importar_planilha: false,
        pode_gerenciar_validade: true,
        pode_acessar_chat: false,
      } : undefined,
      created_at: new Date().toISOString(),
    };

    const res = await addOrUpdateEmployee(newEmp);
    if (res.success) {
      triggerScanBeep(true);
      setNotice({ 
        type: 'success', 
        text: `Funcionário "${newEmp.nome}" cadastrado com sucesso! Permissão: ${empSetorRestrito === 'TODOS' ? 'Todos os setores' : `Somente ${empSetorRestrito}`}.` 
      });
      setIsEmployeeModalOpen(false);
      setEmpMatricula('');
      setEmpNome('');
      setEmpSenha('123456');
      setEmpCodigoFornecedor('');
      setEmpSetorRestrito('TODOS');
    } else {
      setNotice({ type: 'error', text: res.error || 'Erro ao cadastrar funcionário.' });
    }
  };

  // Handler Salvar Cargo
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleNome.trim()) {
      setNotice({ type: 'error', text: 'Informe o nome do cargo.' });
      return;
    }

    const roleToSave: StoreRole = {
      id: editingRole ? editingRole.id : `role_${Date.now()}`,
      loja_id: currentLojaId,
      nome: roleNome.trim(),
      descricao: roleDescricao.trim() || undefined,
      permissoes: {
        setores_permitidos: roleSetorRestrito === 'TODOS' ? [] : [roleSetorRestrito],
        pode_auditar: rolePodeAuditar,
        pode_ajustar_estoque: rolePodeAjustarEstoque,
        pode_importar_planilha: rolePodeImportarPlanilha,
        pode_gerenciar_validade: rolePodeGerenciarValidade,
      },
    };

    await addOrUpdateRole(roleToSave);
    triggerScanBeep(true);
    setNotice({ 
      type: 'success', 
      text: `Cargo "${roleToSave.nome}" salvo com as permissões atualizadas!` 
    });
    setIsRoleModalOpen(false);
    setEditingRole(null);
    setRoleNome('');
    setRoleDescricao('');
  };

  const openEditRoleModal = (role: StoreRole) => {
    setEditingRole(role);
    setRoleNome(role.nome);
    setRoleDescricao(role.descricao || '');
    setRolePodeAuditar(role.permissoes.pode_auditar ?? true);
    setRolePodeAjustarEstoque(role.permissoes.pode_ajustar_estoque ?? true);
    setRolePodeImportarPlanilha(role.permissoes.pode_importar_planilha ?? false);
    setRolePodeGerenciarValidade(role.permissoes.pode_gerenciar_validade ?? true);
    setRoleSetorRestrito(role.permissoes.setores_permitidos?.[0] || 'TODOS');
    setIsRoleModalOpen(true);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      
      {/* Header Gestão de Loja */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Gestão da Unidade: {currentStore.nome_loja}
              </h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                Painel do Gerente
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Gerenciamento de funcionários, cargos operacionais e restrições por setor
            </p>
          </div>
        </div>

        {/* Indicador de Capacidade de Usuários da Loja */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700/80 min-w-[210px]">
          <div className="flex justify-between text-xs font-bold mb-1">
            <span className="text-slate-500">Capacidade da Loja:</span>
            <span className={isLimitReached ? 'text-rose-500 font-black' : 'text-emerald-600 dark:text-emerald-400'}>
              {storeEmployees.length} / {userLimit} usuários
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${isLimitReached ? 'bg-rose-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, (storeEmployees.length / userLimit) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            {isLimitReached ? '⚠️ Limite máximo atingido' : `Disponível: ${userLimit - storeEmployees.length} licenças`}
          </span>
        </div>
      </div>

      {notice && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between animate-in slide-in-from-top-1 ${
          notice.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
            : notice.type === 'warning'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navegação entre Sub-Abas da Loja */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('funcionarios')}
            className={`py-2 px-3.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'funcionarios'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Funcionários da Loja ({storeEmployees.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('cargos')}
            className={`py-2 px-3.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'cargos'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Cargos e Permissões ({roles.length})</span>
          </button>
        </div>

        {activeSubTab === 'funcionarios' ? (
          <button
            onClick={() => {
              if (isLimitReached) {
                setNotice({ 
                  type: 'warning', 
                  text: `Você já atingiu o limite de ${userLimit} usuários contratados. Não é possível adicionar novos operadores nesta loja.` 
                });
                return;
              }
              setIsEmployeeModalOpen(true);
            }}
            disabled={isLimitReached}
            className="py-2 px-3.5 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-md flex items-center gap-1.5 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Adicionar Funcionário</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setEditingRole(null);
              setRoleNome('');
              setRoleDescricao('');
              setRolePodeAuditar(true);
              setRolePodeAjustarEstoque(true);
              setRolePodeImportarPlanilha(false);
              setRolePodeGerenciarValidade(true);
              setRoleSetorRestrito('TODOS');
              setIsRoleModalOpen(true);
            }}
            className="py-2 px-3.5 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-1.5 transition cursor-pointer"
          >
            <Briefcase className="w-4 h-4" />
            <span>Novo Cargo</span>
          </button>
        )}
      </div>

      {/* =================================================================== */}
      {/* SUB-ABA 1: FUNCIONÁRIOS DA LOJA */}
      {/* =================================================================== */}
      {activeSubTab === 'funcionarios' && (
        <div className="space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar operador por nome, matrícula ou cargo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12 rounded-3xl bg-white dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700">
              <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nenhum funcionário encontrado</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Clique em "Adicionar Funcionário" para cadastrar seu primeiro operador.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredEmployees.map(emp => (
                <div 
                  key={emp.id}
                  onClick={() => setSelectedEmployeeForDetail(emp)}
                  className={`p-4 rounded-3xl border transition-all cursor-pointer hover:border-emerald-500/50 hover:shadow-md active:scale-[0.99] ${
                    emp.ativo
                      ? 'bg-white dark:bg-slate-850 border-slate-200/80 dark:border-slate-750 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                  title="Clique para ver senha, detalhes e editar permissões"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        {emp.nome}
                      </h4>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                        Matrícula: {emp.matricula}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEmployeeStatus(emp.id, !emp.ativo);
                      }}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full cursor-pointer transition ${
                        emp.ativo
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                          : 'bg-rose-500/15 text-rose-600 hover:bg-rose-500/25'
                      }`}
                    >
                      {emp.ativo ? '✓ Ativo' : 'Inativo'}
                    </button>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1">
                    <p className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Cargo: <strong>{emp.cargo}</strong></span>
                    </p>

                    {emp.codigo_fornecedor && (
                      <p className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5 text-[11px] font-mono">
                        <Tag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>Fornecedor: <strong>{emp.codigo_fornecedor}</strong></span>
                      </p>
                    )}

                    {/* Permissão de Setor Específica */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <Tag className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-slate-500">Demanda:</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                        emp.setor_restrito === 'TODOS' || !emp.setor_restrito
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {emp.setor_restrito === 'TODOS' || !emp.setor_restrito ? 'Acesso Global (Todos)' : `Somente Setor: ${emp.setor_restrito}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-ABA 2: CARGOS E PERMISSÕES */}
      {/* =================================================================== */}
      {activeSubTab === 'cargos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {roles.map(role => (
              <div 
                key={role.id}
                className="p-4 rounded-3xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-750 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {role.nome}
                      </h4>
                      {role.descricao && (
                        <p className="text-[11px] text-slate-400 line-clamp-1">{role.descricao}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => openEditRoleModal(role)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Editar Cargo"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Tags de Permissões */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Auditoria de Presença:</span>
                    <span className={role.permissoes.pode_auditar ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {role.permissoes.pode_auditar ? '✓ Permitido' : '✕ Bloqueado'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Ajuste de Estoque:</span>
                    <span className={role.permissoes.pode_ajustar_estoque ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {role.permissoes.pode_ajustar_estoque ? '✓ Permitido' : '✕ Bloqueado'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Importação de Planilhas:</span>
                    <span className={role.permissoes.pode_importar_planilha ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {role.permissoes.pode_importar_planilha ? '✓ Permitido' : '✕ Bloqueado'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Setores Autorizados:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {role.permissoes.setores_permitidos?.length 
                        ? role.permissoes.setores_permitidos.join(', ') 
                        : 'Todos os setores'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Adicionar Funcionário */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Adicionar Funcionário da Loja</h3>
                  <p className="text-[11px] text-slate-400">Atribua matrícula, cargo e restrição de setor</p>
                </div>
              </div>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João Ferreira dos Santos"
                  value={empNome}
                  onChange={e => setEmpNome(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Matrícula de Login *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 5044"
                    value={empMatricula}
                    onChange={e => setEmpMatricula(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Senha de Acesso *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Senha do operador"
                    value={empSenha}
                    onChange={e => setEmpSenha(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Cargo Operacional *
                </label>
                <select
                  value={empCargo}
                  onChange={e => setEmpCargo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.nome}>{r.nome}</option>
                  ))}
                  <option value="Operador Geral">Operador Geral</option>
                  <option value="Conferente de Auditoria">Conferente de Auditoria</option>
                  <option value="Fiscal de Prevenção">Fiscal de Prevenção</option>
                  <option value="Promotor">Promotor</option>
                </select>
              </div>

              {empCargo === 'Promotor' && (
                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/25 space-y-1.5 animate-in fade-in">
                  <label className="font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider text-[10px] block">
                    Código do Fornecedor Atribuído *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: FORN-NESTLE-01 ou 7891000"
                    value={empCodigoFornecedor}
                    onChange={e => setEmpCodigoFornecedor(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-blue-500/40 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white uppercase text-xs"
                  />
                  <p className="text-[10px] text-blue-600 dark:text-blue-300">
                    O Promotor terá acesso exclusivo à aba de Auditoria de Validade e verá apenas produtos deste código de fornecedor.
                  </p>
                </div>
              )}

              {/* PERMISSÃO POR SETOR ESPECÍFICO (Ex: Somente demandas do setor X ou Y) */}
              <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <label className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-500" />
                  Permissão de Demandas por Setor
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Defina se este operador tem acesso a todos os setores ou somente ao setor sob sua responsabilidade:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEmpSetorRestrito('TODOS')}
                    className={`p-2 rounded-xl text-center text-xs font-bold border transition ${
                      empSetorRestrito === 'TODOS'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Acesso a Todos
                  </button>

                  {SETORES_DISPONIVEIS.map(setor => (
                    <button
                      key={setor}
                      type="button"
                      onClick={() => setEmpSetorRestrito(setor)}
                      className={`p-2 rounded-xl text-center text-xs font-bold border transition ${
                        empSetorRestrito === setor
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Somente {setor}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer"
                >
                  Gravar Funcionário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Cargo */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {editingRole ? 'Editar Cargo da Loja' : 'Criar Novo Cargo'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Configure as permissões operacionais do cargo</p>
                </div>
              </div>
              <button onClick={() => setIsRoleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Nome do Cargo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Conferente de Frios e Perecíveis"
                  value={roleNome}
                  onChange={e => setRoleNome(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Descrição das Atividades
                </label>
                <input
                  type="text"
                  placeholder="Ex: Auditoria contínua de presença e controle de gôndola"
                  value={roleDescricao}
                  onChange={e => setRoleDescricao(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>

              {/* Switches de Permissões */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 block">
                  Permissões de Acesso
                </span>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-700 dark:text-slate-300">Pode realizar Auditoria de Presença</span>
                  <input
                    type="checkbox"
                    checked={rolePodeAuditar}
                    onChange={e => setRolePodeAuditar(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-700 dark:text-slate-300">Pode ajustar saldos de estoque</span>
                  <input
                    type="checkbox"
                    checked={rolePodeAjustarEstoque}
                    onChange={e => setRolePodeAjustarEstoque(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-700 dark:text-slate-300">Pode importar planilhas Excel</span>
                  <input
                    type="checkbox"
                    checked={rolePodeImportarPlanilha}
                    onChange={e => setRolePodeImportarPlanilha(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-700 dark:text-slate-300">Pode gerenciar validades e descontos</span>
                  <input
                    type="checkbox"
                    checked={rolePodeGerenciarValidade}
                    onChange={e => setRolePodeGerenciarValidade(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                </label>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Setor Padrão deste Cargo
                </label>
                <select
                  value={roleSetorRestrito}
                  onChange={e => setRoleSetorRestrito(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                >
                  <option value="TODOS">Todos os Setores (Geral)</option>
                  {SETORES_DISPONIVEIS.map(s => (
                    <option key={s} value={s}>Somente {s}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer"
                >
                  Salvar Cargo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhes, Visualização de Senha e Edição do Funcionário */}
      <EmployeeDetailModal
        isOpen={Boolean(selectedEmployeeForDetail)}
        employee={selectedEmployeeForDetail}
        onClose={() => setSelectedEmployeeForDetail(null)}
      />
    </div>
  );
};
