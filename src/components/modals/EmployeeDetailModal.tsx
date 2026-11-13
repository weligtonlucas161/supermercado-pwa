import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  KeyRound, 
  Briefcase, 
  Tag, 
  Building2, 
  Calendar, 
  Edit3, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Check,
  MessageSquare,
  Lock,
  Layers
} from 'lucide-react';
import { StoreEmployee, SETORES_DISPONIVEIS, SetorLoja } from '../../types';
import { useApp } from '../../context/AppContext';
import { triggerScanBeep } from '../../utils/haptics';

interface EmployeeDetailModalProps {
  employee: StoreEmployee | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  employee,
  isOpen,
  onClose,
}) => {
  const { addOrUpdateEmployee, toggleEmployeeStatus, roles, darkMode } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Editable Form State
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [cargo, setCargo] = useState('');
  const [setorRestrito, setSetorRestrito] = useState<string>('TODOS');
  const [ativo, setAtivo] = useState(true);

  // Granular permissions
  const [podeAuditar, setPodeAuditar] = useState(true);
  const [podeAjustarEstoque, setPodeAjustarEstoque] = useState(true);
  const [podeImportarPlanilha, setPodeImportarPlanilha] = useState(false);
  const [podeGerenciarValidade, setPodeGerenciarValidade] = useState(true);
  const [podeAcessarChat, setPodeAcessarChat] = useState(true);

  useEffect(() => {
    if (employee) {
      setNome(employee.nome || '');
      setMatricula(employee.matricula || '');
      setSenha(employee.senha || '');
      setCargo(employee.cargo || 'Operador de Gôndola');
      setSetorRestrito(employee.setor_restrito || 'TODOS');
      setAtivo(employee.ativo);
      
      const p = employee.permissoes;
      setPodeAuditar(p?.pode_auditar ?? true);
      setPodeAjustarEstoque(p?.pode_ajustar_estoque ?? true);
      setPodeImportarPlanilha(p?.pode_importar_planilha ?? false);
      setPodeGerenciarValidade(p?.pode_gerenciar_validade ?? true);
      setPodeAcessarChat(p?.pode_acessar_chat ?? true);

      setIsEditing(false);
      setShowPassword(false);
      setNotice(null);
    }
  }, [employee, isOpen]);

  if (!isOpen || !employee) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !matricula.trim()) {
      setNotice({ type: 'error', text: 'Nome e matrícula são obrigatórios.' });
      return;
    }

    const updatedEmployee: StoreEmployee = {
      ...employee,
      nome: nome.trim(),
      matricula: matricula.trim(),
      senha: senha.trim() || employee.senha || '',
      cargo: cargo.trim(),
      setor_restrito: setorRestrito,
      ativo,
      permissoes: {
        setores_permitidos: setorRestrito === 'TODOS' ? [] : [setorRestrito],
        pode_auditar: podeAuditar,
        pode_ajustar_estoque: podeAjustarEstoque,
        pode_importar_planilha: podeImportarPlanilha,
        pode_gerenciar_validade: podeGerenciarValidade,
        pode_acessar_chat: podeAcessarChat,
      },
    };

    const res = await addOrUpdateEmployee(updatedEmployee);
    if (res.success) {
      triggerScanBeep(true);
      setNotice({ type: 'success', text: 'Dados e permissões do usuário atualizados com sucesso!' });
      setIsEditing(false);
    } else {
      setNotice({ type: 'error', text: res.error || 'Erro ao atualizar dados do usuário.' });
    }
  };

  const handleToggleStatus = () => {
    const nextStatus = !ativo;
    setAtivo(nextStatus);
    toggleEmployeeStatus(employee.id, nextStatus);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-lg border border-emerald-500/20">
              {employee.nome ? employee.nome.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">
                  {employee.nome}
                </h3>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  ativo
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                }`}>
                  {ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Matrícula: {employee.matricula} • {employee.cargo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 hover:text-emerald-600 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Editar informações e permissões"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        {notice && (
          <div className={`p-3 text-xs flex items-center justify-between border-b ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {notice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
              <span>{notice.text}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Body Scrollable */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          {/* Card com a Senha de Acesso (com revelação pelo ícone de olho) */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[10px]">
                  Credencial de Acesso (Senha do Usuário)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-slate-750 text-[11px] font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                title={showPassword ? 'Ocultar senha' : 'Exibir senha em texto'}
              >
                {showPassword ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ocultar Senha</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ver Senha</span>
                  </>
                )}
              </button>
            </div>

            {isEditing ? (
              <div className="pt-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1 font-semibold">
                  Alterar Senha do Operador:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="w-full p-2.5 rounded-xl border border-amber-500/40 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 text-[11px]">Senha cadastrada:</span>
                <span className="font-mono text-sm font-black text-slate-900 dark:text-white tracking-widest">
                  {showPassword ? (senha || employee.senha || 'Não cadastrada') : '••••••••'}
                </span>
              </div>
            )}
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isEditing
                ? 'Você pode redefinir a senha do operador caso ele tenha esquecido.'
                : 'Esta senha permite ao operador acessar o sistema SuperPWA OpSys nesta loja.'}
            </p>
          </div>

          {/* Dados do Usuário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                Nome Completo
              </label>
              {isEditing ? (
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                />
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-bold">
                  {employee.nome}
                </div>
              )}
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                Matrícula de Login
              </label>
              {isEditing ? (
                <input
                  type="text"
                  required
                  value={matricula}
                  onChange={e => setMatricula(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold"
                />
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {employee.matricula}
                </div>
              )}
            </div>
          </div>

          {/* Cargo Operacional */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
              Cargo na Loja
            </label>
            {isEditing ? (
              <select
                value={cargo}
                onChange={e => setCargo(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.nome}>{r.nome}</option>
                ))}
                <option value="Operador Geral">Operador Geral</option>
                <option value="Conferente de Auditoria">Conferente de Auditoria</option>
                <option value="Fiscal de Prevenção">Fiscal de Prevenção</option>
                <option value="Gerente de Setor (GS)">Gerente de Setor (GS)</option>
                <option value="Supervisor">Supervisor</option>
              </select>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">{employee.cargo}</span>
                <span className="text-[10px] text-slate-400">Atribuído pelo Gerente</span>
              </div>
            )}
          </div>

          {/* Setor Restrito */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-500" />
                Restrição de Setor Operacional
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {setorRestrito === 'TODOS' ? 'Acesso Global' : `Somente ${setorRestrito}`}
              </span>
            </div>

            {isEditing ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setSetorRestrito('TODOS')}
                  className={`p-2 rounded-xl text-center text-[11px] font-bold border transition cursor-pointer ${
                    setorRestrito === 'TODOS'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Todos os Setores
                </button>
                {SETORES_DISPONIVEIS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSetorRestrito(s)}
                    className={`p-2 rounded-xl text-center text-[11px] font-bold border transition cursor-pointer ${
                      setorRestrito === s
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Somente {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {employee.setor_restrito === 'TODOS' || !employee.setor_restrito
                  ? 'Este funcionário possui autorização para operar em qualquer setor da loja.'
                  : `Este funcionário está restrito e só pode acessar produtos e auditorias do setor "${employee.setor_restrito}".`}
              </p>
            )}
          </div>

          {/* Permissões Granulares */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              Permissões Granulares do Usuário
            </span>

            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                    Auditoria de Presença
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Permite iniciar e bipar produtos em auditorias
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={podeAuditar}
                  onChange={e => setPodeAuditar(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                    Ajuste de Estoque e Reposição
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Permite dar baixas e repor saldos de itens
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={podeAjustarEstoque}
                  onChange={e => setPodeAjustarEstoque(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                    Importação de Planilhas
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Permite importar arquivos Excel e CSV
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={podeImportarPlanilha}
                  onChange={e => setPodeImportarPlanilha(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                    Controle de Validades
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Permite cadastrar lotes e aplicar etiquetas de desconto
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={podeGerenciarValidade}
                  onChange={e => setPodeGerenciarValidade(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                    Chat Operacional da Loja
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Permite enviar mensagens no grupo e canal de líderes
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={podeAcessarChat}
                  onChange={e => setPodeAcessarChat(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 disabled:opacity-50"
                />
              </label>
            </div>
          </div>

          {/* Rodapé / Ações */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleToggleStatus}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                ativo
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 hover:bg-rose-100'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 hover:bg-emerald-100'
              }`}
            >
              <span>{ativo ? 'Desativar Usuário' : 'Reativar Usuário'}</span>
            </button>

            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setNotice(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Alterações</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
