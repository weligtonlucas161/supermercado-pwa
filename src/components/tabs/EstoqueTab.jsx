import React, { useState } from 'react';
import { Search, Plus, Barcode } from 'lucide-react';

export default function EstoqueTab({ products }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', ...new Set(products.map(p => p.category))];

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.ean.includes(searchTerm);
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Consulta de Estoque</h2>
          <p className="text-xs text-slate-500">Localização e saldos.</p>
        </div>
        <button className="bg-emerald-600 text-white p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Cadastrar Produto</span>
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input 
            type="text" 
            placeholder="Nome ou EAN..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border bg-white border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <button className="p-2 rounded-xl border bg-white border-slate-200">
          <Barcode className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {cat === 'all' ? 'Todas Categorias' : cat}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(product => {
          const isLow = product.stock <= product.minStock;
          return (
            <div key={product.id} className="p-3.5 rounded-2xl border bg-white border-slate-200 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold">{product.name}</h4>
                  {isLow && (
                    <span className="bg-amber-500/10 text-amber-600 text-[10px] px-1.5 py-0.5 rounded font-semibold border border-amber-500/20">Ruptura</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">EAN: {product.ean} • {product.location}</p>
                <p className="text-xs font-bold text-emerald-600">R$ {product.price.toFixed(2)}</p>
              </div>

              <div className="text-right">
                <div className={`text-base font-extrabold ${isLow ? 'text-amber-500' : 'text-slate-700'}`}>
                  {product.stock} <span className="text-[10px] font-normal text-slate-400">un</span>
                </div>
                <div className="text-[10px] text-slate-400">Mín: {product.minStock} un</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}