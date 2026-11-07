import React, { useState } from 'react';
import { Calendar, Search, Plus } from 'lucide-react';

export default function ValidadeTab({ validities }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = validities.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.batch.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === 'urgent') return matchesSearch && item.status === 'urgent';
    if (filter === 'warning') return matchesSearch && item.status === 'warning';
    return matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Controle de Validades</h2>
          <p className="text-xs text-slate-500">Monitore itens próximos ao vencimento.</p>
        </div>
        <button className="bg-emerald-600 text-white p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo Lote</span>
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por produto ou lote..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border bg-white border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select 
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs border bg-white border-slate-200 text-slate-800 focus:outline-none"
        >
          <option value="all">Todos os Status</option>
          <option value="urgent">Urgentes (&lt; 5 dias)</option>
          <option value="warning">Atenção (&lt; 15 dias)</option>
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map(item => (
          <div key={item.id} className="p-3.5 rounded-2xl border bg-white border-slate-200 flex items-center justify-between transition-all">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                item.status === 'urgent' ? 'bg-rose-500/10 text-rose-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
              }`}>
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold">{item.name}</h4>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                  <span>Lote: {item.batch}</span>
                  <span>•</span>
                  <span>Qtd: {item.quantity} un</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className={`text-xs font-bold ${
                item.status === 'urgent' ? 'text-rose-500' : item.status === 'warning' ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                Vence: {item.dueDate}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {item.status === 'urgent' ? 'Ação Urgente' : item.status === 'warning' ? 'Monitorar' : 'Regular'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}