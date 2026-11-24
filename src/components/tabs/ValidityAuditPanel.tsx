import { OperationsPanelHeader } from '../common/OperationsPanelHeader';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Barcode, CalendarClock, Camera, Play, ShieldCheck, Tag, X } from 'lucide-react';
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
    const matches = products.filter(item => item.loja_id === store && item.category?.trim().toUpperCase() === activeSector &&
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
        <OperationsPanelHeader icon={CalendarClock} title="Iniciar Nova Auditoria de Validade"
          description="Selecione o setor da loja para conferir as datas de validade dos produtos." />
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              <Tag className="h-4 w-4 text-emerald-500" /> Selecione o setor para auditar
            </h4>
            {sector && <span className="text-[11px] font-bold text-emerald-700">{sector} ({sectorCount} produtos)</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {sectors.map(name => (
              <button key={name} type="button" aria-pressed={sector === name} onClick={() => setSelectedSector(name)}
                className={`flex flex-col items-center justify-center gap-1 break-all rounded-2xl border p-3 text-center text-xs font-black transition-all ${
                  sector === name ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/30' :
                    'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-500/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                <span>{name}</span>
                <span className={`text-[10px] font-semibold ${sector === name ? 'text-emerald-100' : 'text-slate-500'}`}>
                  {sectorProductCounts.get(name) ?? 0} itens
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h4 className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Conferência de validade
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {sectorCount ? 'Bipe os produtos do setor e informe a validade e a quantidade encontrada.' :
                'O setor precisa ter produtos cadastrados para iniciar a auditoria.'}
            </p>
          </div>
          <button type="button" disabled={!store || !sectorCount} onClick={() => setActiveSector(sector)}
            className={primary + ' shrink-0'}>
            <Play className="h-4 w-4" /> Iniciar Auditoria de Validade
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <OperationsPanelHeader icon={CalendarClock} title="Auditoria de Validade" description={`Setor em conferência: ${activeSector}`} />
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
      <button type="button" disabled={Boolean(product)} className={secondary + ' ml-2'} onClick={() => {
        setActiveSector('');
        setCode('');
        setMessage('');
        setError('');
      }}>Encerrar conferência</button>
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      {error && !product && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {product && (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/50 p-4">
          <form role="dialog" aria-modal="true" aria-labelledby="validity-product" onSubmit={save}
            onKeyDown={event => {
              if (previous > 0 && event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
                event.preventDefault();
              }
            }}
            className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-white">
            <div className="flex justify-between gap-2">
              <h4 id="validity-product" className="font-bold">{product.name}</h4>
              <button type="button" aria-label="Fechar" disabled={saving} onClick={() => { setProduct(null); setError(''); }}><X size={20} /></button>
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800">
              <div><dt className="text-slate-500 dark:text-slate-400">Código de barras</dt><dd className="break-all font-mono font-bold">{product.ean || '—'}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Código reduzido</dt><dd className="break-all font-mono font-bold">{product.reducedCode || '—'}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Quantidade em estoque</dt><dd className="font-bold">{product.stock}</dd></div>
            </dl>
            <label className="block text-sm font-semibold">Data de validade
              <input autoFocus type="date" required value={date} onChange={event => setDate(event.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold">Quantidade encontrada
              <input type="number" min={1} max={10000000} required value={quantity} onChange={event => setQuantity(event.target.value)} className={field} />
            </label>
            {previous > 0 && <p className="text-sm">Já registradas nesta data: <strong>{previous} unidades</strong>.</p>}
            {previous > 0 && Number(quantity) === previous && <p className="text-sm text-amber-800">Essa mesma quantidade já está registrada. Some somente se forem unidades adicionais.</p>}
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex flex-wrap gap-2">
              {previous > 0 ? (
                <>
                  <button disabled={saving || !counts} name="mode" value="replace" className={secondary}>Corrigir total</button>
                  <button disabled={saving || !counts} name="mode" value="add" className={primary}>Somar unidades</button>
                </>
              ) : <button disabled={saving || !counts} name="mode" value="save" className={primary}>{saving ? 'Salvando…' : 'Salvar validade'}</button>}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
