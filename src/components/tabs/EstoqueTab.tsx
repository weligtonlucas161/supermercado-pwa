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
  RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { NewProductModal } from '../modals/NewProductModal';
import { ImportSpreadsheetModal } from '../modals/ImportSpreadsheetModal';
import { ImportadorPlanilhaZeroKnowledge } from '../inventory/ImportadorPlanilhaZeroKnowledge';

interface ProductCardProps {
  product: Product;
  darkMode: boolean;
  onUpdateStock: (id: string, update: { delta?: number }) => void;
  onRequestDelete: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  darkMode,
  onUpdateStock,
  onRequestDelete,
}) => {
  const [isRedDeleteMode, setIsRedDeleteMode] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const movedRef = useRef(false);

  // Long press detection
  const startLongPress = (clientX: number) => {
    movedRef.current = false;
    startXRef.current = clientX;
    currentXRef.current = clientX;

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
      // Limita o arrasto entre -120px e 120px
      const clamped = Math.max(-130, Math.min(130, diff));
      setDragOffset(clamped);
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    setIsDragging(false);

    // Se arrastou para o lado mais de 65px, ativa a solicitação de remoção
    if (Math.abs(dragOffset) >= 65) {
      onRequestDelete(product);
    }
    setDragOffset(0);
  };

  // Mouse drag handlers (para desktop/mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Não ativa se clicou diretamente nos botões + / -
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
      setDragOffset(clamped);
    }
  };

  const handleMouseUp = () => {
    cancelLongPress();
    if (isDragging && Math.abs(dragOffset) >= 65) {
      onRequestDelete(product);
    }
    setIsDragging(false);
    setDragOffset(0);
    startXRef.current = 0;
  };

  const handleCardClick = () => {
    if (isRedDeleteMode) {
      onRequestDelete(product);
    }
  };

  const isLow = product.stock <= product.minStock;

  return (
    <div className="relative overflow-hidden rounded-2xl select-none group">
      {/* Fundo Revelado no Arrastar para o Lado com Lixeira */}
      <div 
        onClick={() => onRequestDelete(product)}
        className="absolute inset-0 bg-rose-600 rounded-2xl flex items-center justify-between px-6 text-white font-black text-xs cursor-pointer shadow-inner"
      >
        <div className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 animate-bounce" />
          <span>Remover Produto</span>
        </div>
        <div className="flex items-center gap-2">
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
          className={`relative p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
            darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
          } shadow-xs hover:border-emerald-500/40 cursor-grab active:cursor-grabbing`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">{product.name}</h4>
              {product.isEncryptedInStorage && (
                <span 
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1" 
                  title="Criptografado com AES-256 no banco e descriptografado no software"
                >
                  <Lock className="w-2.5 h-2.5" /> Protegido AES
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
    removeProduct, 
    darkMode, 
    openScanner, 
    operator,
    refreshProductsFromDatabase,
    isSyncingWithDatabase,
    lastDatabaseSyncTime 
  } = useApp();
  const [subTab, setSubTab] = useState<'estoque' | 'zero_knowledge'>('estoque');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);

  // Modal de Confirmação de Remoção de Produto
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];

  const filtered = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.ean.includes(searchTerm) ||
      p.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
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
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Consulta de Estoque
            </h2>
            {lastDatabaseSyncTime && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title={`Sincronizado com Supabase às ${lastDatabaseSyncTime}`}>
                🟢 Nuvem {lastDatabaseSyncTime}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Localização em gôndola, saldos e consulta de código EAN-13 (Multissessão Realtime).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshProductsFromDatabase()}
            disabled={isSyncingWithDatabase}
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            title="Atualizar produtos do banco de dados na nuvem"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-500 ${isSyncingWithDatabase ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncingWithDatabase ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
          <button
            onClick={() => setIsSpreadsheetModalOpen(true)}
            className="border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
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
        </div>
      </div>

      {/* Dica de Uso de Gestos */}
      <div className="px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>💡 Dica: <strong>Pressione um produto</strong> para mudar para vermelho com lixeira, ou <strong>arraste para o lado</strong> para remover.</span>
      </div>

      {/* Sub-Abas: Estoque Físico vs Importador Zero-Knowledge */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs gap-1">
        <button
          onClick={() => setSubTab('estoque')}
          className={`py-2 px-3.5 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
            subTab === 'estoque'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Gôndola & Saldos ({products.length})</span>
        </button>
        <button
          onClick={() => setSubTab('zero_knowledge')}
          className={`py-2 px-3.5 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
            subTab === 'zero_knowledge'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Importação Zero-Knowledge</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/30">
            AES-256
          </span>
        </button>
      </div>

      {subTab === 'zero_knowledge' ? (
        <ImportadorPlanilhaZeroKnowledge 
          lojaId={operator.loja_id || 'loja_padrao_001'}
          usuarioId={operator.code || '4092'}
        />
      ) : (
        <>
          {/* Busca & Scanner Trigger */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Nome, EAN ou localização..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 rounded-2xl text-xs border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
                  darkMode
                    ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500'
                    : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                }`}
              />
            </div>
            <button
              onClick={handleScanForSearch}
              className={`p-2.5 rounded-2xl border transition flex items-center gap-1.5 text-xs font-semibold ${
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
                  onRequestDelete={(p) => setProductToDelete(p)}
                />
              ))
            )}
          </div>
        </>
      )}

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
    </div>
  );
};

