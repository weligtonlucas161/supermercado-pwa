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
  Percent,
  FileSpreadsheet,
  Clock,
  Layers,
  ChevronRight,
  TrendingDown,
  ShieldAlert,
  ArrowRight,
  MessageSquare
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NewValidityModal } from '../modals/NewValidityModal';
import { NewProductModal } from '../modals/NewProductModal';
import { ImportSpreadsheetModal } from '../modals/ImportSpreadsheetModal';
import { RuptureHistoryChart } from '../dashboard/RuptureHistoryChart';

/**
 * Componente Dashboard com cards de resumo focados na operação de piso de loja:
 * - Validades Vencendo Hoje
 * - Itens com Ruptura
 * - Tarefas Pendentes de Auditoria
 */
export const Dashboard: React.FC = () => {
  const { 
    products, 
    validities, 
    audits, 
    setActiveTab, 
    applyDiscount, 
    darkMode 
  } = useApp();

  // Obter data de hoje em formato YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Validades Vencendo Hoje (ou com prazo imediato de hoje)
  const expiringToday = validities.filter(v => v.dueDate <= todayStr || v.status === 'urgent');
  const exactTodayCount = validities.filter(v => v.dueDate === todayStr).length;

  // 2. Itens com Ruptura (estoque zerado ou abaixo do mínimo de segurança)
  const ruptureItems = products.filter(p => p.stock <= p.minStock);
  const zeroStockItems = products.filter(p => p.stock === 0);

  // 3. Tarefas Pendentes de Auditoria
  const pendingAudits = audits.filter(a => a.status === 'Em Andamento' || a.status === 'Pendente');

  return (
    <div className="space-y-4">
      {/* Seção de Cabeçalho do Dashboard */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            Painel de Controle Operacional
          </h3>
          <p className="text-[11px] text-slate-400">
            Monitoramento em tempo real de riscos e pendências de piso de loja
          </p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Atualizado Agora
        </span>
      </div>

      {/* 3 CARDS PRINCIPAIS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        
        {/* CARD 1: Validades Vencendo Hoje */}
        <div
          className={`p-4 rounded-3xl border transition-all ${
            darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
          } shadow-sm hover:border-rose-400/60 flex flex-col justify-between relative overflow-hidden`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                Ação Imediata
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {expiringToday.length}
                </span>
                <span className="text-xs text-slate-400 font-medium">lotes em risco</span>
              </div>
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 mt-0.5">
                Validades Vencendo Hoje
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {exactTodayCount > 0 
                  ? `${exactTodayCount} vencem na data de hoje; outros estão a menos de 5 dias.` 
                  : 'Lotes urgentes aguardando remarcação para evitar perda.'}
              </p>
            </div>

            {/* Amostra rápida dos itens em risco */}
            <div className="space-y-1.5 pt-1">
              {expiringToday.slice(0, 2).map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-rose-500/10 border border-rose-500/20"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                    {item.name}
                  </span>
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                    {item.quantity} un ({item.dueDate})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('validade')}
            className="mt-4 w-full py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <span>Gerenciar Validades</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* CARD 2: Itens com Ruptura */}
        <div
          className={`p-4 rounded-3xl border transition-all ${
            darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
          } shadow-sm hover:border-amber-400/60 flex flex-col justify-between relative overflow-hidden`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {zeroStockItems.length > 0 ? `${zeroStockItems.length} Zerados` : 'Estoque Baixo'}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {ruptureItems.length}
                </span>
                <span className="text-xs text-slate-400 font-medium">produtos</span>
              </div>
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 mt-0.5">
                Itens com Ruptura
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Produtos abaixo do estoque mínimo de segurança com risco de gôndola vazia.
              </p>
            </div>

            {/* Amostra rápida dos itens em ruptura */}
            <div className="space-y-1.5 pt-1">
              {ruptureItems.slice(0, 2).map(prod => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-amber-500/10 border border-amber-500/20"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                    {prod.name}
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {prod.stock}/{prod.minStock} un
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('estoque')}
            className="mt-4 w-full py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <span>Repor Gôndolas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* CARD 3: Tarefas Pendentes de Auditoria */}
        <div
          className={`p-4 rounded-3xl border transition-all ${
            darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
          } shadow-sm hover:border-emerald-400/60 flex flex-col justify-between relative overflow-hidden`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Piso de Loja
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {pendingAudits.length}
                </span>
                <span className="text-xs text-slate-400 font-medium">sessões ativas</span>
              </div>
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 mt-0.5">
                Tarefas Pendentes de Auditoria
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Contagens físicas programadas para verificação de divergências de estoque.
              </p>
            </div>

            {/* Amostra rápida das auditorias pendentes */}
            <div className="space-y-1.5 pt-1">
              {pendingAudits.length > 0 ? (
                pendingAudits.slice(0, 2).map(audit => (
                  <div
                    key={audit.id}
                    className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                      {audit.title}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {audit.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  Todas auditorias em dia
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('auditoria')}
            className="mt-4 w-full py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <span>Executar Auditoria</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};

export const InicioTab: React.FC = () => {
  const { 
    products, 
    validities, 
    audits, 
    setActiveTab, 
    darkMode, 
    applyDiscount, 
    openScanner,
    operator,
    openChat,
    unreadChatCount 
  } = useApp();

  const [isValidityModalOpen, setIsValidityModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);
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
          <button
            onClick={() => setIsSpreadsheetModalOpen(true)}
            className="bg-emerald-500/30 text-white border border-white/20 px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-500/50 active:scale-95 transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Importar Planilha
          </button>
        </div>
      </div>

      {/* DASHBOARD PRINCIPAL COM CARDS DEDICADOS */}
      <Dashboard />

      {/* GRÁFICO RECHARTS: HISTÓRICO DE RUPTURAS NOS ÚLTIMOS 7 DIAS */}
      <RuptureHistoryChart />

      {/* Ações Rápidas de Terminal */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Ações Rápidas de Campo & Comunicação
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          <button
            onClick={() => openScanner()}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left cursor-pointer ${
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
              <div className="text-[10px] text-slate-400">Google Barcode</div>
            </div>
          </button>

          <button
            onClick={() => openChat()}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left relative cursor-pointer ${
              darkMode
                ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-750'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            } shadow-xs`}
          >
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 relative">
              <MessageSquare className="w-5 h-5" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <span>Chat Loja</span>
                {unreadChatCount > 0 && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-rose-500 text-white">
                    {unreadChatCount}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">Grupo & Líderes</div>
            </div>
          </button>

          <button
            onClick={() => setIsSpreadsheetModalOpen(true)}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left cursor-pointer ${
              darkMode
                ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-750'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            } shadow-xs`}
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-white">Subir Planilha</div>
              <div className="text-[10px] text-slate-400">Importação XLSX</div>
            </div>
          </button>

          <button
            onClick={() => setIsValidityModalOpen(true)}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left cursor-pointer ${
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
              <div className="text-[10px] text-slate-400">Novo lote</div>
            </div>
          </button>

          <button
            onClick={() => setIsProductModalOpen(true)}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left cursor-pointer ${
              darkMode
                ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-750'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            } shadow-xs`}
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-white">Novo Produto</div>
              <div className="text-[10px] text-slate-400">Catálogo manual</div>
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
              Lotes em Risco Imediato de Vencimento
            </h3>
            <p className="text-[11px] text-slate-400">Itens com vencimento hoje ou inferior a 5 dias</p>
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
      <ImportSpreadsheetModal isOpen={isSpreadsheetModalOpen} onClose={() => setIsSpreadsheetModalOpen(false)} />
    </div>
  );
};
