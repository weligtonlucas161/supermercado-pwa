import React, { useState, useRef, useEffect } from 'react';
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
  TrendingDown,
  CheckCheck,
  Tag,
  ClipboardList,
  CheckCircle2,
  Camera,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, TipoAvaria, TIPOS_AVARIA, AvariaItem } from '../../types';
import { NewProductModal } from '../modals/NewProductModal';
import { ImportSpreadsheetModal } from '../modals/ImportSpreadsheetModal';
import { ProductDetailModal } from '../modals/ProductDetailModal';

interface ProductCardProps {
  product: Product;
  darkMode: boolean;
  onUpdateStock: (id: string, update: { delta?: number }) => void;
  onRequestDelete: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onSolicitarRebaixa: (productId: string) => void;
  onConfirmarRebaixa: (productId: string) => void;
  onCancelarRebaixa: (productId: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  darkMode,
  onUpdateStock,
  onRequestDelete,
  onSelectProduct,
  onSolicitarRebaixa,
  onConfirmarRebaixa,
  onCancelarRebaixa,
}) => {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const movedRef = useRef(false);

  const isRebaixaPendente = product.rebaixaStatus === 'pendente';
  const isRebaixaConfirmada = product.rebaixaStatus === 'confirmada';

  // Touch handlers para gesto de arrastar (Swipe)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    movedRef.current = false;
    startXRef.current = touch.clientX;
    currentXRef.current = touch.clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const diff = touch.clientX - startXRef.current;
    currentXRef.current = touch.clientX;

    if (Math.abs(diff) > 10) {
      movedRef.current = true;
      setIsDragging(true);
      // Limita o arrasto entre -30px e 150px (foco no arraste da esquerda para direita)
      const clamped = Math.max(-30, Math.min(150, diff));
      setDragOffset(clamped);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);

    // Gesto de Arrastar da Esquerda para a Direita (>= 60px):
    // 1º movimento: Marca como pedido de rebaixa.
    // Repetir o movimento: Confirma a rebaixa.
    if (dragOffset >= 60) {
      if (isRebaixaPendente) {
        onConfirmarRebaixa(product.id);
      } else if (!isRebaixaConfirmada) {
        onSolicitarRebaixa(product.id);
      }
    }

    setDragOffset(0);
    startXRef.current = 0;
  };

  // Mouse drag handlers (para desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    movedRef.current = false;
    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (startXRef.current === 0) return;
    const diff = e.clientX - startXRef.current;
    if (Math.abs(diff) > 10) {
      movedRef.current = true;
      setIsDragging(true);
      const clamped = Math.max(-30, Math.min(150, diff));
      setDragOffset(clamped);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragOffset >= 60) {
      if (isRebaixaPendente) {
        onConfirmarRebaixa(product.id);
      } else if (!isRebaixaConfirmada) {
        onSolicitarRebaixa(product.id);
      }
    }
    setIsDragging(false);
    setDragOffset(0);
    startXRef.current = 0;
  };

  const isLow = product.stock <= product.minStock;

  return (
    <div className="relative overflow-hidden rounded-2xl select-none group">
      {/* Fundo Revelado pelo Gesto de Arrastar (Swipe Right) */}
      <div 
        className={`absolute inset-0 rounded-2xl flex items-center justify-start px-6 text-white font-black text-xs shadow-inner transition-colors ${
          isRebaixaPendente
            ? 'bg-emerald-600'
            : isRebaixaConfirmada
            ? 'bg-blue-600'
            : 'bg-amber-500'
        }`}
      >
        <div className="flex items-center gap-2 animate-in slide-in-from-left duration-200">
          {isRebaixaPendente ? (
            <>
              <CheckCheck className="w-5 h-5 animate-bounce" />
              <span>Solte para Confirmar a Rebaixa</span>
            </>
          ) : isRebaixaConfirmada ? (
            <>
              <Tag className="w-5 h-5" />
              <span>Rebaixa já confirmada</span>
            </>
          ) : (
            <>
              <TrendingDown className="w-5 h-5 animate-pulse" />
              <span>Solte para Pedir Rebaixa de Preço</span>
            </>
          )}
        </div>
      </div>

      {/* Cartão do Produto (Frente) */}
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
          darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
        } ${
          isRebaixaConfirmada
            ? 'border-emerald-500/70 dark:border-emerald-500/60 ring-2 ring-emerald-500/20'
            : isRebaixaPendente
            ? 'border-amber-500/70 dark:border-amber-500/60 ring-2 ring-amber-500/20'
            : 'hover:border-emerald-500/50'
        } shadow-xs hover:shadow-md transition-all active:scale-[0.99]`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">{product.name}</h4>

            {/* Badges de Rebaixa por Gesto */}
            {isRebaixaConfirmada ? (
              <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-md font-black border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Rebaixa Confirmada
              </span>
            ) : isRebaixaPendente ? (
              <span className="bg-amber-500/15 text-amber-800 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-md font-black border border-amber-500/30 flex items-center gap-1 animate-pulse">
                <TrendingDown className="w-3 h-3 text-amber-500" /> Pedido de Rebaixa (Arraste novamente p/ confirmar)
              </span>
            ) : null}

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

          <div className="flex items-center gap-2">
            <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
              R$ {product.price.toFixed(2)}
            </p>
            {isRebaixaPendente && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelarRebaixa(product.id);
                }}
                className="text-[10px] text-slate-400 hover:text-rose-500 underline transition cursor-pointer"
              >
                Cancelar pedido
              </button>
            )}
          </div>
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
              className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-600 transition shadow-xs cursor-pointer"
              title="Dar baixa em 1 unidade"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateStock(product.id, { delta: 1 });
              }}
              className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-600 transition shadow-xs cursor-pointer"
              title="Repor 1 unidade"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Botão de Excluir */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequestDelete(product);
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer"
            title="Remover produto do estoque"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const EstoqueTab: React.FC = () => {
  const { 
    products, 
    updateProductStock, 
    removeProduct, 
    solicitarRebaixa,
    confirmarRebaixa,
    cancelarRebaixa,
    avarias,
    addAvaria,
    darkMode, 
    openScanner, 
    operator,
    isGerente,
    isSaasAdmin,
    isPromotor,
    refreshProductsFromDatabase,
    isSyncingWithDatabase,
    lastDatabaseSyncTime 
  } = useApp();

  type SortOption = 'default' | 'qtd-desc' | 'qtd-asc' | 'name-asc' | 'name-desc' | 'forn-asc';

  // Sub-aba principal: Consulta de Estoque vs Seção de Avarias
  const [activeMainSubTab, setActiveMainSubTab] = useState<'estoque' | 'avarias'>('estoque');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);

  // Modal de Detalhes e Edição Concorrente de Produto
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);

  // Modal de Confirmação de Remoção de Produto
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // =========================================================================
  // REQUISITO 3: RESTRIÇÕES DE ESTOQUE POR SETOR (E PROMOTOR)
  // "O estoque deve ser exibido para cargos abaixo de 'Gerente Geral' estritamente
  // filtrado pelo setor do usuário (ex: funcionário do Setor X vê apenas o X)."
  // =========================================================================
  const isGeneralManager = isGerente || isSaasAdmin || (operator.role || '').toLowerCase().includes('gerente');
  const userRestrictedSector = (!isGeneralManager && operator.setor_restrito && operator.setor_restrito !== 'TODOS')
    ? operator.setor_restrito.toUpperCase()
    : null;

  // Filtragem inicial estrita por regras de negócio
  const scopedProducts = products.filter(p => {
    // 1. Se for Promotor: visualiza estritamente os produtos vinculados ao seu fornecedor atribuído
    if (isPromotor || operator.role === 'promotor') {
      const userSupplierCode = operator.codigo_fornecedor?.trim().toUpperCase();
      if (!userSupplierCode) return false;
      return (p.supplierCode || '').trim().toUpperCase() === userSupplierCode;
    }

    // 2. Se for cargo abaixo de Gerente Geral com setor restrito: vê estritamente o seu setor
    if (userRestrictedSector) {
      return (p.category || '').trim().toUpperCase() === userRestrictedSector;
    }

    return true;
  });

  // 1. Produtos em Ruptura Iminente no escopo permitido
  const ruptureProducts = scopedProducts.filter(p => p.stock <= p.minStock || p.stock === 0);
  const hasRuptures = ruptureProducts.length > 0;
  const [stockSubTab, setStockSubTab] = useState<'todos' | 'rupturas'>('todos');

  const categories = ['all', ...Array.from(new Set(scopedProducts.map(p => p.category)))];

  // Base filtrada pela sub-aba ativa se houver rupturas
  const baseProducts = (stockSubTab === 'rupturas' && hasRuptures) ? ruptureProducts : scopedProducts;

  // Busca Multicampos: Nome, EAN, 2º EAN, Código Reduzido, Código de Fornecedor
  const filtered = baseProducts
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

  // =========================================================================
  // REQUISITO 6: SEÇÃO DE AVARIAS NO ESTOQUE (ACESSÍVEL A TODOS OS CARGOS)
  // Formulário: Código de barras, Código reduzido (automático), Quantidade,
  // Tipo de avaria (lista suspensa), Opção booleana para Troca (Sim/Não).
  // =========================================================================
  const [avariaBarcodeInput, setAvariaBarcodeInput] = useState('');
  const [avariaReducedCode, setAvariaReducedCode] = useState('');
  const [avariaProductName, setAvariaProductName] = useState('');
  const [avariaQuantity, setAvariaQuantity] = useState<number>(1);
  const [avariaTipo, setAvariaTipo] = useState<TipoAvaria>('Embalagem danificada');
  const [avariaParaTroca, setAvariaParaTroca] = useState<boolean>(true);
  const [avariaNotice, setAvariaNotice] = useState<string | null>(null);

  // Auto-preenchimento com base no código de barras
  const handleAvariaBarcodeChange = (rawCode: string) => {
    const clean = rawCode.trim();
    setAvariaBarcodeInput(clean);

    if (!clean) {
      setAvariaReducedCode('');
      setAvariaProductName('');
      return;
    }

    // Busca nos produtos cadastrados
    const matched = products.find(p => {
      const cleanEan = (p.ean || '').replace(/[^0-9A-Za-z]/g, '');
      const cleanSec = (p.secondaryEan || '').replace(/[^0-9A-Za-z]/g, '');
      const inputClean = clean.replace(/[^0-9A-Za-z]/g, '');
      return cleanEan === inputClean || cleanSec === inputClean || cleanEan.endsWith(inputClean);
    });

    if (matched) {
      setAvariaProductName(matched.name);
      setAvariaReducedCode(matched.reducedCode || '');
      setAvariaNotice(`✓ Produto identificado: "${matched.name}" (Reduzido: ${matched.reducedCode || 'N/A'})`);
    } else {
      setAvariaProductName('');
      setAvariaReducedCode('');
      setAvariaNotice(null);
    }
  };

  const handleScanAvariaBarcode = () => {
    openScanner((scannedEan) => {
      handleAvariaBarcodeChange(scannedEan);
    });
  };

  const handleSubmitAvaria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!avariaBarcodeInput.trim()) {
      setAvariaNotice('Por favor, informe o código de barras do produto.');
      return;
    }
    if (avariaQuantity <= 0) {
      setAvariaNotice('A quantidade avariada deve ser maior que zero.');
      return;
    }

    const prodName = avariaProductName.trim() || `Produto EAN ${avariaBarcodeInput.trim()}`;
    const targetSector = userRestrictedSector || operator.setor_restrito || 'Estoque';

    await addAvaria({
      loja_id: operator.loja_id || 'loja_padrao_001',
      codigo_barras: avariaBarcodeInput.trim(),
      codigo_reduzido: avariaReducedCode.trim() || undefined,
      produto_nome: prodName,
      quantidade: avariaQuantity,
      tipo_avaria: avariaTipo,
      para_troca: avariaParaTroca,
      setor: targetSector,
      registrado_por_nome: operator.name || 'Operador',
      registrado_por_matricula: operator.code || operator.matricula || '4092',
    });

    setAvariaNotice(`✓ Avaria registrada com sucesso para "${prodName}"!`);
    setAvariaBarcodeInput('');
    setAvariaReducedCode('');
    setAvariaProductName('');
    setAvariaQuantity(1);
    setAvariaParaTroca(true);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header com Navegação de Sub-Abas: Estoque vs Avarias */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {activeMainSubTab === 'estoque' ? 'Consulta de Estoque' : 'Gestão de Avarias no Estoque'}
            </h2>
            {lastDatabaseSyncTime && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title={`Sincronizado com Supabase às ${lastDatabaseSyncTime}`}>
                🟢 Nuvem {lastDatabaseSyncTime}
              </span>
            )}
            {userRestrictedSector && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">
                🔒 Setor: {userRestrictedSector}
              </span>
            )}
            {isPromotor && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                🏷️ Fornecedor: {operator.codigo_fornecedor || 'Exclusivo'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {activeMainSubTab === 'estoque'
              ? `Localização em gôndola, saldos e consulta de código EAN-13 (${scopedProducts.length} itens acessíveis).`
              : `Controle de produtos danificados, quebras e solicitações de troca (${avarias.length} avarias registradas).`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Sub-Aba: Estoque vs Avarias */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveMainSubTab('estoque')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeMainSubTab === 'estoque'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Estoque</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMainSubTab('avarias')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeMainSubTab === 'avarias'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-rose-600'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Avarias ({avarias.length})</span>
            </button>
          </div>

          {activeMainSubTab === 'estoque' && (
            <>
              <button
                onClick={() => refreshProductsFromDatabase()}
                disabled={isSyncingWithDatabase}
                className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                title="Atualizar produtos do banco de dados na nuvem"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-500 ${isSyncingWithDatabase ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncingWithDatabase ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>
              {isGeneralManager && (
                <button
                  onClick={() => setIsSpreadsheetModalOpen(true)}
                  className="border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  title="Importar planilha Excel ou CSV"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Importar Planilha</span>
                </button>
              )}
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

      {/* ===================================================================== */}
      {/* SUB-ABA 1: CONSULTA DE ESTOQUE E GESTÃO POR GESTOS                    */}
      {/* ===================================================================== */}
      {activeMainSubTab === 'estoque' && (
        <div className="space-y-4">
          {/* INTERFACE EXCLUSIVA DE RUPTURAS IMINENTES */}
          {hasRuptures && (
            <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-rose-500/10 border-2 border-amber-500/40 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-2xl bg-amber-500 text-slate-950 shadow-sm">
                    <AlertTriangle className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-slate-900 dark:text-white">
                        Alerta de Rupturas Iminentes
                      </h3>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 uppercase tracking-wide">
                        {ruptureProducts.length} {ruptureProducts.length === 1 ? 'Produto Crítico' : 'Produtos Críticos'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Estes produtos atingiram o estoque de segurança ou estão zerados. Reponha ou contate o fornecedor imediatamente.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStockSubTab(prev => prev === 'rupturas' ? 'todos' : 'rupturas')}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                    stockSubTab === 'rupturas'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 hover:bg-amber-500/30'
                  }`}
                >
                  <span>{stockSubTab === 'rupturas' ? 'Ver Todos os Produtos' : 'Filtrar Somente Rupturas'}</span>
                  <span>→</span>
                </button>
              </div>

              {/* Cards Rápidos de Ruptura (Carrossel Horizontal) */}
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
                {ruptureProducts.slice(0, 8).map(prod => (
                  <div
                    key={`rupture-card-${prod.id}`}
                    className="min-w-[210px] p-3 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 shadow-xs flex flex-col justify-between space-y-2 shrink-0"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                        <span>{prod.category}</span>
                        <span className="text-amber-600 dark:text-amber-400 font-mono">EAN: {prod.ean.slice(-5)}</span>
                      </div>
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-white line-clamp-1 mt-0.5" title={prod.name}>
                        {prod.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                          {prod.stock} un
                        </span>
                        <span className="text-[10px] text-slate-400">
                          (Mínimo: {prod.minStock} un)
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[110px]">
                        {prod.supplierCode ? `Forn: ${prod.supplierCode}` : 'Gôndola'}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateProductStock(prod.id, { delta: 1 })}
                        className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition shadow-xs flex items-center gap-1 cursor-pointer"
                        title="Adicionar 1 unidade ao estoque"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Repor +1</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dica de Uso de Gestos (Requisito 4) */}
          <div className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border border-amber-500/30 text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[10px]">GESTO SWIPE</span>
              <span>Arrastar da <strong>esquerda para a direita</strong>: Marca o produto como <strong>Pedido de Rebaixa</strong>. Repetir o movimento <strong>confirma a rebaixa</strong>.</span>
            </span>
            <span className="text-[10px] font-semibold text-slate-400">Gesto otimizado para celular e mouse</span>
          </div>

          {/* Busca, Filtro de Ordenação e Scanner Trigger */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder={
                  userRestrictedSector 
                    ? `Buscar produtos no setor ${userRestrictedSector}...` 
                    : isPromotor
                    ? `Buscar produtos do fornecedor ${operator.codigo_fornecedor}...`
                    : 'Buscar por nome, EAN, cód. reduzido ou fornecedor...'
                }
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
                title="Bipar código de barras com a câmera"
              >
                <Barcode className="w-5 h-5 text-emerald-500" />
                <span className="hidden sm:inline">Bipar</span>
              </button>
            </div>
          </div>

          {/* Categorias (Filtro Horizontal ou Bloqueio de Setor) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {userRestrictedSector ? (
              <div className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5">
                <span>🔒 Setor Atribuído:</span>
                <span className="font-extrabold">{userRestrictedSector}</span>
              </div>
            ) : isPromotor ? (
              <div className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-bold flex items-center gap-1.5">
                <span>🏷️ Fornecedor Exclusivo:</span>
                <span className="font-extrabold">{operator.codigo_fornecedor}</span>
              </div>
            ) : (
              categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : darkMode
                      ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat === 'all' ? 'Todas Categorias' : cat}
                </button>
              ))
            )}
          </div>

          {/* Cards de Produtos com Suporte a Gestos de Swipe para Rebaixa */}
          <div className="space-y-2.5">
            {filtered.length === 0 ? (
              <div className="text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {userRestrictedSector
                    ? `Nenhum produto cadastrado no setor ${userRestrictedSector}`
                    : isPromotor
                    ? `Nenhum produto cadastrado para o fornecedor ${operator.codigo_fornecedor}`
                    : 'Nenhum produto cadastrado'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Importe uma planilha ou cadastre itens para visualizar neste painel.
                </p>
              </div>
            ) : (
              filtered.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  darkMode={darkMode}
                  onUpdateStock={updateProductStock}
                  onRequestDelete={(p) => setProductToDelete(p)}
                  onSelectProduct={(p) => setSelectedProductForDetail(p)}
                  onSolicitarRebaixa={solicitarRebaixa}
                  onConfirmarRebaixa={confirmarRebaixa}
                  onCancelarRebaixa={cancelarRebaixa}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-ABA 2: SEÇÃO DE AVARIAS NO ESTOQUE (REQUISITO 6)                  */}
      {/* ===================================================================== */}
      {activeMainSubTab === 'avarias' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Formulário de Registro de Avaria */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Registrar Produto Avariado
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Acessível a todos os operadores e cargos para controle de perdas e trocas
                  </p>
                </div>
              </div>
            </div>

            {avariaNotice && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
                <span>{avariaNotice}</span>
                <button type="button" onClick={() => setAvariaNotice(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <form onSubmit={handleSubmitAvaria} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Código de Barras (digitado manualmente ou via câmera) */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
                    Código de Barras (EAN-13) *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Digite ou bipe o código..."
                      value={avariaBarcodeInput}
                      onChange={e => handleAvariaBarcodeChange(e.target.value)}
                      className="flex-1 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleScanAvariaBarcode}
                      className="px-3.5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm shrink-0"
                      title="Bipar código de barras com a câmera"
                    >
                      <Camera className="w-4 h-4" />
                      <span className="hidden sm:inline">Câmera</span>
                    </button>
                  </div>
                </div>

                {/* 2. Código Reduzido (preenchido automaticamente com base no código de barras) */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
                    Código Reduzido (Preenchimento Automático)
                  </label>
                  <input
                    type="text"
                    placeholder="Identificado pelo código de barras..."
                    value={avariaReducedCode}
                    onChange={e => setAvariaReducedCode(e.target.value)}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 font-mono font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Nome do Produto (detectado) */}
              {avariaProductName && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Produto Vinculado:</span>
                  <span className="font-bold text-slate-900 dark:text-white text-xs">{avariaProductName}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* 3. Quantidade do Produto Avariado */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
                    Quantidade Avariada *
                  </label>
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setAvariaQuantity(q => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      required
                      value={avariaQuantity}
                      onChange={e => setAvariaQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 text-center font-black text-sm bg-transparent focus:outline-none text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setAvariaQuantity(q => q + 1)}
                      className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 4. Tipo de Avaria (com lista suspensa de opções) */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
                    Tipo de Avaria *
                  </label>
                  <select
                    value={avariaTipo}
                    onChange={e => setAvariaTipo(e.target.value as TipoAvaria)}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none cursor-pointer"
                  >
                    {TIPOS_AVARIA.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>

                {/* 5. Opção Booleana / Seleção Indicando se é para 'Troca' (Sim/Não) */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
                    Item para Troca? *
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setAvariaParaTroca(true)}
                      className={`py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 ${
                        avariaParaTroca
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>Sim (Troca)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvariaParaTroca(false)}
                      className={`py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 ${
                        !avariaParaTroca
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>Não (Perda)</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md shadow-rose-600/20 transition flex items-center gap-2 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Gravar Produto Avariado</span>
                </button>
              </div>
            </form>
          </div>

          {/* Histórico de Avarias Registradas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-rose-500" />
                <span>Histórico de Produtos Avariados ({avarias.length})</span>
              </h3>
            </div>

            {avarias.length === 0 ? (
              <div className="text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <AlertTriangle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nenhuma avaria registrada</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Use o formulário acima para registrar itens com embalagem danificada ou quebra.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {avarias.map(item => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">{item.produto_nome}</h4>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          item.para_troca
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
                        }`}>
                          {item.para_troca ? '🔄 Troca com Fornecedor' : '❌ Perda Operacional'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          {item.tipo_avaria}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono flex-wrap">
                        <span>EAN: {item.codigo_barras}</span>
                        {item.codigo_reduzido && <span>• Reduzido: {item.codigo_reduzido}</span>}
                        {item.setor && <span>• Setor: {item.setor}</span>}
                        <span>• Registrado por: {item.registrado_por_nome} ({item.registrado_em})</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-rose-600 dark:text-rose-400">
                        {item.quantidade} {item.quantidade === 1 ? 'unidade' : 'unidades'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
      <ProductDetailModal
        isOpen={Boolean(selectedProductForDetail)}
        product={selectedProductForDetail}
        onClose={() => setSelectedProductForDetail(null)}
      />
    </div>
  );
};
