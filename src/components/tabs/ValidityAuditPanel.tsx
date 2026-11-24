import { ValidityModalFrame } from '../modals/ValidityModalFrame';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Barcode, CalendarClock, Camera, Check, Play, Plus, ShieldCheck, Tag } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SETORES_DISPONIVEIS, type Product } from '../../types';
import { readValidityCounts, saveValidityCount, type ValidityCount } from '../../services/validityAudit';

const field = 'w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

export function ValidityAuditPanel() {
  const { products, currentUser, operator, openScanner, setActiveTab, isScannerOpen } = useApp();
  const store = currentUser?.loja_id || '';
  const input = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const [selectedSector, setSelectedSector] = useState('');
  const [activeSector, setActiveSector] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [confirmed, setConfirmed] = useState<Set<string>>(() => new Set());
  const [list, setList] = useState<'pending' | 'confirmed'>('pending');
  const [visibleCount, setVisibleCount] = useState(30);
  const sectorProductCounts = new Map<string, number>();
  for (const item of products) {
    if (item.loja_id !== store) continue;
    const sector = item.category?.trim().toUpperCase();
    if (sector) sectorProductCounts.set(sector, (sectorProductCounts.get(sector) ?? 0) + 1);
  }
  const restriction = operator.setor_restrito?.trim().toUpperCase();
  const canUseAllSectors = ['gerente', 'adm', 'saas_admin'].includes(operator.role || '') ||
    !restriction || restriction === 'TODOS' || restriction === 'GERAL';
  const sectors = [...new Set([...SETORES_DISPONIVEIS, ...sectorProductCounts.keys()])]
    .filter(sector => !['TODOS', 'GERAL'].includes(sector) && (canUseAllSectors || sector === restriction));
  if (restriction && !canUseAllSectors && !sectors.includes(restriction)) sectors.push(restriction);
  const sector = sectors.includes(selectedSector) ? selectedSector : sectors.find(name => sectorProductCounts.has(name)) ?? sectors[0];
  const sectorCount = sectorProductCounts.get(sector) ?? 0;
  const activeProducts = activeSector ? products.filter(item => item.loja_id === store &&
    item.category?.trim().toUpperCase() === activeSector) : [];
  const confirmedCount = activeProducts.filter(item => confirmed.has(item.id)).length;
  const progress = activeProducts.length ? Math.round(confirmedCount / activeProducts.length * 100) : 0;
  const visibleProducts = activeProducts.filter(item => confirmed.has(item.id) === (list === 'confirmed'));
  const [code, setCode] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [counts, setCounts] = useState<ValidityCount[] | null>(null);
  const [date, setDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const previous = counts?.find(count => count.expires_on === date)?.quantity ?? 0;

  useEffect(() => {
    if (activeSector && !product && !isScannerOpen) input.current?.focus();
  }, [activeSector, product, isScannerOpen]);

  useEffect(() => {
    if (!product) return;
    let active = true;
    readValidityCounts(store, product.id).then(rows => {
      if (active) setCounts(rows);
    }).catch(() => {
      if (active) setError('Não foi possível consultar as validades do produto. Feche e bipe novamente.');
    });
    return () => { active = false; };
  }, [product, store]);

  const identify = (value: string) => {
    const normalize = (code?: string) => (code || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
    const scanned = normalize(value);
    if (!activeSector || !scanned) return;
    const matches = activeProducts.filter(item =>
      [item.ean, item.secondaryEan, item.reducedCode].some(identifier => normalize(identifier) === scanned));
    setCode('');
    setError('');
    setMessage('');
    if (matches.length !== 1) {
      setError(matches.length ? 'Código associado a mais de um produto. Confira o código da embalagem.' : 'Produto não encontrado no setor desta auditoria.');
      return;
    }
    setDate('');
    setQuantity('');
    setCounts(null);
    setProduct(matches[0]);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!product || !counts || savingRef.current) return;
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000000 || !date) return;
    const form = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    const mode = form.get('mode');
    if (previous && mode !== 'add' && mode !== 'replace') {
      setError('Escolha se deseja somar unidades ou corrigir o total desta data.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const saved = await saveValidityCount(store, product.id, date, amount, previous, mode === 'add');
      if (!saved) {
        setCounts(null);
        const latest = await readValidityCounts(store, product.id);
        setCounts(latest);
        setError('A quantidade mudou durante a conferência. Confira o novo total antes de salvar.');
        return;
      }
      setConfirmed(current => new Set([...current, product.id]));
      setMessage(`Validade de ${product.name} salva.`);
      setProduct(null);
    } catch {
      setError('Não foi possível confirmar o salvamento. Confira a conexão e o total registrado antes de tentar novamente.');
      try { setCounts(await readValidityCounts(store, product.id)); } catch { setCounts(null); }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!activeSector) {
    return (
      <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="rounded-2xl bg-amber-500/15 p-2.5 text-amber-600"><CalendarClock className="h-6 w-6" /></div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Iniciar Auditoria de Validade</h3>
            <p className="text-xs text-slate-500">Selecione o setor da loja para conferir as datas de validade.</p>
          </div>
        </header>
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              <Tag className="h-4 w-4 text-amber-500" /> Selecione o setor para auditar
            </h4>
            {sector && <span className="text-[11px] font-bold text-amber-700">{sector} ({sectorCount} produtos)</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {sectors.map(name => (
              <button key={name} type="button" aria-pressed={sector === name} onClick={() => setSelectedSector(name)}
                className={`flex flex-col items-center justify-center gap-1 break-all rounded-2xl border p-3 text-center text-xs font-black transition-all ${
                  sector === name ? 'border-amber-600 bg-amber-500 text-slate-950 shadow-md shadow-amber-600/30 ring-2 ring-amber-500/30' :
                    'border-slate-200 bg-slate-50 text-slate-700 hover:border-amber-500/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                <span>{name}</span>
                <span className={`text-[10px] font-semibold ${sector === name ? 'text-amber-100' : 'text-slate-500'}`}>
                  {sectorProductCounts.get(name) ?? 0} itens
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h4 className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
              <ShieldCheck className="h-4 w-4 text-amber-500" /> Conferência de validade
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {sectorCount ? 'Bipe os produtos do setor e informe a validade e a quantidade encontrada.' :
                'O setor precisa ter produtos cadastrados para iniciar a auditoria.'}
            </p>
          </div>
          <button type="button" disabled={!store || !sectorCount} onClick={() => {
            setConfirmed(new Set());
            setList('pending');
            setVisibleCount(30);
            setStartedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
            setActiveSector(sector);
          }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/25 transition hover:bg-amber-600 disabled:opacity-50">
            <Play className="h-4 w-4" /> Iniciar Auditoria de Validade
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-amber-500 motion-safe:animate-pulse" />
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Auditoria de Validade Ativa · Setor {activeSector}</h3>
            <p className="text-[11px] text-slate-500">Início: {startedAt} · Auditor: {operator.name || 'Operador'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondary} onClick={() => input.current?.focus()}><Barcode size={14} /> Coletor pronto</button>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-600"
            onClick={() => { setActiveSector(''); setCode(''); setMessage(''); setError(''); }}><Check size={16} /> Concluir conferência</button>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Total do setor', value: activeProducts.length, color: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800' },
          { label: 'Conferidos', value: confirmedCount, color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
          { label: 'Pendentes', value: activeProducts.length - confirmedCount, color: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl border p-2 sm:p-3 ${color}`}>
            <dt className="text-[10px] font-bold uppercase">{label}</dt>
            <dd className="text-xl font-black">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-bold text-slate-500"><span>Progresso da conferência</span><span>{progress}% auditado</span></div>
        <progress aria-label="Progresso da conferência" max={100} value={progress} className="h-3 w-full accent-emerald-600" />
      </div>
      <form className="space-y-2" onSubmit={event => { event.preventDefault(); identify(code); }}>
        <label htmlFor="validity-scan" className="text-sm font-semibold">Código do produto</label>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <input id="validity-scan" ref={input} value={code} onChange={event => setCode(event.target.value)}
            onKeyDown={event => { if (event.key === 'Tab' && code) { event.preventDefault(); identify(code); } }}
            inputMode="none" autoComplete="off" placeholder="Bipe com o coletor (Enter ou Tab)" className={field + ' col-span-2 sm:flex-1'} />
          <button type="submit" className={primary}><Barcode size={16} /> Identificar</button>
          <button type="button" onClick={() => openScanner(identify, { cameraOnly: true })}
            className={secondary}><Camera size={16} /> Câmera</button>
        </div>
      </form>
      <button type="button" onClick={() => setActiveTab('validade')} className="text-sm font-bold text-emerald-700">Ver produtos em Validade</button>
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      {error && !product && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={list === 'pending'} className={list === 'pending' ? primary : secondary} onClick={() => { setList('pending'); setVisibleCount(30); }}>Pendentes</button>
          <button type="button" aria-pressed={list === 'confirmed'} className={list === 'confirmed' ? primary : secondary} onClick={() => { setList('confirmed'); setVisibleCount(30); }}>Conferidos</button>
        </div>
        {visibleProducts.length ? (
          <ul className="space-y-1.5">
            {visibleProducts.slice(0, visibleCount).map(item => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
                <span className="font-bold">{item.name}</span><span className="font-mono text-slate-500">{item.ean}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-slate-500">{list === 'pending' ? 'Todos os produtos do setor foram conferidos.' : 'Nenhum produto conferido nesta auditoria.'}</p>}
        {visibleCount < visibleProducts.length && <button type="button" className={secondary} onClick={() => setVisibleCount(count => count + 30)}>Mostrar mais</button>}
      </div>
      {product && (
        <ValidityModalFrame title="Lançar Novo Lote" description="Conferência de validade" busy={saving}
          onClose={() => { setProduct(null); setError(''); }}>
          <form onSubmit={save}
            onKeyDown={event => {
              if (previous > 0 && event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
                event.preventDefault();
              }
            }}
            className="mt-4 space-y-3.5">
            <div>
              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Produto</span>
              <p className={field}>{product.name}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800">
              <div><dt className="text-slate-500 dark:text-slate-400">Código de barras</dt><dd className="break-all font-mono font-bold">{product.ean || '—'}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Código reduzido</dt><dd className="break-all font-mono font-bold">{product.reducedCode || '—'}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Quantidade em estoque</dt><dd className="font-bold">{product.stock}</dd></div>
            </dl>
            <div className="grid grid-cols-2 gap-2.5">
            <label className="block text-[11px] font-bold uppercase text-slate-500">Data de Vencimento
              <input autoFocus type="date" required value={date} onChange={event => setDate(event.target.value)} className={field} />
            </label>
            <label className="block text-[11px] font-bold uppercase text-slate-500">Quantidade encontrada
              <input type="number" min={1} max={10000000} required value={quantity} onChange={event => setQuantity(event.target.value)} className={field} />
            </label>
            </div>
            {previous > 0 && <p className="text-sm">Já registradas nesta data: <strong>{previous} unidades</strong>.</p>}
            {previous > 0 && Number(quantity) === previous && <p className="text-sm text-amber-800">Essa mesma quantidade já está registrada. Some somente se forem unidades adicionais.</p>}
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" disabled={saving} className={secondary + ' flex-1'} onClick={() => { setProduct(null); setError(''); }}>Cancelar</button>
              {previous > 0 ? (
                <>
                  <button disabled={saving || !counts} name="mode" value="replace" className={secondary}>Corrigir total</button>
                  <button disabled={saving || !counts} name="mode" value="add" className={primary}>Somar unidades</button>
                </>
              ) : <button disabled={saving || !counts} name="mode" value="save" className={primary + ' flex-1'}><Plus size={16} />{saving ? 'Salvando…' : 'Registrar Lote'}</button>}
            </div>
          </form>
        </ValidityModalFrame>
      )}
    </section>
  );
}
