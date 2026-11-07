import React, { useState } from 'react';
import { ClipboardCheck, Plus, Check, Play, Barcode, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NewAuditModal } from '../modals/NewAuditModal';
import { triggerScanBeep } from '../../utils/haptics';

export const AuditoriaTab: React.FC = () => {
  const { audits, products, darkMode, openScanner, operator } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [collectorActive, setCollectorActive] = useState(false);
  const [countedItems, setCountedItems] = useState<{ [productId: string]: number }>({});
  const [sessionNotes, setSessionNotes] = useState('');

  const handleStartCounting = () => {
    setCountedItems({});
    setCollectorActive(true);
    triggerScanBeep(true);
  };

  const handleIncrementCount = (productId: string) => {
    setCountedItems(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }));
    triggerScanBeep(true);
  };

  const handleFinishCollector = () => {
    setCollectorActive(false);
    triggerScanBeep(true);
  };

  const handleScanCollectorItem = () => {
    openScanner((ean) => {
      const found = products.find(p => p.ean === ean);
      if (found) {
        handleIncrementCount(found.id);
      }
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Auditoria de Loja
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Conferência física de estoque e conciliação de rupturas.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nova Auditoria</span>
        </button>
      </div>

      {/* Seção Coletor de Dados / Modo Contagem Física */}
      {!collectorActive ? (
        <div
          className={`p-5 rounded-3xl border border-dashed ${
            darkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-300'
          } text-center space-y-2.5`}
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Pronto para iniciar uma contagem física?
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Use o smartphone ou coletor para bipear os produtos na gôndola e apurar sobras ou faltas em tempo real.
          </p>
          <button
            onClick={handleStartCounting}
            className="mt-2 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition"
          >
            <Play className="w-4 h-4" /> Abrir Coletor de Dados PWA
          </button>
        </div>
      ) : (
        /* Coletor Ativo */
        <div className="p-4 sm:p-5 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
              <h3 className="font-bold text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                Coletor Operacional em Execução
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleScanCollectorItem}
                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Barcode className="w-4 h-4 text-emerald-400" /> Bipar Item
              </button>
              <button
                onClick={handleFinishCollector}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
              >
                Concluir
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {products.slice(0, 5).map(p => {
              const count = countedItems[p.id] || 0;
              const diff = count - p.stock;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between ${
                    darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">{p.name}</h5>
                    <p className="text-[11px] text-slate-400">
                      Sistema: {p.stock} un • Físico: <strong>{count} un</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {count > 0 && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          diff === 0
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-rose-500/10 text-rose-600'
                        }`}
                      >
                        {diff === 0 ? 'Conferido' : diff > 0 ? `+${diff} sobra` : `${diff} falta`}
                      </span>
                    )}
                    <button
                      onClick={() => handleIncrementCount(p.id)}
                      className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                    >
                      +1 Bip
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Histórico de Auditorias */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Histórico de Auditorias
        </h3>
        <div className="space-y-2.5">
          {audits.map(audit => (
            <div
              key={audit.id}
              className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
              } shadow-xs`}
            >
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">{audit.title}</h4>
                <p className="text-[11px] text-slate-400">
                  Data: {audit.date} • Auditor: {audit.auditor}
                  {audit.department && ` • Setor: ${audit.department}`}
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    audit.status === 'Concluída'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {audit.status}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  {audit.itemsCount} itens validados
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <NewAuditModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
