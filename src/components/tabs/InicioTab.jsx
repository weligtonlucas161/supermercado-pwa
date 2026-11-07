import React from 'react';
import { AlertTriangle, Package, ClipboardCheck, CheckCircle } from 'lucide-react';

export default function InicioTab({ expirations, products, audits, setActiveTab }) {
  const criticalCount = expirations.filter(e => e.status === 'critical').length;
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
  const openAuditsCount = audits.filter(a => a.status === 'Em Andamento').length;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Visão Geral da Loja</h2>
      
      <div className="grid grid-cols-2 gap-3">
        <div 
          onClick={() => setActiveTab('validade')}
          className="bg-red-50 border border-red-200 p-4 rounded-xl cursor-pointer hover:bg-red-100 transition-colors"
        >
          <div className="flex items-center justify-between text-red-600 mb-2">
            <AlertTriangle className="w-6 h-6" />
            <span className="text-2xl font-bold">{criticalCount}</span>
          </div>
          <p className="text-xs font-semibold text-red-800">Vencimento Crítico</p>
          <p className="text-[10px] text-red-600">Próximos 7 dias</p>
        </div>

        <div 
          onClick={() => setActiveTab('estoque')}
          className="bg-amber-50 border border-amber-200 p-4 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <Package className="w-6 h-6" />
            <span className="text-2xl font-bold">{lowStockCount}</span>
          </div>
          <p className="text-xs font-semibold text-amber-800">Estoque Baixo</p>
          <p className="text-[10px] text-amber-600">Abaixo do mínimo</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm">Resumo Operacional</h3>
        <div className="flex items-center justify-between text-sm py-2 border-b border-gray-50">
          <span className="text-gray-600">Auditorias em aberto</span>
          <span className="font-bold text-blue-600">{openAuditsCount}</span>
        </div>
        <div className="flex items-center justify-between text-sm py-2">
          <span className="text-gray-600">Total de itens cadastrados</span>
          <span className="font-bold text-gray-800">{products.length}</span>
        </div>
      </div>
    </div>
  );
}