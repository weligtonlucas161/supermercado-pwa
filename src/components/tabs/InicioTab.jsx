import React from 'react';
import { AlertTriangle, Calendar, ClipboardCheck, Package, Barcode, Plus, ArrowUpRight } from 'lucide-react';

export default function InicioTab({ products, validities, audits, setActiveTab }) {
  const urgentValidities = validities.filter(v => v.status === 'urgent');
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-600/15">
        <span className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">Turno Atual - Manhã</span>
        <h2 className="text-2xl font-bold mt-1">Supermercado Silva</h2>
        <p className="text-emerald-100 text-sm mt-1">3 alertas críticos precisam da sua atenção hoje.</p>
        
        <div className="mt-4 flex gap-2">
          <button onClick={() => setActiveTab('validade')} className="bg-white text-emerald-700 px-3.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-emerald-50 transition-colors shadow-sm">
            Ver Validades
          </button>
          <button onClick={() => setActiveTab('estoque')} className="bg-emerald-700/50 text-white border border-emerald-400/30 px-3.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-emerald-700/70 transition-colors">
            Repor Estoque
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Produtos em Alerta</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold">{lowStockProducts.length}</div>
          <span className="text-[11px] text-amber-600 font-medium">Estoque Baixo</span>
        </div>

        <div className="p-4 rounded-2xl border bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Vencem em 3 dias</span>
            <Calendar className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold">{urgentValidities.length}</div>
          <span className="text-[11px] text-rose-600 font-medium">Ação Imediata</span>
        </div>

        <div className="p-4 rounded-2xl border bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Auditorias Hoje</span>
            <ClipboardCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold">{audits.length}</div>
          <span className="text-[11px] text-emerald-600 font-medium">1 Pendente</span>
        </div>

        <div className="p-4 rounded-2xl border bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total de Itens</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold">{products.length}</div>
          <span className="text-[11px] text-blue-600 font-medium">Cadastrados</span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3 text-slate-500 uppercase tracking-wider">Ações Rápidas</h3>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setActiveTab('estoque')} className="p-3.5 rounded-xl border bg-white border-slate-200 hover:bg-slate-50 flex items-center gap-3 transition-all">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600"><Barcode className="w-5 h-5" /></div>
            <div className="text-left">
              <div className="text-xs font-bold">Bipar Produto</div>
              <div className="text-[10px] text-slate-400">Consultar preço</div>
            </div>
          </button>
          <button onClick={() => setActiveTab('validade')} className="p-3.5 rounded-xl border bg-white border-slate-200 hover:bg-slate-50 flex items-center gap-3 transition-all">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600"><Plus className="w-5 h-5" /></div>
            <div className="text-left">
              <div className="text-xs font-bold">Lançar Validade</div>
              <div className="text-[10px] text-slate-400">Novo lote recebido</div>
            </div>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border p-4 bg-white border-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-sm">Vencimentos Próximos (Oferta Urgente)</h3>
          <button onClick={() => setActiveTab('validade')} className="text-xs text-emerald-600 font-semibold flex items-center gap-1 hover:underline">
            Ver todos <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-2">
          {urgentValidities.map(item => (
            <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div>
                <p className="text-xs font-bold text-slate-800">{item.name}</p>
                <p className="text-[11px] text-rose-600">Vence em: {item.dueDate} ({item.quantity} un)</p>
              </div>
              <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-1 rounded-md uppercase">Aplicar Desconto</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}