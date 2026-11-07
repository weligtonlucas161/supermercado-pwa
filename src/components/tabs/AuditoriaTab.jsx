import React from 'react';
import { Plus, CheckCircle } from 'lucide-react';

export default function AuditoriaTab({ audits }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Auditoria de Prateleira</h2>
        <button className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
          <Plus className="w-4 h-4" /> Nova Auditoria
        </button>
      </div>

      <div className="space-y-2">
        {audits.map((audit) => (
          <div key={audit.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800 text-sm">{audit.sector}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                audit.status === 'Concluída' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {audit.status}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center pt-2 text-xs border-t border-gray-50">
              <div>
                <p className="text-gray-400 text-[10px]">Data</p>
                <p className="font-medium text-gray-700">{audit.date}</p>
              </div>
              <div>
                <p className="text-gray-400 text-[10px]">Auditados</p>
                <p className="font-medium text-gray-700">{audit.itemsAudited} itens</p>
              </div>
              <div>
                <p className="text-gray-400 text-[10px]">Divergências</p>
                <p className={`font-bold ${audit.discrepancies > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {audit.discrepancies}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}