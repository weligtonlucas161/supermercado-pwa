import { ValidityModalFrame } from './ValidityModalFrame';
import React, { useState } from 'react';
import { Plus, Barcode } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UrgencyStatus } from '../../types';

interface NewValidityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewValidityModal: React.FC<NewValidityModalProps> = ({ isOpen, onClose }) => {
  const { products, addValidity, openScanner } = useApp();

  const [productId, setProductId] = useState(products[0]?.id || '');
  const [batch, setBatch] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [quantity, setQuantity] = useState('10');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === productId);
    if (!product || !batch || !dueDate) return;

    // Calculate status based on days remaining
    const diffMs = new Date(dueDate).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let status: UrgencyStatus = 'ok';
    if (diffDays <= 4) status = 'urgent';
    else if (diffDays <= 15) status = 'warning';

    addValidity({
      productId: product.id,
      name: product.name,
      batch: batch.toUpperCase(),
      dueDate,
      quantity: Number(quantity) || 1,
      status,
    });

    onClose();
  };

  const handleScanForProduct = () => {
    openScanner((scannedEan) => {
      const found = products.find(p => p.ean === scannedEan);
      if (found) {
        setProductId(found.id);
      }
    });
  };

  return (
    <ValidityModalFrame title="Lançar Novo Lote" description="Controle de validade por lote" onClose={onClose}>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Select Product */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                Produto
              </label>
              <button
                type="button"
                onClick={handleScanForProduct}
                className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 hover:underline"
              >
                <Barcode className="w-3 h-3" /> Bipar EAN
              </button>
            </div>
            <select
              value={productId}
              onChange={e => setProductId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category})
                </option>
              ))}
            </select>
          </div>

          {/* Lote & Quantidade */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                Nº do Lote
              </label>
              <input
                type="text"
                placeholder="Ex: L-9021"
                required
                value={batch}
                onChange={e => setBatch(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                Quantidade
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Data de Vencimento */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
              Data de Vencimento
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
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
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Registrar Lote
            </button>
          </div>
        </form>
    </ValidityModalFrame>
  );
};
