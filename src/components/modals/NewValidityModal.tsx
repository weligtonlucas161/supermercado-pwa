import React, { useState } from 'react';
import { X, Calendar, Plus, Barcode } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UrgencyStatus } from '../../types';

interface NewValidityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewValidityModal: React.FC<NewValidityModalProps> = ({ isOpen, onClose }) => {
  const { products, addValidity, openScanner, isPromotor, operator } = useApp();

  // Se o usuário for Promotor, filtra exclusivamente os produtos vinculados ao seu código de fornecedor
  const filteredProducts = isPromotor && operator?.codigo_fornecedor
    ? products.filter(p => (p.supplierCode || '').trim().toUpperCase() === operator.codigo_fornecedor?.trim().toUpperCase())
    : products;

  const [productId, setProductId] = useState('');
  const [batch, setBatch] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [quantity, setQuantity] = useState('10');

  // Atualiza productId caso esteja vazio ou fora da lista filtrada
  React.useEffect(() => {
    if (filteredProducts.length > 0 && (!productId || !filteredProducts.some(p => p.id === productId))) {
      setProductId(filteredProducts[0].id);
    }
  }, [filteredProducts, productId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = filteredProducts.find(p => p.id === productId);
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
      registradoPorPromotor: isPromotor,
      promotorNome: isPromotor ? operator.name : undefined,
      supplierCode: isPromotor ? (operator.codigo_fornecedor || product.supplierCode) : product.supplierCode,
      sector: isPromotor ? (operator.setor_restrito || product.category) : product.category,
    });

    onClose();
  };

  const handleScanForProduct = () => {
    openScanner((scannedEan) => {
      const found = filteredProducts.find(p => p.ean === scannedEan);
      if (found) {
        setProductId(found.id);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">Lançar Novo Lote</h3>
              <p className="text-[11px] text-slate-400">Controle de validade por lote</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

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
              {filteredProducts.length === 0 ? (
                <option value="">
                  {isPromotor 
                    ? `Nenhum produto cadastrado para o fornecedor (${operator.codigo_fornecedor || 'não atribuído'})`
                    : 'Nenhum produto cadastrado'}
                </option>
              ) : (
                filteredProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.supplierCode ? `[Fornec: ${p.supplierCode}]` : ''} ({p.category})
                  </option>
                ))
              )}
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
      </div>
    </div>
  );
};
