import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Barcode,
  Check,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  Package,
  Percent,
  Plus,
  Tag,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NewValidityModal } from '../modals/NewValidityModal';
import { NewProductModal } from '../modals/NewProductModal';
import { ImportSpreadsheetModal } from '../modals/ImportSpreadsheetModal';
import { RuptureHistoryChart } from '../dashboard/RuptureHistoryChart';
import {
  CriticalProductsCarousel,
  type CriticalProductItem,
} from '../dashboard/CriticalProductsCarousel';

/** Data local (YYYY-MM-DD) sem o deslocamento de fuso do toISOString. */
const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ROLE_LABELS: Record<string, string> = {
  saas_admin: 'Administrador SaaS',
  gerente: 'Gerente',
  adm: 'Administrador',
  master: 'Master',
  operador: 'Operador',
};

/**
 * Componente Dashboard com cards de resumo focados na operação de piso de loja:
 * - Validades Vencendo Hoje
 * - Itens com Ruptura
 * - Tarefas Pendentes de Auditoria
 */
export const Dashboard: React.FC = () => {
  const { products, validities, audits, setActiveTab, darkMode, storeColor } = useApp();

  // Obter data de hoje em formato YYYY-MM-DD (fuso local)
  const todayStr = getLocalDateString();

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
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: storeColor }}
              aria-hidden="true"
            />
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
            darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-200'
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
            darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-200'
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
            darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-200'
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
    setActiveTab, 
    darkMode, 
    applyDiscount, 
    openScanner,
    operator,
    currentUser,
    isGerente,
    storeName,
    storeColor,
  } = useApp();

  const [isValidityModalOpen, setIsValidityModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);
  const [discountSuccessId, setDiscountSuccessId] = useState<string | null>(null);

  const todayStr = useMemo(() => getLocalDateString(), []);

  // Contexto do usuário: setor, cargo e escopo de visualização
  const userSector = (operator.setor_restrito || currentUser?.setor || '').trim().toUpperCase();
  const hasSectorRestriction = Boolean(userSector && userSector !== 'TODOS');
  const isManagerView =
    isGerente ||
    ['gerente', 'adm', 'master'].includes((currentUser?.cargo || operator.role || '').toLowerCase());
  const scopeToSector = hasSectorRestriction && !isManagerView;

  const matchesSector = (sector?: string) =>
    !scopeToSector || (sector || '').trim().toUpperCase() === userSector;

  // Rupturas e vencidos do escopo do usuário (setor próprio ou loja inteira)
  const { ruptureItems, expiredItems } = useMemo(() => {
    const productById = new Map(products.map(p => [p.id, p]));

    const ruptures: CriticalProductItem[] = products
      .filter(p => p.stock <= p.minStock && matchesSector(p.category))
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, 'pt-BR'))
      .map(p => ({
        key: `ruptura-${p.id}`,
        kind: 'ruptura' as const,
        name: p.name,
        sector: p.category,
        code: p.reducedCode || p.ean,
        stock: p.stock,
        minStock: p.minStock,
      }));

    const coveredProductIds = new Set<string>();

    const expiredFromLots: CriticalProductItem[] = validities
      .filter(v => v.dueDate && v.dueDate <= todayStr)
      .map(v => {
        const product = productById.get(v.productId);
        return { validity: v, sector: product?.category, code: product?.reducedCode || product?.ean };
      })
      .filter(({ sector }) => matchesSector(sector))
      .map(({ validity, sector, code }) => {
        coveredProductIds.add(validity.productId);
        return {
          key: `vencido-lote-${validity.id}`,
          kind: 'vencido' as const,
          name: validity.name,
          sector,
          code,
          quantity: validity.quantity,
          dueDate: validity.dueDate,
          batch: validity.batch,
        };
      });

    const expiredFromProducts: CriticalProductItem[] = products
      .filter(p => p.data_vencimento && p.data_vencimento.slice(0, 10) <= todayStr)
      .filter(p => matchesSector(p.category) && !coveredProductIds.has(p.id))
      .map(p => ({
        key: `vencido-produto-${p.id}`,
        kind: 'vencido' as const,
        name: p.name,
        sector: p.category,
        code: p.reducedCode || p.ean,
        quantity: p.stock,
        dueDate: p.data_vencimento?.slice(0, 10),
        batch: p.batch,
      }));

    const expired = [...expiredFromLots, ...expiredFromProducts].sort((a, b) =>
      (a.dueDate || '').localeCompare(b.dueDate || '')
    );

    return { ruptureItems: ruptures, expiredItems: expired };
  }, [products, validities, todayStr, scopeToSector, userSector]);

  const combinedItems = useMemo(
    () => [...ruptureItems, ...expiredItems],
    [ruptureItems, expiredItems]
  );

  // Lotes urgentes (vencimento em até 5 dias) do escopo do usuário
  const urgentValidities = useMemo(() => {
    const productById = new Map(products.map(p => [p.id, p]));
    return validities.filter(v => {
      if (v.status !== 'urgent') return false;
      if (!scopeToSector) return true;
      const sector = productById.get(v.productId)?.category;
      return (sector || '').trim().toUpperCase() === userSector;
    });
  }, [validities, products, scopeToSector, userSector]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const userName = (currentUser?.nome || operator.name || 'Operador').trim();
  const roleLabel =
    operator.cargoCompleto ||
    ROLE_LABELS[(currentUser?.cargo || operator.role || 'operador').toLowerCase()] ||
    'Operador';
  const scopeLabel = scopeToSector ? `Setor ${userSector}` : 'Visão geral da loja';

  const alertParts: string[] = [];
  if (expiredItems.length > 0) {
    alertParts.push(
      `${expiredItems.length} ${expiredItems.length === 1 ? 'produto vencido' : 'produtos vencidos'}`
    );
  }
  if (ruptureItems.length > 0) {
    alertParts.push(
      `${ruptureItems.length} ${ruptureItems.length === 1 ? 'item em ruptura' : 'itens em ruptura'}`
    );
  }
  const alertSummary =
    alertParts.length > 0
      ? `${alertParts.join(' e ')} exigem ação imediata.`
      : 'Tudo em dia na operação! Nenhum alerta crítico no momento.';

  const handleApplyDiscount = (validityId: string) => {
    applyDiscount(validityId, 30);
    setDiscountSuccessId(validityId);
    setTimeout(() => setDiscountSuccessId(null), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner de Boas-Vindas Operacional com saudação personalizada */}
      <div
        className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 text-slate-900 shadow-sm relative overflow-hidden"
        style={{
          borderColor: `${storeColor}35`,
          backgroundImage: `linear-gradient(135deg, ${storeColor}12 0%, rgba(255,255,255,0.95) 60%, ${storeColor}0a 100%)`,
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ backgroundColor: storeColor, opacity: 0.85 }}
          aria-hidden="true"
        />
        <div
          className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 rounded-full blur-2xl pointer-events-none"
          style={{ backgroundColor: `${storeColor}22` }}
          aria-hidden="true"
        />

        <div className="flex items-center justify-between gap-2 pt-1">
          <span
            className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border"
            style={{
              backgroundColor: `${storeColor}14`,
              borderColor: `${storeColor}30`,
              color: storeColor,
            }}
          >
            Turno Atual • {operator.shift || 'Operação'}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight text-slate-900 break-words">
          {greeting}, {userName}!
        </h2>
        <p className="text-slate-500 text-xs sm:text-sm mt-1.5">
          {roleLabel} • {scopeLabel} • {storeName}
        </p>

        <div
          className={`mt-3 flex items-start gap-2 text-xs rounded-2xl px-3 py-2 border ${
            alertParts.length > 0
              ? 'bg-rose-500/5 border-rose-500/20 text-rose-700'
              : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700'
          }`}
        >
          {alertParts.length > 0 ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="font-semibold leading-relaxed">{alertSummary}</span>
        </div>
      </div>

      {/* Ações Rápidas de Campo (atalhos essenciais) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Ações Rápidas
          </h3>
          <span className="text-[10px] text-slate-400">Toque para abrir</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => openScanner()}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left cursor-pointer ${
              darkMode
                ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-750'
                : 'bg-white dark:bg-slate-900 border-slate-200 hover:bg-slate-50'
            } shadow-xs`}
          >
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-white">Bipar Produto</div>
              <div className="text-[10px] text-slate-400">Câmera / EAN</div>
            </div>
          </button>

          <button
            onClick={() => setIsValidityModalOpen(true)}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left cursor-pointer ${
              darkMode
                ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-750'
                : 'bg-white dark:bg-slate-900 border-slate-200 hover:bg-slate-50'
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
                : 'bg-white dark:bg-slate-900 border-slate-200 hover:bg-slate-50'
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

          <button
            onClick={() => setIsSpreadsheetModalOpen(true)}
            className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left cursor-pointer ${
              darkMode
                ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-750'
                : 'bg-white dark:bg-slate-900 border-slate-200 hover:bg-slate-50'
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
        </div>
      </div>

      {/* PAINEL DE RESUMO OPERACIONAL */}
      <Dashboard />

      {/* CARROSSÉIS DE PRODUTOS CRÍTICOS (ACIMA DO GRÁFICO) */}
      {isManagerView ? (
        <div className="space-y-4">
          <CriticalProductsCarousel
            title="Produtos em Ruptura"
            subtitle="Gôndolas vazias ou abaixo do estoque mínimo de segurança"
            items={ruptureItems}
            onSeeAll={() => setActiveTab('estoque')}
            onItemClick={() => setActiveTab('estoque')}
            emptyMessage="Nenhum produto em ruptura no momento."
          />
          <CriticalProductsCarousel
            title="Produtos Vencidos"
            subtitle="Lotes com validade expirada que exigem baixa ou remarcação"
            items={expiredItems}
            onSeeAll={() => setActiveTab('validade')}
            onItemClick={() => setActiveTab('validade')}
            emptyMessage="Nenhum produto vencido no momento."
          />
        </div>
      ) : (
        <CriticalProductsCarousel
          title={scopeToSector ? `Rupturas e Vencidos — ${userSector}` : 'Rupturas e Vencidos'}
          subtitle="Itens críticos que exigem ação imediata no piso de loja"
          items={combinedItems}
          showKindBadge
          onSeeAll={() => setActiveTab(expiredItems.length > 0 ? 'validade' : 'estoque')}
          onItemClick={item => setActiveTab(item.kind === 'vencido' ? 'validade' : 'estoque')}
          emptyMessage={
            scopeToSector
              ? 'Nenhum produto em ruptura ou vencido no seu setor.'
              : 'Nenhum produto em ruptura ou vencido no momento.'
          }
        />
      )}

      {/* GRÁFICO RECHARTS: HISTÓRICO DE RUPTURAS NOS ÚLTIMOS 7 DIAS */}
      <RuptureHistoryChart />

      {/* Lista de Atenção Urgente (Vencimentos Próximos) */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 ${
          darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-200'
        } shadow-sm`}
      >
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Lotes em Risco Imediato de Vencimento
            </h3>
            <p className="text-[11px] text-slate-400">
              {scopeToSector
                ? `Itens do setor ${userSector} com vencimento hoje ou inferior a 5 dias`
                : 'Itens com vencimento hoje ou inferior a 5 dias'}
            </p>
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
