import React, { useState } from 'react';
import { X, Package, Plus, Barcode } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface NewProductModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewProductModal: React.FC<NewProductModalProps> = ({ isOpen, onClose }) => {
  const { addProduct, openScanner } = useApp();

  const [name, setName] = useState('');
  const [ean, setEan] = useState('');
  const [category, setCategory] = useState('Mercearia');
  const [stock, setStock] = useState('50');
  const [minStock, setMinStock] = useState('20');
  const [price, setPrice] = useState('9.99');
  const [location, setLocation] = useState('Corredor 1 - Prateleira A');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ean) return;

    addProduct({
      name,
      ean: ean.trim(),
      category,
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 10,
      price: Number(price) || 0,
      location,
    });

    onClose();
  };

  const handleScanEAN = () => {
    openScanner((scanned) => {
      setEan(scanned);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">Cadastrar Produto</h3>
              <p className="text-[11px] text-slate-400">Adicionar novo item ao estoque da loja</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {/* Nome */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
              Nome do Produto
            </label>
            <input
              type="text"
              placeholder="Ex: Azeite Extra Virgem 500ml"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* EAN com botão de scan */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                Código EAN-13
              </label>
              <button
                type="button"
                onClick={handleScanEAN}
                className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 hover:underline"
              >
                <Barcode className="w-3.5 h-3.5" /> Bipar Código
              </button>
            </div>
            <input
              type="text"
              placeholder="Ex: 7891000100099"
              required
              value={ean}
              onChange={e => setEan(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Categoria & Preço */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                Categoria
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Mercearia">Mercearia</option>
                <option value="Laticínios">Laticínios</option>
                <option value="Limpeza">Limpeza</option>
                <option value="Bebidas">Bebidas</option>
                <option value="Hortifrúti">Hortifrúti</option>
                <option value="Padaria">Padaria</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                Preço Unitário (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Estoque Inicial & Mínimo */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                Estoque Inicial (un)
              </label>
              <input
                type="number"
                min="0"
                required
                value={stock}
                onChange={e => setStock(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                Estoque Mínimo (un)
              </label>
              <input
                type="number"
                min="1"
                required
                value={minStock}
                onChange={e => setMinStock(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Localização */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
              Localização na Loja
            </label>
            <input
              type="text"
              placeholder="Ex: Corredor 3 - Prateleira B"
              required
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Salvar Produto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
