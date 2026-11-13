import React, { useState, useRef } from 'react';
import {
  Search,
  Plus,
  Barcode,
  Minus,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  Lock,
  ShieldCheck,
  Trash2,
  X,
  AlertCircle,
  RefreshCw,
  PackageX,
  Tag,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { NewProductModal } from '../modals/NewProductModal';
import { ImportSpreadsheetModal } from '../modals/ImportSpreadsheetModal';
import { ProductDetailModal } from '../modals/ProductDetailModal';
import { EstoqueAvariasTab } from './EstoqueAvariasTab';
import { EstoqueRupturasTab } from './EstoqueRupturasTab';

interface ProductCardProps {
  product: Product;
  darkMode: boolean;
  onUpdateStock: (id: string, update: { delta?: number }) => void;
  onToggleRebaixa: (id: string) => void;
  onRequestDelete: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  darkMode,
  onUpdateStock,
  onToggleRebaixa,
  onRequestDelete,
  onSelectProduct,
}) => {
  const [isRedDeleteMode, setIsRedDeleteMode] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const dragOffsetRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const movedRef = useRef(false);

  // Long press detection
  const startLongPress = (clientX: number) => {
    movedRef.current = false;
    startXRef.current = clientX;
    currentXRef.current = clientX;
    dragOffsetRef.current = 0;

    longPressTimerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        setIsRedDeleteMode(true);
      }
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const applySwipeAction = (offset: number) => {
    if (offset >= 65) {
      onToggleRebaixa(product.id);
    } else if (offset <= -65) {
      onRequestDelete(product);
    }
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    startLongPress(touch.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const diff = touch.clientX - startXRef.current;
    currentXRef.current = touch.clientX;

    if (Math.abs(diff) > 10) {
      movedRef.current = true;
      cancelLongPress();
      setIsDragging(true);
      const clamped = Math.max(-130, Math.min(130, diff));
      dragOffsetRef.current = clamped;
      setDragOffset(clamped);
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    setIsDragging(false);
    applySwipeAction(dragOffsetRef.current);
    dragOffsetRef.current = 0;
    setDragOffset(0);
    startXRef.current = 0;
  };

  // Mouse drag handlers (para desktop/mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    startLongPress(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (startXRef.current === 0) return;
    const diff = e.clientX - startXRef.current;
    if (Math.abs(diff) > 10) {
      movedRef.current = true;
      cancelLongPress();
      setIsDragging(true);
      const clamped = Math.max(-130, Math.min(130, diff));
      dragOffsetRef.current = clamped;
      setDragOffset(clamped);
    }
  };

  const handleMouseUp = () => {
    cancelLongPress();
    if (startXRef.current !== 0 && isDragging) {
      applySwipeAction(dragOffsetRef.current);
    }
    setIsDragging(false);
    dragOffsetRef.current = 0;
    setDragOffset(0);
    startXRef.current = 0;
  };

  const handleCardClick = () => {
    if (isRedDeleteMode) {
      onRequestDelete(product);
    }
  };

  const isLow = product.stock <= product.minStock;
  const isRebaixaPending = product.rebaixaStatus === 'pending';
  const isRebaixaConfirmed = product.rebaixaStatus === 'confirmed';

  return (
    <div className="relative overflow-hidden rounded-2xl select-none group">
      {/* Fundo Revelado no Arrastar: Esquerda->Direita (Rebaixa) | Direita->Esquerda (Excluir) */}
      <div
        className={`absolute inset-0 rounded-2xl flex items-center justify-between px-6 font-black text-xs shadow-inner ${
          dragOffset >= 0 ? 'bg-amber-400 text-amber-950' : 'bg-rose-600 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5" />
          <span>{isRebaixaPending ? 'Confirmar Rebaixa' : 'Marcar Rebaixa'}</span>
        </div>
        <div
          onClick={() => onRequestDelete(product)}
          className="flex items-center gap-2 cursor-pointer"
        >
          <span>Remover Produto</span>
          <Trash2 className="w-5 h-5 animate-bounce" />
        </div>
      </div>

      {/* Cartão do Produto (Frente) */}
      {isRedDeleteMode ? (
        // Estado Vermelho com Lixeira no Meio ao Pressionar
        <div
          onClick={handleCardClick}
          className="relative p-5 rounded-2xl bg-rose-600 border-2 border-rose-500 text-white shadow-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all animate-in zoom-in-95 duration-200"
          title="Clique para remover este produto do estoque"
        >
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-2 shadow-inner group-hover:scale-110 transition-transform">
            <Trash2 className="w-6 h-6 text-white" />
          </div>
          <h4 className="font-black text-sm tracking-tight">{product.name}</h4>
          <p className="text-xs text-rose-100 font-semibold mt-0.5">
            Clique para confirmar a exclusão deste produto
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsRedDeleteMode(false);
              }}
              className="px-3 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold transition flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRequestDelete(product);
              }}
              className="px-3.5 py-1 rounded-xl bg-white text-rose-700 hover:bg-rose-50 text-[11px] font-black transition shadow-sm flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir Agora
            </button>
          </div>
        </div>
      ) : (
        // Estado Normal com Suporte a Arrasto / Pressionar
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            transform: `translateX(${dragOffset}px)`,
            transition: isDragging ? 'none' : 'transform 0.25s ease-out',
          }}
          onClick={() => {
            if (!movedRef.current && Math.abs(dragOffset) < 5) {
              onSelectProduct(product);
            }
          }}
          className={`relative p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors cursor-pointer ${
            isRebaixaPending
              ? 'animate-rebaixa-blink border-amber-400'
              : isRebaixaConfirmed
              ? 'bg-amber-50/70 border-amber-300'
              : darkMode
              ? 'bg-slate-800/90 border-slate-700'
              : 'bg-white border-slate-200'
          } shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all active:scale-[0.99]`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">{product.name}</h4>
              {isRebaixaPending && (
                <span className="bg-amber-400 text-amber-950 text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wide border border-amber-500 flex items-center gap-1 animate-pulse">
                  <Tag className="w-3 h-3" /> rebaixa
                </span>
              )}
              {isRebaixaConfirmed && (
                <span className="bg-amber-500/15 text-amber-800 text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wide border border-amber-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-amber-600" /> rebaixa confirmada
                </span>
              )}
              {product.isLockedForEdit && (
                <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-md font-bold border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-500" /> Em edição ({product.lockedBy || 'outro operador'})
                </span>
              )}
              {isLow && (
                <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-md font-bold border border-amber-500/20 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" /> Ruptura Iminente
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span>EAN: {product.ean}</span>
              {product.secondaryEan && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  2º EAN: {product.secondaryEan}
                </span>
              )}
              {product.reducedCode && <span>• Reduzido: {product.reducedCode}</span>}
              {product.supplierCode && <span>• Forn: {product.supplierCode}</span>}
              <span>• <span className="font-sans text-slate-500 dark:text-slate-400 font-medium">{product.location}</span></span>
            </div>
            <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
              R$ {product.price.toFixed(2)}
            </p>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-700/60">
            <div className="text-left sm:text-right">
              <div className={`text-base font-black ${isLow ? 'text-amber-500' : 'text-slate-800 dark:text-slate-100'}`}>
                {product.stock} <span className="text-[10px] font-normal text-slate-400">un</span>
              </div>
              <div className="text-[10px] text-slate-400">Mínimo: {product.minStock} un</div>
            </div>

            {/* Botões Rápidos de Reposição (+ / -) */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-750 p-1 rounded-xl">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateStock(product.id, { delta: -1 });
                }}
                className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-600 transition shadow-xs"
                title="Dar baixa em 1 unidade"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateStock(product.id, { delta: 1 });
                }}
                className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-600 transition shadow-xs"
                title="Repor 1 unidade"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Botão de Excluir Direto */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestDelete(product);
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
              title="Pressione ou arraste para excluir, ou clique aqui"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const EstoqueTab: React.FC = () => {
  const {
    products,
    updateProductStock,
    toggleProductRebaixa,
    removeProduct,
    darkMode,
    storeColor,
    openScanner,
    refreshProductsFromDatabase,
    isSyncingWithDatabase,
    lastDatabaseSyncTime,
    avarias
  } = useApp();
  type SortOption = 'default' | 'qtd-desc' | 'qtd-asc' | 'name-asc' | 'name-desc' | 'forn-asc';
  type MainTab = 'estoque' | 'avarias' | 'rupturas';

  // =========================================================================
  // INTERFACES DO ESTOQUE: Estoque | Avarias | Rupturas
  // =========================================================================
  const [mainTab, setMainTab] = useState<MainTab>('estoque');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);

  // Modal de Detalhes e Edição Concorrente de Produto
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);

  // Modal de Confirmação de Remoção de Produto
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // 1. Produtos em Ruptura Iminente (Estoque <= Mínimo ou Zerado)
  const ruptureProducts = products.filter(p => p.stock <= p.minStock || p.stock === 0);

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];

  // Base filtrada pela busca e categoria
  const filtered = products
    .filter(p => {
      const term = searchTerm.toLowerCase().trim();
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      if (!term) return matchesCategory;

      const matchesSearch =
        p.name.toLowerCase().includes(term) ||
        p.ean.includes(term) ||
        (p.secondaryEan ? p.secondaryEan.includes(term) : false) ||
        (p.reducedCode ? p.reducedCode.toLowerCase().includes(term) : false) ||
        (p.supplierCode ? p.supplierCode.toLowerCase().includes(term) : false) ||
        (p.location ? p.location.toLowerCase().includes(term) : false);

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'qtd-desc') return b.stock - a.stock;
      if (sortBy === 'qtd-asc') return a.stock - b.stock;
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name, 'pt-BR');
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name, 'pt-BR');
      if (sortBy === 'forn-asc') return (a.supplierCode || '').localeCompare(b.supplierCode || '', 'pt-BR');
      return 0;
    });

  const handleScanForSearch = () => {
    openScanner((scannedEan) => {
      setSearchTerm(scannedEan);
    });
  };

  const handleConfirmDelete = () => {
    if (productToDelete) {
      removeProduct(productToDelete.id);
      setProductToDelete(null);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: storeColor }}
              aria-hidden="true"
            />
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {mainTab === 'estoque' && 'Consulta de Estoque'}
              {mainTab === 'avarias' && 'Avarias do Estoque'}
              {mainTab === 'rupturas' && 'Controle de Rupturas'}
            </h2>
            {lastDatabaseSyncTime && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title={`Sincronizado com Supabase às ${lastDatabaseSyncTime}`}>
                🟢 Nuvem {lastDatabaseSyncTime}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {mainTab === 'estoque' &&
              `Localização em gôndola, saldos e consulta de código EAN-13 (${products.length} itens cadastrados).`}
            {mainTab === 'avarias' &&
              'Perdas, quebras e trocas registradas no estoque para reduzir o desperdício.'}
            {mainTab === 'rupturas' &&
              'Produtos zerados ou no limite de segurança que precisam de reposição imediata.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => refreshProductsFromDatabase()}
            disabled={isSyncingWithDatabase}
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            title="Atualizar produtos do banco de dados na nuvem"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-500 ${isSyncingWithDatabase ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncingWithDatabase ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
          {mainTab === 'estoque' && (
            <>
              <button
                onClick={() => setIsSpreadsheetModalOpen(true)}
                className="border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                title="Importar planilha Excel ou CSV"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Importar Planilha</span>
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Produto</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* =====================================================================
          SWITCHER DAS INTERFACES DO ESTOQUE
          Estoque (verde) | Avarias (vermelho) | Rupturas (laranja)
      ===================================================================== */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setMainTab('estoque')}
          className={`px-3 py-3 rounded-2xl text-left transition-all cursor-pointer border ${
            mainTab === 'estoque'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-500/30'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
          }`}
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 shrink-0" />
            <span className="text-xs font-black truncate">Estoque</span>
          </div>
          <div
            className={`text-[10px] font-bold mt-0.5 ${
              mainTab === 'estoque' ? 'text-emerald-100' : 'text-slate-400'
            }`}
          >
            {products.length} {products.length === 1 ? 'item' : 'itens'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('avarias')}
          className={`px-3 py-3 rounded-2xl text-left transition-all cursor-pointer border ${
            mainTab === 'avarias'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25 ring-2 ring-rose-500/30'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
          }`}
        >
          <div className="flex items-center gap-2">
            <PackageX className="w-4 h-4 shrink-0" />
            <span className="text-xs font-black truncate">Avarias</span>
          </div>
          <div
            className={`text-[10px] font-bold mt-0.5 ${
              mainTab === 'avarias' ? 'text-rose-100' : 'text-slate-400'
            }`}
          >
            {avarias.length} {avarias.length === 1 ? 'registro' : 'registros'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('rupturas')}
          className={`px-3 py-3 rounded-2xl text-left transition-all cursor-pointer border ${
            mainTab === 'rupturas'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-400/40'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-xs font-black truncate">Rupturas</span>
          </div>
          <div
            className={`text-[10px] font-bold mt-0.5 ${
              mainTab === 'rupturas' ? 'text-orange-100' : 'text-slate-400'
            }`}
          >
            {ruptureProducts.length} {ruptureProducts.length === 1 ? 'crítico' : 'críticos'}
          </div>
        </button>
      </div>

      {mainTab === 'estoque' && (
        <>
      {/* Dica de Uso de Gestos */}
      <div className="px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>💡 Gestos: <strong>arraste para a direita</strong> para marcar/confirmar rebaixa, ou <strong>arraste para a esquerda</strong> (ou pressione) para remover.</span>
      </div>

      {/* Busca, Filtro de Ordenação e Scanner Trigger */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, EAN, cód. reduzido ou fornecedor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-4 py-2.5 rounded-2xl text-xs border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
              darkMode
                ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Seletor de Ordenação */}
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className={`w-full sm:w-auto px-3.5 py-2.5 rounded-2xl text-xs font-bold border transition focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <option value="default">Padrão (Recentes)</option>
              <option value="qtd-desc">Maior Quantidade → Menor</option>
              <option value="qtd-asc">Menor Quantidade → Maior</option>
              <option value="name-asc">Nome (A-Z)</option>
              <option value="name-desc">Nome (Z-A)</option>
              <option value="forn-asc">Código de Fornecedor</option>
            </select>
          </div>

          <button
            onClick={handleScanForSearch}
            className={`p-2.5 rounded-2xl border transition flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Bipar código de barras com Barcode Detector API"
          >
            <Barcode className="w-5 h-5 text-emerald-500" />
            <span className="hidden sm:inline">Bipar</span>
          </button>
        </div>
      </div>

          {/* Categorias (Filtro Horizontal) */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : darkMode
                    ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat === 'all' ? 'Todas Categorias' : cat}
              </button>
            ))}
          </div>

          {/* Cards de Produtos com Suporte a Press/Long-Press e Swipe */}
          <div className="space-y-2.5">
            {filtered.length === 0 ? (
              <div className="text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nenhum produto cadastrado</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Use o botão "Importar Planilha" ou "Cadastrar Produto" para começar seus testes.</p>
              </div>
            ) : (
              filtered.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  darkMode={darkMode}
                  onUpdateStock={updateProductStock}
                  onToggleRebaixa={toggleProductRebaixa}
                  onRequestDelete={(p) => setProductToDelete(p)}
                  onSelectProduct={(p) => setSelectedProductForDetail(p)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* INTERFACE DE AVARIAS (VERMELHO) */}
      {mainTab === 'avarias' && <EstoqueAvariasTab />}

      {/* INTERFACE DE RUPTURAS (LARANJA) */}
      {mainTab === 'rupturas' && <EstoqueRupturasTab />}

      {/* Modal de Confirmação de Exclusão de Produto */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Remover Produto do Estoque?
                </h3>
                <p className="text-xs text-slate-400">Esta ação é irreversível.</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
              <p className="font-black text-slate-800 dark:text-slate-100">{productToDelete.name}</p>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                <span>EAN: {productToDelete.ean}</span>
                <span>• Saldo: {productToDelete.stock} un</span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Setor: {productToDelete.category}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Remover Produto</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <NewProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <ImportSpreadsheetModal isOpen={isSpreadsheetModalOpen} onClose={() => setIsSpreadsheetModalOpen(false)} />
      <ProductDetailModal
        isOpen={Boolean(selectedProductForDetail)}
        product={selectedProductForDetail}
        onClose={() => setSelectedProductForDetail(null)}
      />
    </div>
  );
};

