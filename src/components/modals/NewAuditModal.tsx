import React, { useState } from 'react';
import { X, ClipboardCheck, Plus, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface NewAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewAuditModal: React.FC<NewAuditModalProps> = ({ isOpen, onClose }) => {
  const { addAudit, operator } = useApp();

  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Mercearia');
  const [itemsCount, setItemsCount] = useState('20');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    addAudit({
      title,
      itemsCount: Number(itemsCount) || 10,
      status: 'Em Andamento',
      auditor: operator.name,
      department,
      discrepanciesCount: 0,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">Iniciar Nova Auditoria</h3>
              <p className="text-[11px] text-slate-400">Contagem de estoque e conferência física</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
              Título da Auditoria
            </label>
            <input
              type="text"
              placeholder="Ex: Auditoria Noturna - Frios e Carnes"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                Setor / Departamento
              </label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Mercearia">Mercearia</option>
                <option value="Laticínios">Laticínios</option>
                <option value="Limpeza">Limpeza</option>
                <option value="Bebidas">Bebidas</option>
                <option value="Hortifrúti">Hortifrúti</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                Estimativa de Itens
              </label>
              <input
                type="number"
                min="1"
                required
                value={itemsCount}
                onChange={e => setItemsCount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-700 dark:text-slate-200 block mb-0.5">Auditor Responsável</span>
            {operator.name} ({operator.code}) • Turno {operator.shift}
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Criar Auditoria
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
