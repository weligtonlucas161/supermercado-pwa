import React, { useState } from 'react';
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
  Layers
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NewProductModal } from '../modals/NewProductModal';
import { ImportSpreadsheetModal } from '../modals/ImportSpreadsheetModal';
import { ImportadorPlanilhaZeroKnowledge } from '../inventory/ImportadorPlanilhaZeroKnowledge';

export const EstoqueTab: React.FC = () => {
  const { products, updateProductStock, darkMode, openScanner, operator } = useApp();
  const [subTab, setSubTab] = useState<'estoque' | 'zero_knowledge'>('estoque');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);

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

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Consulta de Estoque
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Localização em gôndola, saldos e consulta de código EAN-13.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSpreadsheetModalOpen(true)}
            className="border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            title="Importar planilha Excel ou CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar Planilha</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Produto</span>
          </button>
        </div>
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
          <span>Gôndola & Saldos</span>
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

      {/* Cards de Produtos com Ajuste Rápido */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nenhum produto encontrado</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Tente outro termo de busca ou adicione um novo item.</p>
          </div>
        ) : (
          filtered.map(product => {
            const isLow = product.stock <= product.minStock;
            return (
              <div
                key={product.id}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
                } shadow-xs hover:border-emerald-500/40`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{product.name}</h4>
                    {product.isEncryptedInStorage && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1" title="Criptografado com AES-256 no banco e descriptografado no software">
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

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-700/60">
                  <div className="text-left sm:text-right">
                    <div className={`text-base font-black ${isLow ? 'text-amber-500' : 'text-slate-800 dark:text-slate-100'}`}>
                      {product.stock} <span className="text-[10px] font-normal text-slate-400">un</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Mínimo: {product.minStock} un</div>
                  </div>

                  {/* Botões Rápidos de Reposição (+ / -) */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-750 p-1 rounded-xl">
                    <button
                      onClick={() => updateProductStock(product.id, { delta: -1 })}
                      className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-600 transition shadow-xs"
                      title="Dar baixa em 1 unidade"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updateProductStock(product.id, { delta: 1 })}
                      className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-600 transition shadow-xs"
                      title="Repor 1 unidade"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      </>
      )}

      <NewProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <ImportSpreadsheetModal isOpen={isSpreadsheetModalOpen} onClose={() => setIsSpreadsheetModalOpen(false)} />
    </div>
  );
};
