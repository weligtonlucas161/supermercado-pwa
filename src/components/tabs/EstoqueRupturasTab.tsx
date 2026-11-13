import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  Barcode,
  Boxes,
  CheckCircle2,
  Package,
  PackageCheck,
  PackageX,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { triggerScanBeep } from '../../utils/haptics';

type Severidade = 'zerado' | 'critico' | 'atencao';

/**
 * INTERFACE DE RUPTURAS (ESTOQUE CRÍTICO)
 *
 * Tema LARANJA: foco em URGÊNCIA. Responde "esse produto ainda está na
 * gôndola ou acabou?" — quem está zerado e quem está no limite de segurança.
 */
export const EstoqueRupturasTab: React.FC = () => {
  const { products, updateProductStock, addAvaria, operator, openScanner, darkMode } = useApp();

  const [busca, setBusca] = useState('');
  const [setorFiltro, setSetorFiltro] = useState('all');
  const [ordenarPor, setOrdenarPor] = useState<'criticidade' | 'quantidade' | 'nome'>('criticidade');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ---------------------------------------------------------------------
  // Classificação por severidade
  // ---------------------------------------------------------------------
  const classificar = (p: Product): Severidade => {
    if (p.stock <= 0) return 'zerado';
    if (p.stock <= p.minStock) return 'critico';
    return 'atencao';
  };

  const rupturaProducts = useMemo(() => {
    const lista = products.filter(p => p.stock <= p.minStock || p.stock === 0);

    const filtrada = lista.filter(p => {
      const termo = busca.toLowerCase().trim();
      const bateSetor = setorFiltro === 'all' || p.category === setorFiltro;
      if (!termo) return bateSetor;
      return (
        bateSetor &&
        (p.name.toLowerCase().includes(termo) ||
          p.ean.includes(termo) ||
          (p.reducedCode ? p.reducedCode.toLowerCase().includes(termo) : false) ||
          (p.supplierCode ? p.supplierCode.toLowerCase().includes(termo) : false))
      );
    });

    const peso: Record<Severidade, number> = { zerado: 0, critico: 1, atencao: 2 };
    return [...filtrada].sort((a, b) => {
      if (ordenarPor === 'quantidade') return a.stock - b.stock;
      if (ordenarPor === 'nome') return a.name.localeCompare(b.name, 'pt-BR');
      const pa = peso[classificar(a)];
      const pb = peso[classificar(b)];
      if (pa !== pb) return pa - pb;
      return a.stock - b.stock;
    });
  }, [products, busca, setorFiltro, ordenarPor]);

  const contagens = useMemo(() => {
    const zerados = products.filter(p => p.stock <= 0).length;
    const criticos = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
    const atencao = products.filter(p => p.stock > p.minStock && p.stock <= p.minStock * 1.5).length;
    return { zerados, criticos, atencao, total: zerados + criticos };
  }, [products]);

  const unidadesCriticas = useMemo(
    () =>
      rupturaProducts
        .filter(p => p.stock <= p.minStock)
        .reduce((acc, p) => acc + Math.max(0, p.minStock - p.stock), 0),
    [rupturaProducts]
  );

  const setores = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [products]);

  const biparProduto = () => {
    openScanner((codigo) => {
      setBusca(codigo);
    });
  };

  const confirmarViaBip = (product: Product, acao: 'avaria' | 'nao_ruptura') => {
    setFeedback(null);
    openScanner(async (codigoBipado) => {
      const limpo = codigoBipado.replace(/[^0-9A-Za-z]/g, '').trim().toLowerCase();
      const corresponde =
        limpo !== '' &&
        (product.ean.toLowerCase() === limpo ||
          (product.secondaryEan ? product.secondaryEan.toLowerCase() === limpo : false) ||
          (product.reducedCode ? product.reducedCode.toLowerCase() === limpo : false));

      if (!corresponde) {
        triggerScanBeep(false);
        setFeedback({
          type: 'error',
          text: `Bip inválido para "${product.name}". Código esperado: ${product.ean}. Confirmação cancelada.`,
        });
        return;
      }

      if (acao === 'avaria') {
        await addAvaria({
          loja_id: operator.loja_id || product.loja_id || '',
          codigo_barras: product.ean,
          codigo_reduzido: product.reducedCode || undefined,
          produto_nome: product.name,
          quantidade: 1,
          tipo_avaria: 'Outro',
          para_troca: true,
          setor: product.category || 'Estoque',
          registrado_por_nome: operator.name || 'Operador',
          registrado_por_matricula: operator.code || '',
        });
        setFeedback({
          type: 'success',
          text: `Avaria confirmada via bip para "${product.name}".`,
        });
      } else {
        updateProductStock(product.id, { exact: Math.max(product.stock, product.minStock + 1) });
        triggerScanBeep(true);
        setFeedback({
          type: 'success',
          text: `"${product.name}" confirmado via bip como Não é ruptura.`,
        });
      }
    });
  };

  const cardBase = darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200';

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ============================ CABEÇALHO ============================ */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/25 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Rupturas e Estoque Crítico
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500 text-white uppercase tracking-wide">
                {contagens.total} {contagens.total === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Reposição prioritária: o que acabou ou está no limite de segurança.
            </p>
          </div>
        </div>
      </div>

      {/* ============================ INDICADORES ============================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className={`p-3.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 shadow-xs`}>
          <div className="text-[10px] font-black uppercase tracking-wide text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <PackageX className="w-3.5 h-3.5" /> Zerados
          </div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-0.5">
            {contagens.zerados}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Produto fora da gôndola</div>
        </div>

        <div className={`p-3.5 rounded-2xl border border-orange-500/40 bg-orange-500/10 shadow-xs`}>
          <div className="text-[10px] font-black uppercase tracking-wide text-orange-600 dark:text-orange-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> Críticos
          </div>
          <div className="text-2xl font-black text-orange-700 dark:text-orange-400 mt-0.5">
            {contagens.criticos}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">No limite de segurança</div>
        </div>

        <div className={`p-3.5 rounded-2xl border ${cardBase} shadow-xs`}>
          <div className="text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" /> Atenção
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            {contagens.atencao}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Próximos de romper</div>
        </div>

        <div className={`p-3.5 rounded-2xl border ${cardBase} shadow-xs`}>
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Boxes className="w-3.5 h-3.5" /> Repor
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            {unidadesCriticas}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Unidades para o mínimo</div>
        </div>
      </div>

      {/* ======================= ALERTA DE RUPTURA TOTAL ======================= */}
      {contagens.zerados > 0 && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-rose-500/15 via-orange-500/10 to-amber-500/10 border-2 border-rose-500/40 shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-2.5 rounded-2xl bg-rose-600 text-white shadow-sm shrink-0">
            <PackageX className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-sm text-slate-900 dark:text-white">
              {contagens.zerados} {contagens.zerados === 1 ? 'produto zerado' : 'produtos zerados'} na gôndola
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Clientes procurando esses produtos não vão encontrar. Reponha ou acione o fornecedor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOrdenarPor('criticidade')}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] transition shadow-xs shrink-0 cursor-pointer"
          >
            Ver primeiro
          </button>
        </div>
      )}

      {/* ============================ FILTROS ============================ */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Barcode className="w-4 h-4 absolute left-3 top-3 text-orange-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, EAN, cód. reduzido ou fornecedor..."
            className={`w-full pl-9 pr-4 py-2.5 rounded-2xl text-xs border transition focus:outline-none focus:ring-2 focus:ring-orange-500 ${
              darkMode
                ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <ArrowDownUp className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
            <select
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value as typeof ordenarPor)}
              className={`w-full sm:w-auto pl-8 pr-3 py-2.5 rounded-2xl text-xs font-bold border transition focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <option value="criticidade">Criticidade</option>
              <option value="quantidade">Menor saldo</option>
              <option value="nome">Nome (A-Z)</option>
            </select>
          </div>

          <button
            onClick={biparProduto}
            className={`p-2.5 rounded-2xl border transition flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Bipar código de barras para localizar o produto"
          >
            <Barcode className="w-5 h-5 text-orange-500" />
            <span className="hidden sm:inline">Bipar</span>
          </button>
        </div>
      </div>

      {/* Setores */}
      {setores.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {setores.map(s => (
            <button
              key={s}
              onClick={() => setSetorFiltro(s)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                setorFiltro === s
                  ? 'bg-orange-500 text-white shadow-sm'
                  : darkMode
                  ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'Todos os Setores' : s}
            </button>
          ))}
        </div>
      )}

      {/* ============================ FEEDBACK DE BIP ============================ */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-semibold">{feedback.text}</span>
        </div>
      )}

      {/* ============================ LISTA ============================ */}
      <div className="space-y-2.5">
        {rupturaProducts.length === 0 ? (
          <div className="text-center py-12 rounded-3xl border border-dashed border-orange-200 dark:border-orange-900/40 bg-orange-500/5">
            <Package className="w-8 h-8 text-orange-300 dark:text-orange-800 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Nenhuma ruptura encontrada
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {products.length === 0
                ? 'Importe a planilha de estoque para começar a monitorar.'
                : 'Todo o estoque está acima do limite de segurança.'}
            </p>
          </div>
        ) : (
          rupturaProducts.map(product => (
            <RupturaCard
              key={product.id}
              product={product}
              severidade={classificar(product)}
              darkMode={darkMode}
              onConfirmAvaria={() => confirmarViaBip(product, 'avaria')}
              onConfirmNaoRuptura={() => confirmarViaBip(product, 'nao_ruptura')}
            />
          ))
        )}
      </div>
    </div>
  );
};

/**
 * Cartão de produto em ruptura, com confirmação obrigatória via bip para Avaria ou Não é ruptura.
 */
const RupturaCard: React.FC<{
  product: Product;
  severidade: Severidade;
  darkMode: boolean;
  onConfirmAvaria: () => void;
  onConfirmNaoRuptura: () => void;
}> = ({ product, severidade, darkMode, onConfirmAvaria, onConfirmNaoRuptura }) => {
  const falta = Math.max(0, product.minStock - product.stock);
  const pct = product.minStock > 0 ? Math.min(100, Math.round((product.stock / product.minStock) * 100)) : 0;

  const tema =
    severidade === 'zerado'
      ? {
          badge: 'bg-rose-600 text-white',
          texto: 'text-rose-600 dark:text-rose-400',
          barra: 'bg-rose-500',
          borda: 'border-rose-500/40',
          rotulo: 'ZERADO',
        }
      : severidade === 'critico'
      ? {
          badge: 'bg-orange-500 text-white',
          texto: 'text-orange-600 dark:text-orange-400',
          barra: 'bg-orange-500',
          borda: 'border-orange-500/40',
          rotulo: 'CRÍTICO',
        }
      : {
          badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30',
          texto: 'text-amber-600 dark:text-amber-400',
          barra: 'bg-amber-500',
          borda: 'border-amber-500/30',
          rotulo: 'ATENÇÃO',
        };

  return (
    <div
      className={`rounded-2xl border ${tema.borda} ${
        darkMode ? 'bg-slate-800/90' : 'bg-white'
      } shadow-xs overflow-hidden`}
    >
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide ${tema.badge}`}>
                {tema.rotulo}
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{product.name}</h4>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-1 flex-wrap">
              <span>EAN: {product.ean}</span>
              {product.reducedCode && <span>• Red: {product.reducedCode}</span>}
              {product.supplierCode && <span>• Forn: {product.supplierCode}</span>}
              {product.category && <span className="font-sans">• {product.category}</span>}
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className={`text-xl font-black ${tema.texto}`}>
              {product.stock} <span className="text-[10px] font-normal text-slate-400">un</span>
            </div>
            <div className="text-[10px] text-slate-400">Mín: {product.minStock}</div>
          </div>
        </div>

        {/* Barra de nível de estoque */}
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full ${tema.barra} transition-all duration-500`}
              style={{ width: `${Math.max(pct, product.stock > 0 ? 4 : 0)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
            <span>{pct}% do estoque mínimo</span>
            {falta > 0 && (
              <span className={tema.texto}>
                Faltam {falta} un para o mínimo
              </span>
            )}
          </div>
        </div>

        {/* Ações de Ruptura (confirmação obrigatória via bip) */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
            <Barcode className="w-3.5 h-3.5 text-orange-500" />
            Bip obrigatório para confirmar
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onConfirmAvaria}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <PackageX className="w-3.5 h-3.5" />
              Avaria
            </button>
            <button
              type="button"
              onClick={onConfirmNaoRuptura}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              Não é ruptura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
