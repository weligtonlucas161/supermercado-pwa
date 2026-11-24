import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Calendar, Tag, Check, Filter } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatValidityDate, readValidityCounts, type ValidityCount } from '../../services/validityAudit';
import { NewValidityModal } from '../modals/NewValidityModal';

export const ValidadeTab: React.FC = () => {
  const { validities, darkMode, applyDiscount, storeColor, products, currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'urgent' | 'warning' | 'ok'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const store = currentUser?.loja_id || '';
  const auditScope = JSON.stringify([store, currentUser?.id, currentUser?.setor, currentUser?.cargo]);
  const [auditResults, setAuditResults] = useState<{ scope: string; rows: ValidityCount[]; error?: boolean } | null>(null);
  useEffect(() => {
    if (!store) return;
    let active = true;
    readValidityCounts(store).then(rows => {
      if (active) setAuditResults({ scope: auditScope, rows });
    }).catch(() => {
      if (active) setAuditResults({ scope: auditScope, rows: [], error: true });
    });
    return () => { active = false; };
  }, [store, auditScope]);

  const auditCards = useMemo(() => {
    if (!auditResults || auditResults.scope !== auditScope) return [];
    const grouped = new Map<string, ValidityCount[]>();
    for (const count of auditResults.rows) {
      const rows = grouped.get(count.product_id);
      if (rows) rows.push(count);
      else grouped.set(count.product_id, [count]);
    }
    const today = new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return products.flatMap(product => {
      const rows = product.loja_id === store ? grouped.get(product.id) : undefined;
      if (!rows?.length) return [];
      const days = (Date.parse(rows[0].expires_on) - todayUtc) / 86400000;
      const status = days < 5 ? 'urgent' : days < 15 ? 'warning' : 'ok';
      const term = searchTerm.trim().toLowerCase();
      if ((filter !== 'all' && filter !== status) ||
          ![product.name, product.ean, product.reducedCode ?? ''].some(value => value.toLowerCase().includes(term))) return [];
      return [{ product, rows, days, total: rows.reduce((sum, row) => sum + row.quantity, 0) }];
    }).sort((a, b) => a.days - b.days);
  }, [auditResults, auditScope, store, products, filter, searchTerm]);

  const filtered = validities.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batch.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === 'urgent') return matchesSearch && item.status === 'urgent';
    if (filter === 'warning') return matchesSearch && item.status === 'warning';
    if (filter === 'ok') return matchesSearch && item.status === 'ok';
    return matchesSearch;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: storeColor }}
              aria-hidden="true"
            />
            Controle de Validades
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitore lotes críticos para agir preventivamente antes do vencimento.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo Lote</span>
        </button>
      </div>

      {/* Busca e Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por produto, código ou lote..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-4 py-2.5 rounded-2xl text-xs border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
              darkMode
                ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500'
                : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-800 placeholder:text-slate-400'
            }`}
          />
        </div>
        <div className="relative">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
            className={`px-3 py-2.5 rounded-2xl text-xs border focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-700'
            }`}
          >
            <option value="all">Todos os status</option>
            <option value="urgent">Urgentes (&lt; 5 dias)</option>
            <option value="warning">Atenção (&lt; 15 dias)</option>
            <option value="ok">Regulares (&gt; 15 dias)</option>
          </select>
        </div>
      </div>

      {/* Lista de Validades */}
      <div className="space-y-2.5">
        {store && auditResults?.scope !== auditScope && <p role="status" className="text-sm text-slate-500">Carregando validades conferidas…</p>}
        {store && auditResults?.scope === auditScope && auditResults.error && <p role="alert" className="text-sm text-rose-700">Não foi possível consultar as validades conferidas.</p>}
        {auditCards.map(({ product, rows, days, total }) => (
          <details key={product.id} className="rounded-2xl border border-slate-200 bg-white p-3.5">
            <summary className="cursor-pointer text-sm font-bold text-slate-900">
              {product.name}
              <span className="ml-2 text-xs font-normal text-slate-600">{total} unidades conferidas · {rows.length} {rows.length === 1 ? 'validade' : 'validades'}</span>
              <p className={`mt-1 text-xs ${days < 5 ? 'text-rose-700' : days < 15 ? 'text-amber-800' : 'text-slate-600'}`}>
                {days < 0 ? 'Validade vencida' : 'Validade mais próxima'} {formatValidityDate(rows[0].expires_on)}
              </p>
            </summary>
            <table className="mt-3 w-full border-t border-slate-200 text-left text-xs">
              <thead><tr><th className="py-2" scope="col">Validade</th><th className="py-2" scope="col">Unidades conferidas</th></tr></thead>
              <tbody>
                {rows.map(row => <tr key={row.expires_on}><td className="py-1">{formatValidityDate(row.expires_on)}</td><td className="py-1">{row.quantity}</td></tr>)}
              </tbody>
            </table>
          </details>
        ))}
        {filtered.length === 0 && auditCards.length === 0 && (!store || (auditResults?.scope === auditScope && !auditResults.error)) ? (
          <div className="text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nenhum lote encontrado</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Tente alterar o filtro ou cadastre um novo lote.</p>
          </div>
        ) : (
          filtered.map(item => (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-200'
              } shadow-xs hover:border-emerald-500/40`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    item.status === 'urgent'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : item.status === 'warning'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.name}</h4>
                    {item.discountApplied && (
                      <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        Remarcado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span className="font-mono">Lote: {item.batch}</span>
                    <span>•</span>
                    <span>Saldo: {item.quantity} un</span>
                  </div>
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-1">
                <div
                  className={`text-xs font-bold ${
                    item.status === 'urgent'
                      ? 'text-rose-600 dark:text-rose-400'
                      : item.status === 'warning'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  Vence: {item.dueDate}
                </div>
                {item.status === 'urgent' && !item.discountApplied ? (
                  <button
                    onClick={() => applyDiscount(item.id, 30)}
                    className="text-[10px] font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 transition"
                  >
                    <Tag className="w-3 h-3" /> Aplicar -30%
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400">
                    {item.status === 'urgent' ? 'Crítico (&lt; 5 dias)' : item.status === 'warning' ? 'Atenção' : 'Regular'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <NewValidityModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
