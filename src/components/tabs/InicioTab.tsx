import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Calendar, 
  ClipboardCheck, 
  Package, 
  Barcode, 
  Plus, 
  ArrowUpRight, 
  Check, 
  Tag, 
  Sparkles,
  Percent
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NewValidityModal } from '../modals/NewValidityModal';
import { NewProductModal } from '../modals/NewProductModal';

export const InicioTab: React.FC = () => {
  const { 
    products, 
    validities, 
    audits, 
    setActiveTab, 
    darkMode, 
    applyDiscount, 
    openScanner,
    operator 
  } = useApp();

  const [isValidityModalOpen, setIsValidityModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [discountSuccessId, setDiscountSuccessId] = useState<string | null>(null);

  const urgentValidities = validities.filter(v => v.status === 'urgent');
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);

  const handleApplyDiscount = (validityId: string) => {
    applyDiscount(validityId, 30);
    setDiscountSuccessId(validityId);
    setTimeout(() => setDiscountSuccessId(null), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner de Boas-Vindas Operacional */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-emerald-600/15 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <span className="text-emerald-100 text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 px-2.5 py-1 rounded-lg backdrop-blur-xs">
            Turno Atual • {operator.shift}
          </span>
          <span className="text-xs text-emerald-100 font-medium">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </span>
        </div>

        <h2 className="text-2xl font-black mt-2 tracking-tight">
          Supermercado Silva
        </h2>
        <p className="text-emerald-100 text-xs sm:text-sm mt-1 max-w-lg">
          {urgentValidities.length > 0
            ? `${urgentValidities.length} lotes com risco de vencimento imediato exigem remarcação ou liquidação.`
            : 'Tudo em dia na operação! Nenhum alerta crítico no momento.'}
        </p>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            onClick={() => setActiveTab('validade')}
            className="bg-white text-emerald-800 px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-50 active:scale-95 transition shadow-sm"
          >
            Ver Validades ({urgentValidities.length})
          </button>
          <button
            onClick={() => setActiveTab('estoque')}
            className="bg-emerald-800/50 text-white border border-emerald-400/30 px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-800/70 active:scale-95 transition"
          >
            Repor Rupturas ({lowStockProducts.length})
          </button>
        </div>
      </div>

      {/* Cards de Métricas Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          onClick={() => setActiveTab('estoque')}
          className={`p-4 rounded-2xl border cursor-pointer hover:border-amber-400/50 transition-all ${
            darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
          } shadow-xs`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold">Em Ruptura</span>
            <div className="p-1 rounded-lg bg-amber-500/10 text-amber-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {lowStockProducts.length}
          </div>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Estoque Baixo</span>
        </div>

        <div
          onClick={() => setActiveTab('validade')}
          className={`p-4 rounded-2xl border cursor-pointer hover:border-rose-400/50 transition-all ${
            darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
          } shadow-xs`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold">Vencem &lt; 5 dias</span>
            <div className="p-1 rounded-lg bg-rose-500/10 text-rose-500">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {urgentValidities.length}
          </div>
          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">Ação Imediata</span>
        </div>

        <div
          onClick={() => setActiveTab('auditoria')}
          className={`p-4 rounded-2xl border cursor-pointer hover:border-emerald-400/50 transition-all ${
            darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
          } shadow-xs`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold">Auditorias</span>
            <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {audits.length}
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {audits.filter(a => a.status === 'Em Andamento').length} Em Andamento
          </span>
        </div>

        <div
          onClick={() => setActiveTab('estoque')}
          className={`p-4 rounded-2xl border cursor-pointer hover:border-blue-400/50 transition-all ${
            darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
          } shadow-xs`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold">Total de Itens</span>
            <div className="p-1 rounded-lg bg-blue-500/10 text-blue-500">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {products.length}
          </div>
          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Cadastrados</span>
        </div>
      </div>

      {/* Ações Rápidas de Terminal */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Ações Rápidas de Campo
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <button
            onClick={() => openScanner()}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left ${
              darkMode
                ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-750'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            } shadow-xs`}
          >
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-white">Bipar Produto</div>
              <div className="text-[10px] text-slate-400">Preço, saldo e gôndola</div>
            </div>
          </button>

          <button
            onClick={() => setIsValidityModalOpen(true)}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left ${
              darkMode
                ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-750'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            } shadow-xs`}
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-white">Lançar Validade</div>
              <div className="text-[10px] text-slate-400">Novo lote recebido</div>
            </div>
          </button>

          <button
            onClick={() => setIsProductModalOpen(true)}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left ${
              darkMode
                ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-750'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            } shadow-xs`}
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-white">Novo Produto</div>
              <div className="text-[10px] text-slate-400">Cadastrar no catálogo</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('auditoria')}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left ${
              darkMode
                ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-750'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            } shadow-xs`}
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-white">Contagem Rápida</div>
              <div className="text-[10px] text-slate-400">Auditar gôndola</div>
            </div>
          </button>
        </div>
      </div>

      {/* Lista de Atenção Urgente (Vencimentos Próximos) */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 ${
          darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
        } shadow-sm`}
      >
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Lotes em Risco de Vencimento
            </h3>
            <p className="text-[11px] text-slate-400">Itens com prazo inferior a 5 dias</p>
          </div>
          <button
            onClick={() => setActiveTab('validade')}
            className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 hover:underline"
          >
            Ver todos <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {urgentValidities.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              Nenhum lote urgente no momento. Excelente controle de validade!
            </div>
          ) : (
            urgentValidities.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                    {item.discountApplied && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500 text-white flex items-center gap-0.5">
                        <Percent className="w-2.5 h-2.5" /> Remarcado
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                    Lote {item.batch} • Vence: <strong>{item.dueDate}</strong> ({item.quantity} un em risco)
                  </p>
                </div>
                <div>
                  {discountSuccessId === item.id || item.discountApplied ? (
                    <span className="text-[10px] font-bold bg-emerald-600 text-white px-2.5 py-1.5 rounded-xl uppercase flex items-center gap-1">
                      <Check className="w-3 h-3" /> Aplicado
                    </span>
                  ) : (
                    <button
                      onClick={() => handleApplyDiscount(item.id)}
                      className="text-[10px] font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white px-2.5 py-1.5 rounded-xl uppercase shadow-xs transition flex items-center gap-1"
                    >
                      <Tag className="w-3 h-3" /> Remarcar (-30%)
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modais */}
      <NewValidityModal isOpen={isValidityModalOpen} onClose={() => setIsValidityModalOpen(false)} />
      <NewProductModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} />
    </div>
  );
};
