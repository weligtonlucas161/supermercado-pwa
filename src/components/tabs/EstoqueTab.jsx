import React, { useState } from 'react';
import { Search, MapPin } from 'lucide-react';

export default function EstoqueTab({ products }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.ean.includes(searchTerm)
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Consulta de Estoque</h2>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <input 
          type="text" 
          placeholder="Buscar por nome ou código EAN..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-2">
        {filteredProducts.map((prod) => {
          const isLow = prod.stock <= prod.minStock;
          return (
            <div key={prod.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-sm text-gray-800">{prod.name}</p>
                  <p className="text-[10px] text-gray-400">EAN: {prod.ean}</p>
                </div>
                <span className="font-bold text-blue-700 text-sm">
                  R$ {prod.price.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-50">
                <span className="flex items-center gap-1 text-gray-500">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" /> {prod.location}
                </span>
                <span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                  isLow ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                }`}>
                  Estoque: {prod.stock} un
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}