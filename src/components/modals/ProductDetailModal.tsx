import React, { useState, useEffect } from 'react';
import { 
  X, 
  Barcode, 
  Package, 
  Lock, 
  Unlock, 
  Edit3, 
  Save, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Tag, 
  MapPin, 
  Layers, 
  Camera,
  RotateCcw
} from 'lucide-react';
import { Product, SETORES_DISPONIVEIS, SetorLoja } from '../../types';
import { useApp } from '../../context/AppContext';
import { triggerScanBeep } from '../../utils/haptics';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  const { 
    operator, 
    lockProductForEdit, 
    unlockProductForEdit, 
    updateProductDetails, 
    openScanner, 
    darkMode 
  } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [lockErrorMessage, setLockErrorMessage] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Form State
  const [editName, setEditName] = useState('');
  const [editEan, setEditEan] = useState('');
  const [editSecondaryEan, setEditSecondaryEan] = useState('');
  const [editReducedCode, setEditReducedCode] = useState('');
  const [editSupplierCode, setEditSupplierCode] = useState('');
  const [editStock, setEditStock] = useState<number>(0);
  const [editMinStock, setEditMinStock] = useState<number>(10);
  const [editCategory, setEditCategory] = useState<string>('MERCEARIA');
  const [editLocation, setEditLocation] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Sincroniza formulário ao abrir produto
  useEffect(() => {
    if (product) {
      setEditName(product.name || '');
      setEditEan(product.ean || '');
      setEditSecondaryEan(product.secondaryEan || '');
      setEditReducedCode(product.reducedCode || '');
      setEditSupplierCode(product.supplierCode || '');
      setEditStock(product.stock ?? 0);
      setEditMinStock(product.minStock ?? 10);
      setEditCategory(product.category || 'MERCEARIA');
      setEditLocation(product.location || '');
      setIsEditing(false);
      setLockErrorMessage(null);
      setSaveSuccessMessage(null);
    }
  }, [product, isOpen]);

  // Libera a trava de edição se fechar modal enquanto editava
  const handleClose = () => {
    if (isEditing && product) {
      unlockProductForEdit(product.id);
    }
    setIsEditing(false);
    onClose();
  };

  if (!isOpen || !product) return null;

  const operatorIdentifier = `${operator.name || 'Operador'} (${operator.code || '4092'})`;
  const isLockedByOther = Boolean(
    product.isLockedForEdit && 
    product.lockedBy && 
    product.lockedBy.trim() !== operatorIdentifier.trim()
  );

  const isRupture = (product.stock ?? 0) <= (product.minStock ?? 10) || product.stock === 0;

  // Iniciar Modo de Edição com Bloqueio Concorrente
  const handleStartEdit = () => {
    setLockErrorMessage(null);
    setSaveSuccessMessage(null);

    const lockedSuccessfully = lockProductForEdit(product.id, operatorIdentifier);
    if (!lockedSuccessfully) {
      triggerScanBeep(false);
      setLockErrorMessage(
        `Este produto está bloqueado para edição por "${product.lockedBy || 'outro operador'}" no momento.`
      );
      return;
    }

    triggerScanBeep(true);
    setIsEditing(true);
  };

  // Cancelar Edição e Liberar Trava
  const handleCancelEdit = () => {
    unlockProductForEdit(product.id);
    setIsEditing(false);
    setLockErrorMessage(null);
    // Restaura valores originais
    setEditName(product.name || '');
    setEditEan(product.ean || '');
    setEditSecondaryEan(product.secondaryEan || '');
    setEditReducedCode(product.reducedCode || '');
    setEditSupplierCode(product.supplierCode || '');
    setEditStock(product.stock ?? 0);
    setEditMinStock(product.minStock ?? 10);
    setEditCategory(product.category || 'MERCEARIA');
    setEditLocation(product.location || '');
  };

  // Salvar Alterações e Desbloquear
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editEan.trim()) {
      setLockErrorMessage('Nome e Código de Barras Principal são obrigatórios.');
      return;
    }

    setIsSaving(true);
    const updates: Partial<Product> = {
      name: editName.trim(),
      ean: editEan.trim(),
      secondaryEan: editSecondaryEan.trim() || undefined,
      reducedCode: editReducedCode.trim() || undefined,
      supplierCode: editSupplierCode.trim() || undefined,
      stock: Math.max(0, editStock),
      minStock: Math.max(0, editMinStock),
      category: editCategory,
      location: editLocation.trim() || `Gôndola - ${editCategory}`,
    };

    const res = await updateProductDetails(product.id, updates);
    setIsSaving(false);

    if (res.success) {
      triggerScanBeep(true);
      setSaveSuccessMessage('Produto atualizado e desbloqueado com sucesso!');
      setIsEditing(false);
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } else {
      triggerScanBeep(false);
      setLockErrorMessage(res.error || 'Erro ao gravar alterações.');
    }
  };

  // Bipar 2º Código de Barras com a câmera
  const handleScanSecondaryEan = () => {
    openScanner((scanned) => {
      setEditSecondaryEan(scanned);
      triggerScanBeep(true);
    });
  };

  // Forçar desbloqueio (gerentes/admin)
  const handleForceUnlock = () => {
    unlockProductForEdit(product.id);
    setLockErrorMessage(null);
    triggerScanBeep(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 max-h-[92vh] flex flex-col">
        
        {/* Header do Pop-up */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                  {isEditing ? 'Editar Produto' : product.name}
                </h3>
                {isRupture && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 border border-rose-500/30">
                    Ruptura Iminente
                  </span>
                )}
                {product.isLockedForEdit && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Em Edição
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                EAN Principal: {product.ean} {product.secondaryEan ? `• 2º EAN: ${product.secondaryEan}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alertas de Trava / Sucesso */}
        {lockErrorMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{lockErrorMessage}</span>
            </div>
            {(operator.role === 'gerente' || operator.role === 'saas_admin' || operator.role === 'adm') && (
              <button
                type="button"
                onClick={handleForceUnlock}
                className="px-2.5 py-1 rounded-xl bg-rose-600 text-white text-[10px] font-bold shrink-0 hover:bg-rose-700 cursor-pointer"
              >
                Forçar Desbloqueio
              </button>
            )}
          </div>
        )}

        {saveSuccessMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
        )}

        {/* AVISO DE PRODUTO BLOQUEADO PARA OS DEMAIS */}
        {isLockedByOther && !isEditing && (
          <div className="mt-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <strong>Produto bloqueado para edição:</strong> Este item está sendo editado por <strong>{product.lockedBy}</strong>. Aguarde a finalização para efetuar alterações.
            </div>
          </div>
        )}

        {/* CORPO: MODO DE VISUALIZAÇÃO OU MODO DE EDIÇÃO */}
        <div className="py-4 overflow-y-auto flex-1 space-y-4">
          {!isEditing ? (
            /* ============================================================= */
            /* MODO DE VISUALIZAÇÃO DETALHADA                                */
            /* ============================================================= */
            <div className="space-y-4 text-xs">
              {/* Cards de Métricas de Estoque */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className={`p-3 rounded-2xl border ${
                  isRupture 
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400' 
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                }`}>
                  <span className="text-[10px] uppercase font-bold block opacity-80">Saldo Atual</span>
                  <span className="text-2xl font-black">{product.stock} un</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Estoque Mínimo</span>
                  <span className="text-xl font-black text-slate-800 dark:text-white">{product.minStock} un</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Setor da Loja</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white block truncate mt-1">
                    {product.category}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Status Operação</span>
                  <span className={`text-[11px] font-bold block mt-1 ${isRupture ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {isRupture ? 'Reposição Urgente' : 'Estoque Regular'}
                  </span>
                </div>
              </div>

              {/* Tabela de Informações & Códigos de Barras */}
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Barcode className="w-4 h-4 text-emerald-500" />
                  Identificação & Códigos de Barras
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Código EAN Principal:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{product.ean}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">2º Código de Barras (Embalagem / Alternativo):</span>
                    {product.secondaryEan ? (
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {product.secondaryEan}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">
                        Nenhum 2º código cadastrado (clique em Editar para adicionar)
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Código Reduzido (PLU):</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                      {product.reducedCode || 'Não informado'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Código do Fornecedor:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                      {product.supplierCode || 'Não informado'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Localização na Loja:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {product.location || `Gôndola - ${product.category}`}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Preço de Venda:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {product.price > 0 ? `R$ ${product.price.toFixed(2)}` : 'R$ 0,00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informações de Auditoria e Trava */}
              <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Concorrência Operacional:</span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Proteção Ativa</span>
                </div>
                <p>
                  Quando em edição, o sistema bloqueia o item concorrentemente para garantir consistência cadastral entre os operadores de piso de loja.
                </p>
              </div>
            </div>
          ) : (
            /* ============================================================= */
            /* MODO DE EDIÇÃO COM TRAVA CONCORRENTE ATIVA                    */
            /* ============================================================= */
            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  <strong>Bloqueio Ativo:</strong> Você está editando este produto com exclusividade. Os demais usuários verão o status bloqueado até que você salve ou cancele.
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                  Nome / Descrição do Produto *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                />
              </div>

              {/* SEÇÃO DOS CÓDIGOS DE BARRAS (1º E 2º EAN) */}
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 uppercase">
                  <Barcode className="w-4 h-4 text-emerald-500" />
                  Códigos de Barras do Produto
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                      1º Código de Barras (Principal) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editEan}
                      onChange={e => setEditEan(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* 2º CÓDIGO DE BARRAS (EMBALAGEM VS SISTEMA) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-[10px] block">
                        2º Código de Barras (Embalagem)
                      </label>
                      <button
                        type="button"
                        onClick={handleScanSecondaryEan}
                        className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Bipar 2º código com a câmera"
                      >
                        <Camera className="w-3 h-3" /> Bipar Embalagem
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: Código impresso na caixa ou pack..."
                        value={editSecondaryEan}
                        onChange={e => setEditSecondaryEan(e.target.value)}
                        className="flex-1 p-2.5 rounded-xl border border-emerald-500/40 focus:border-emerald-500 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Permite bipar tanto o código do sistema quanto o da embalagem nas auditorias!
                    </span>
                  </div>
                </div>
              </div>

              {/* CÓDIGOS AUXILIARES E SETOR */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Código Reduzido (PLU)
                  </label>
                  <input
                    type="text"
                    value={editReducedCode}
                    onChange={e => setEditReducedCode(e.target.value)}
                    placeholder="Ex: RED-101"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Código de Fornecedor
                  </label>
                  <input
                    type="text"
                    value={editSupplierCode}
                    onChange={e => setEditSupplierCode(e.target.value)}
                    placeholder="Ex: FORN-5520"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Setor da Loja *
                  </label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  >
                    {SETORES_DISPONIVEIS.map(setor => (
                      <option key={setor} value={setor}>{setor}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* QUANTIDADE E ESTOQUE MÍNIMO */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Quantidade em Estoque *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editStock}
                    onChange={e => setEditStock(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-emerald-600 dark:text-emerald-400"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Estoque Mínimo (Alerta Ruptura) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editMinStock}
                    onChange={e => setEditMinStock(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-amber-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block mb-1">
                    Localização na Loja
                  </label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={e => setEditLocation(e.target.value)}
                    placeholder="Ex: Corredor 04 - Prateleira B"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Botões do Formulário de Edição */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar & Desbloquear
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Rodapé no Modo de Visualização */}
        {!isEditing && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Operador conectado: <strong>{operatorIdentifier}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={isLockedByOther}
                onClick={handleStartEdit}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={isLockedByOther ? `Bloqueado por ${product.lockedBy}` : 'Editar produto'}
              >
                <Edit3 className="w-4 h-4" />
                <span>Editar Produto</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
