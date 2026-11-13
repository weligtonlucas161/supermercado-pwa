import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Barcode,
  Check,
  ChevronDown,
  ClipboardList,
  PackageX,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AvariaItem, TIPOS_AVARIA, TipoAvaria } from '../../types';

/**
 * INTERFACE DE AVARIAS (PERDAS, QUEBRAS E TROCAS)
 *
 * Tema VERMELHO: o objetivo aqui é ficar atento às perdas para reduzi-las.
 * Cada avaria registrada dá baixa no estoque e fica no histórico da loja.
 */
export const EstoqueAvariasTab: React.FC = () => {
  const { products, avarias, addAvaria, openScanner, operator, darkMode } = useApp();

  const [codigoBarras, setCodigoBarras] = useState('');
  const [produtoNome, setProdutoNome] = useState('');
  const [codigoReduzido, setCodigoReduzido] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [tipoAvaria, setTipoAvaria] = useState<TipoAvaria>('Embalagem danificada');
  const [paraTroca, setParaTroca] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [enviando, setEnviando] = useState(false);

  // ---------------------------------------------------------------------
  // Identificação do produto a partir do código de barras
  // ---------------------------------------------------------------------
  const buscarProduto = (codigo: string) => {
    const limpo = codigo.replace(/[^0-9A-Za-z]/g, '').trim();
    if (!limpo) return null;

    const match = products.find(
      p =>
        p.ean === limpo ||
        p.secondaryEan === limpo ||
        (p.ean && p.ean.endsWith(limpo)) ||
        (p.reducedCode && p.reducedCode === limpo)
    );
    return match || null;
  };

  const aoDigitarCodigo = (valor: string) => {
    setCodigoBarras(valor);
    const match = buscarProduto(valor);
    if (match) {
      setProdutoNome(match.name);
      setCodigoReduzido(match.reducedCode || '');
    } else if (valor.replace(/[^0-9A-Za-z]/g, '').trim().length >= 8) {
      // Código válido porém desconhecido: mantém o nome preenchido manualmente
      if (!produtoNome || produtoNome.startsWith('Produto EAN')) {
        setProdutoNome(`Produto EAN ${valor.trim()}`);
      }
    }
  };

  const biparCodigo = () => {
    openScanner((codigo) => {
      aoDigitarCodigo(codigo);
    });
  };

  // ---------------------------------------------------------------------
  // Estatísticas do histórico
  // ---------------------------------------------------------------------
  const stats = useMemo(() => {
    const unidades = avarias.reduce((acc, a) => acc + a.quantidade, 0);
    const trocas = avarias.filter(a => a.para_troca).length;
    const perdas = avarias.filter(a => !a.para_troca).length;
    const porTipo = TIPOS_AVARIA.map(tipo => ({
      tipo,
      total: avarias.filter(a => a.tipo_avaria === tipo).reduce((acc, a) => acc + a.quantidade, 0),
      qtde: avarias.filter(a => a.tipo_avaria === tipo).length,
    }))
      .filter(t => t.qtde > 0)
      .sort((a, b) => b.total - a.total);

    return { unidades, trocas, perdas, porTipo, total: avarias.length };
  }, [avarias]);

  // ---------------------------------------------------------------------
  // Envio do registro
  // ---------------------------------------------------------------------
  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    const codigo = codigoBarras.replace(/[^0-9A-Za-z]/g, '').trim();
    const qtd = Number(quantidade);

    if (!codigo) {
      setErro('Informe ou bipe o código de barras do produto avariado.');
      return;
    }
    if (!qtd || qtd <= 0) {
      setErro('A quantidade avariada deve ser maior que zero.');
      return;
    }
    if (!produtoNome.trim()) {
      setErro('Informe o nome do produto avariado.');
      return;
    }

    setEnviando(true);
    const res = await addAvaria({
      loja_id: operator.loja_id || 'loja_padrao_001',
      codigo_barras: codigo,
      codigo_reduzido: codigoReduzido.trim() || undefined,
      produto_nome: produtoNome.trim(),
      quantidade: qtd,
      tipo_avaria: tipoAvaria,
      para_troca: paraTroca,
      setor: operator.setor_restrito && operator.setor_restrito !== 'TODOS' ? operator.setor_restrito : 'Estoque',
      registrado_por_nome: operator.name || 'Operador',
      registrado_por_matricula: operator.code || '',
    });
    setEnviando(false);

    if (!res.success || !res.data) {
      setErro('Não foi possível registrar a avaria. Tente novamente.');
      return;
    }

    setSucesso(
      res.synced
        ? `Avaria de ${res.data.quantidade}x "${res.data.produto_nome}" registrada e sincronizada com a nuvem.`
        : `Avaria de ${res.data.quantidade}x "${res.data.produto_nome}" salva neste dispositivo. A sincronização com a nuvem está indisponível.`
    );

    // Limpa o formulário para o próximo registro
    setCodigoBarras('');
    setProdutoNome('');
    setCodigoReduzido('');
    setQuantidade('1');
    setTipoAvaria('Embalagem danificada');
    setParaTroca(true);
  };

  const cardBase = darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200';
  const inputBase = `w-full px-3.5 py-2.5 rounded-2xl text-xs border transition focus:outline-none focus:ring-2 focus:ring-rose-500 ${
    darkMode
      ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500'
      : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
  }`;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ============================ CABEÇALHO ============================ */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/25 shrink-0">
            <PackageX className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Registro de Avarias
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white uppercase tracking-wide">
                {stats.total} {stats.total === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Controle de perdas, quebras e trocas para reduzir o desperdício da loja.
            </p>
          </div>
        </div>
      </div>

      {/* ============================ INDICADORES ============================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className={`p-3.5 rounded-2xl border ${cardBase} shadow-xs`}>
          <div className="text-[10px] font-black uppercase tracking-wide text-rose-600 dark:text-rose-400">
            Unidades Avariadas
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            {stats.unidades}
          </div>
        </div>
        <div className={`p-3.5 rounded-2xl border ${cardBase} shadow-xs`}>
          <div className="text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Para Troca
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            {stats.trocas}
          </div>
        </div>
        <div className={`p-3.5 rounded-2xl border ${cardBase} shadow-xs`}>
          <div className="text-[10px] font-black uppercase tracking-wide text-rose-600 dark:text-rose-400">
            Perda Total
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            {stats.perdas}
          </div>
        </div>
        <div className={`p-3.5 rounded-2xl border ${cardBase} shadow-xs`}>
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Tipos Distintos
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            {stats.porTipo.length}
          </div>
        </div>
      </div>

      {/* ======================= FORMULÁRIO DE REGISTRO ======================= */}
      <form
        onSubmit={handleRegistrar}
        className="p-4 rounded-3xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-2 border-rose-500/30 shadow-sm space-y-3.5"
      >
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-2xl bg-rose-600 text-white shadow-sm">
            <AlertOctagon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-white">Nova Avaria</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Registrar a avaria dá baixa automaticamente no estoque do produto.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Código de barras */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Código de Barras *
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 absolute left-3 top-3 text-rose-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={codigoBarras}
                  onChange={(e) => aoDigitarCodigo(e.target.value)}
                  placeholder="7890000000000"
                  className={`${inputBase} pl-9`}
                />
              </div>
              <button
                type="button"
                onClick={biparCodigo}
                className="p-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm shrink-0 cursor-pointer"
                title="Bipar código de barras com a câmera"
              >
                <Barcode className="w-5 h-5" />
              </button>
            </div>
            {produtoNome && produtoNome.startsWith('Produto EAN') && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                Produto não localizado no estoque — confirme o nome abaixo.
              </p>
            )}
          </div>

          {/* Nome do produto */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Produto *
            </label>
            <input
              type="text"
              value={produtoNome}
              onChange={(e) => setProdutoNome(e.target.value)}
              placeholder="Nome do produto avariado"
              className={inputBase}
            />
          </div>

          {/* Quantidade */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Quantidade Avariada *
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantidade((q) => String(Math.max(1, Number(q) - 1)))}
                className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer font-black"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className={`${inputBase} text-center font-black`}
              />
              <button
                type="button"
                onClick={() => setQuantidade((q) => String(Number(q || 0) + 1))}
                className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer font-black"
              >
                +
              </button>
            </div>
          </div>

          {/* Tipo de avaria */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Tipo de Avaria *
            </label>
            <div className="relative">
              <select
                value={tipoAvaria}
                onChange={(e) => setTipoAvaria(e.target.value as TipoAvaria)}
                className={`${inputBase} appearance-none pr-9 cursor-pointer`}
              >
                {TIPOS_AVARIA.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Código reduzido */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
            Código Reduzido (PLU)
          </label>
          <input
            type="text"
            value={codigoReduzido}
            onChange={(e) => setCodigoReduzido(e.target.value)}
            placeholder="Opcional"
            className={`${inputBase} max-w-xs`}
          />
        </div>

        {/* Para troca */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setParaTroca((v) => !v)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition cursor-pointer border ${
              paraTroca
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40'
                : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/40'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-md flex items-center justify-center ${
                paraTroca ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
              }`}
            >
              {paraTroca ? <Check className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
            </span>
            {paraTroca ? 'Sim (Troca com Fornecedor)' : 'Não (Perda Operacional)'}
          </button>
        </div>

        {/* Mensagens */}
        {erro && (
          <div className="flex items-start gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
            <AlertOctagon className="w-4 h-4 shrink-0 mt-px" />
            <span>{erro}</span>
          </div>
        )}
        {sucesso && (
          <div className="flex items-start gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <Check className="w-4 h-4 shrink-0 mt-px" />
            <span>{sucesso}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-60 text-white text-xs font-black transition shadow-md shadow-rose-600/25 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {enviando ? 'Registrando...' : 'Registrar Avaria'}
        </button>
      </form>

      {/* ======================= RESUMO POR TIPO ======================= */}
      {stats.porTipo.length > 0 && (
        <div className="p-4 rounded-3xl border border-rose-500/25 bg-rose-500/5 space-y-2.5">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <h3 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wide">
              Onde o Estoque Está Perdendo
            </h3>
          </div>
          <div className="space-y-1.5">
            {stats.porTipo.map(t => {
              const pct = stats.unidades > 0 ? Math.round((t.total / stats.unidades) * 100) : 0;
              return (
                <div key={t.tipo} className="flex items-center gap-2.5">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 w-40 shrink-0 truncate">
                    {t.tipo}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 w-16 text-right shrink-0">
                    {t.total} un · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================ HISTÓRICO ============================ */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            Histórico de Avarias
          </h3>
          {avarias.length > 0 && (
            <span className="text-[10px] font-bold text-slate-400">
              {avarias.length} {avarias.length === 1 ? 'registro' : 'registros'}
            </span>
          )}
        </div>

        {avarias.length === 0 ? (
          <div className="text-center py-12 rounded-3xl border border-dashed border-rose-200 dark:border-rose-900/40 bg-rose-500/5">
            <PackageX className="w-8 h-8 text-rose-300 dark:text-rose-800 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nenhuma avaria registrada</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Registre perdas, quebras e trocas para acompanhar o desperdício da loja.
            </p>
          </div>
        ) : (
          avarias.map(av => <AvariaCard key={av.id} avaria={av} darkMode={darkMode} />)
        )}
      </div>
    </div>
  );
};

/**
 * Cartão individual de avaria no histórico (tema vermelho).
 */
const AvariaCard: React.FC<{ avaria: AvariaItem; darkMode: boolean }> = ({ avaria, darkMode }) => {
  const [expandido, setExpandido] = useState(false);

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all ${
        darkMode
          ? 'bg-slate-800/90 border-rose-900/50 hover:border-rose-700'
          : 'bg-white border-rose-200 hover:border-rose-300'
      } shadow-xs`}
    >
      <div
        onClick={() => setExpandido(v => !v)}
        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
            <PackageX className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {avaria.produto_nome}
              </h4>
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                  avaria.para_troca
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-600 text-white'
                }`}
              >
                {avaria.para_troca ? 'Troca' : 'Perda'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5 flex-wrap">
              <span>{avaria.quantidade} un</span>
              <span>•</span>
              <span className="text-rose-600 dark:text-rose-400 font-sans font-semibold">
                {avaria.tipo_avaria}
              </span>
              {avaria.setor && (
                <>
                  <span>•</span>
                  <span className="font-sans">{avaria.setor}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expandido ? 'rotate-180' : ''}`}
        />
      </div>

      {expandido && (
        <div className="px-3.5 pb-3.5 pt-0 space-y-2 border-t border-rose-100 dark:border-rose-900/40">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 text-[11px]">
            <div>
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">EAN</div>
              <div className="font-mono font-bold text-slate-700 dark:text-slate-200">
                {avaria.codigo_barras}
              </div>
            </div>
            {avaria.codigo_reduzido && (
              <div>
                <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Reduzido</div>
                <div className="font-mono font-bold text-slate-700 dark:text-slate-200">
                  {avaria.codigo_reduzido}
                </div>
              </div>
            )}
            <div>
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Registrado por</div>
              <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <User className="w-3 h-3" />
                {avaria.registrado_por_nome}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Data</div>
              <div className="font-bold text-slate-700 dark:text-slate-200">{avaria.registrado_em}</div>
            </div>
          </div>
          {avaria.registrado_por_matricula && (
            <div className="text-[10px] text-slate-400 font-mono">Matrícula: {avaria.registrado_por_matricula}</div>
          )}
        </div>
      )}
    </div>
  );
};
