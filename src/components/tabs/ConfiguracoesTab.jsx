import React from 'react';
import { RefreshCw, Download, Database } from 'lucide-react';

export default function ConfiguracoesTab({ storeName, setStoreName }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Configurações</h2>

      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
        <h3 className="font-semibold text-sm text-gray-700">Identificação da Loja</h3>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Nome da Filial / Loja</label>
          <input 
            type="text" 
            value={storeName} 
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
        <h3 className="font-semibold text-sm text-gray-700">Dados Locais (Offline)</h3>
        
        <button className="w-full flex items-center justify-between p-2.5 text-xs font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
          <span className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-600" /> Sincronizar Dados Agora
          </span>
          <span className="text-[10px] text-gray-400">Pendente: 0</span>
        </button>

        <button className="w-full flex items-center justify-between p-2.5 text-xs font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4 text-green-600" /> Exportar Relatório (CSV)
          </span>
        </button>
      </div>

      <div className="text-center pt-4">
        <p className="text-xs text-gray-400">SuperPWA v0.1.0 • Build Local</p>
      </div>
    </div>
  );
}