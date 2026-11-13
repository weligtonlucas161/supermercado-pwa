import React, { useState } from 'react';
import { Search, Plus, Calendar, Tag, Check, Filter } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NewValidityModal } from '../modals/NewValidityModal';

export const ValidadeTab: React.FC = () => {
  const { validities, darkMode, applyDiscount, storeColor } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'urgent' | 'warning' | 'ok'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filtered = validities.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batch.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === 'urgent') return matchesSearch && item.status === 'urgent';
    if (filter === 'warning') return matchesSearch && item.status === 'warning';
    if (filter === 'ok') return matchesSearch && item.status === 'ok';
    return matchesSearch;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: storeColor }}
              aria-hidden="true"
            />
            Controle de Validades
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitore lotes críticos para agir preventivamente antes do vencimento.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo Lote</span>
        </button>
      </div>

      {/* Busca e Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por produto ou lote..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-4 py-2.5 rounded-2xl text-xs border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
              darkMode
                ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
            }`}
          />
        </div>
        <div className="relative">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
            className={`px-3 py-2.5 rounded-2xl text-xs border focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <option value="all">Todos os Status ({validities.length})</option>
            <option value="urgent">Urgentes (&lt; 5 dias)</option>
            <option value="warning">Atenção (&lt; 15 dias)</option>
            <option value="ok">Regulares (&gt; 15 dias)</option>
          </select>
        </div>
      </div>

      {/* Lista de Validades */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nenhum lote encontrado</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Tente alterar o filtro ou cadastre um novo lote.</p>
          </div>
        ) : (
          filtered.map(item => (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
              } shadow-xs hover:border-emerald-500/40`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    item.status === 'urgent'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : item.status === 'warning'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.name}</h4>
                    {item.discountApplied && (
                      <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        Remarcado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span className="font-mono">Lote: {item.batch}</span>
                    <span>•</span>
                    <span>Saldo: {item.quantity} un</span>
                  </div>
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-1">
                <div
                  className={`text-xs font-bold ${
                    item.status === 'urgent'
                      ? 'text-rose-600 dark:text-rose-400'
                      : item.status === 'warning'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  Vence: {item.dueDate}
                </div>
                {item.status === 'urgent' && !item.discountApplied ? (
                  <button
                    onClick={() => applyDiscount(item.id, 30)}
                    className="text-[10px] font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 transition"
                  >
                    <Tag className="w-3 h-3" /> Aplicar -30%
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400">
                    {item.status === 'urgent' ? 'Crítico (&lt; 5 dias)' : item.status === 'warning' ? 'Atenção' : 'Regular'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <NewValidityModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
