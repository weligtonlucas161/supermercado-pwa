import React from 'react';
import { ClipboardCheck, Plus } from 'lucide-react';

export default function AuditoriaTab({ audits }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Auditoria de Loja</h2>
          <p className="text-xs text-slate-500">Conferência física de estoque.</p>
        </div>
        <button className="bg-emerald-600 text-white p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nova Auditoria</span>
        </button>
      </div>

      <div className="p-4 rounded-2xl border border-dashed bg-slate-100/70 border-slate-300 text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5" />
        </div>
        <h3 className="text-xs font-bold">Pronto para iniciar uma contagem?</h3>
        <p className="text-[11px] text-slate-400 max-w-xs mx-auto">Escaneie os corredores e compare o estoque físico.</p>
        <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm hover:bg-emerald-700 transition-colors">
          Abrir Coletor de Dados
        </button>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Auditorias Recentes</h3>
        <div className="space-y-2">
          {audits.map(audit => (
            <div key={audit.id} className="p-3.5 rounded-2xl border bg-white border-slate-200 flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-xs font-bold">{audit.title}</h4>
                <p className="text-[11px] text-slate-400">Data: {audit.date} • Auditor: {audit.auditor}</p>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  audit.status === 'Concluída' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                }`}>
                  {audit.status}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">{audit.itemsCount} itens</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}