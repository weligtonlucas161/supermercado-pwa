import React from 'react';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

export default function ValidadeTab({ expirations }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Controle de Validade</h2>
        <button className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium">
          + Novo Lote
        </button>
      </div>

      <div className="space-y-2">
        {expirations.map((item) => (
          <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
            <div className="space-y-1">
              <p className="font-semibold text-sm text-gray-800">{item.name}</p>
              <div className="flex gap-2 text-xs text-gray-500">
                <span>Lote: {item.lot}</span>
                <span>•</span>
                <span>Qtd: {item.quantity} un</span>
              </div>
              <p className="text-xs font-medium text-gray-700">Vence: {item.date}</p>
            </div>
            
            {item.status === 'critical' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                <AlertCircle className="w-3.5 h-3.5" /> Crítico
              </span>
            )}
            {item.status === 'warning' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                <Clock className="w-3.5 h-3.5" /> Atenção
              </span>
            )}
            {item.status === 'ok' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                <CheckCircle2 className="w-3.5 h-3.5" /> Normal
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}