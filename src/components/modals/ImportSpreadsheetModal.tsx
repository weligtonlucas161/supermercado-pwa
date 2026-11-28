import React, { useState, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  X, 
  Check, 
  AlertTriangle, 
  Download, 
  Lock, 
  ArrowRight, 
  ArrowLeft, 
  SlidersHorizontal,
  Layers,
  Table,
  Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { SpreadsheetProductItem, SetorLoja, SETORES_DISPONIVEIS } from '../../types';
import { 
  isSupabaseConfigured,
  loadStoreCategoryRules,
} from '../../services/supabaseService';
import {
  prepareStockImport, saveStockImport, stockImportRequest,
  type StockImportEntry, type StockImportMode, type StockImportSummary,
} from '../../services/stockImport';
import { triggerScanBeep } from '../../utils/haptics';
import { sanitizeSpreadsheetCell, sanitizeIdentifier, sanitizeBarcode } from '../../utils/security';
import { resolveCategory, type CategoryRules } from '../../utils/productCategorizer';

interface ImportSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type StepNumber = 1 | 2 | 3 | 4;

interface ColumnOption {
  index: number;
  label: string;
  sampleValue: string;
}

export const ImportSpreadsheetModal: React.FC<ImportSpreadsheetModalProps> = ({ isOpen, onClose }) => {
  const { operator, currentUser, refreshProductsFromDatabase } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados de Conexão com Supabase
  const supabaseConnected = isSupabaseConfigured();

  // Etapa Atual (1 a 4)
  const [step, setStep] = useState<StepNumber>(1);

  // Estados da Etapa 1: Upload e Preview Bruto
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawMatrix, setRawMatrix] = useState<string[][]>([]);
  const [rawRows, setRawRows] = useState<Array<Record<string, unknown>>>([]);
  const [detectedColumns, setDetectedColumns] = useState<ColumnOption[]>([]);

  // Estados da Etapa 2: Mapeamento das 5 Colunas, Linhas (Começo e Fim) e Seleção de Setor
  const [selectedSetor, setSelectedSetor] = useState<SetorLoja>('MERCEARIA');
  const [allMatrixRows, setAllMatrixRows] = useState<string[][]>([]);
  const [totalSheetRows, setTotalSheetRows] = useState<number>(0);
  const [startRow, setStartRow] = useState<number>(2);
  const [endRow, setEndRow] = useState<number>(100);
  const [colMap, setColMap] = useState({
    name: -1,         // 1. Descrição do produto
    supplierCode: -1, // 2. Código de fornecedor
    reducedCode: -1,  // 3. Código reduzido
    ean: -1,          // 4. Código EAN
    quantity: -1,     // 5. Quantidade
    category: -1,     // 6. Categoria/departamento (opcional)
  });
  const [mappedItems, setMappedItems] = useState<SpreadsheetProductItem[]>([]);
  const [customCategoryRules, setCustomCategoryRules] = useState<CategoryRules>({});

  const [mode, setMode] = useState<StockImportMode | ''>('');
  const [confirmation, setConfirmation] = useState<{ id: string; summary: StockImportSummary } | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [history, setHistory] = useState<StockImportEntry[] | null>(null);
  const [revertId, setRevertId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const store = currentUser?.loja_id || operator.loja_id || '';

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setMode('');
      setHistory(null);
      setConfirmation(null);
      setApplied(false);
      setRevertId(null);
      setErrorMessage(null);
      setFileName(null);
      setFileSize(null);
      setRawHeaders([]);
      setRawRows([]);
      setRawMatrix([]);
      setAllMatrixRows([]);
    }
  }, [isOpen, store]);

  // Carrega o dicionário de categorias customizado da loja para aplicar
  // as correções feitas pelos operadores em importações anteriores.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    loadStoreCategoryRules(store).then(rules => {
      if (!cancelled) setCustomCategoryRules(rules);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, store]);

  if (!isOpen) return null;

  // Normalização para detecção inteligente de cabeçalhos
  const normalize = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  // =========================================================================
  // ETAPA 1: LEITURA E PREVIEW DA PLANILHA BRUTA
  // =========================================================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRawRows([]);
    setRawHeaders([]);
    setRawMatrix([]);
    setAllMatrixRows([]);
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onerror = () => setErrorMessage('Não foi possível ler o arquivo. Selecione a planilha novamente.');

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', raw: true });
        const sheets = wb.SheetNames.filter(name => wb.Sheets[name]?.['!ref']);
        if (sheets.length !== 1) {
          setErrorMessage('Envie uma planilha com uma única aba contendo todo o estoque da loja.');
          return;
        }
        const ws = wb.Sheets[sheets[0]];

        // Matriz bruta para preview fiel
        const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });

        if (!matrix || matrix.length < 1) {
          setErrorMessage('A planilha selecionada está vazia.');
          return;
        }

        const headerRow = matrix[0] || [];
        setRawHeaders(headerRow);
        setRawMatrix(matrix.slice(1, 10)); // Primeiras linhas de preview
        setAllMatrixRows(matrix);
        setTotalSheetRows(matrix.length);
        
        // Define linha de começo e fim padrão
        const initialStart = matrix.length >= 2 ? 2 : 1;
        const initialEnd = matrix.length;
        setStartRow(initialStart);
        setEndRow(initialEnd);

        const firstDataRow = matrix[1] || [];
        const cols: ColumnOption[] = headerRow.map((head, idx) => ({
          index: idx,
          label: `Coluna ${String.fromCharCode(65 + idx)} (${head || 'Sem título'})`,
          sampleValue: String(firstDataRow[idx] || ''),
        }));
        setDetectedColumns(cols);

        // Linhas estruturadas
        const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        setRawRows(parsed);

        // Auto-mapeamento das 5 colunas pelas palavras-chave
        const autoMap = {
          name: -1,
          supplierCode: -1,
          reducedCode: -1,
          ean: -1,
          quantity: -1,
          category: -1,
        };

        headerRow.forEach((colName, idx) => {
          const norm = normalize(String(colName));
          if (norm.includes('desc') || norm === 'nome' || norm === 'produto' || norm === 'item' || norm.includes('nomeproduto')) {
            if (autoMap.name === -1) autoMap.name = idx;
          } else if (norm.includes('categoria') || norm.includes('departamento') || norm.includes('secao') || norm.includes('grupo')) {
            if (autoMap.category === -1) autoMap.category = idx;
          } else if (norm.includes('fornec') || norm.includes('forn') || norm.includes('fabr') || norm.includes('sup')) {
            if (autoMap.supplierCode === -1) autoMap.supplierCode = idx;
          } else if (norm.includes('reduz') || norm.includes('red') || norm.includes('interno') || norm.includes('plu') || norm === 'codigoproduto') {
            if (autoMap.reducedCode === -1) autoMap.reducedCode = idx;
          } else if (norm.includes('ean') || norm.includes('barras') || norm.includes('gtin') || norm.includes('codigoacesso') || norm === 'codigo') {
            if (autoMap.ean === -1) autoMap.ean = idx;
          } else if (norm.includes('quant') || norm.includes('qtd') || norm.includes('estoque') || norm.includes('saldo')) {
            if (autoMap.quantity === -1) autoMap.quantity = idx;
          }
        });

        // Fallbacks se as colunas forem A, B, C, D, E sequenciais
        if (autoMap.supplierCode === -1 && cols.length > 1) autoMap.supplierCode = 1;
        if (autoMap.reducedCode === -1 && cols.length > 2) autoMap.reducedCode = 2;

        setColMap(autoMap);
      } catch (err) {
        console.error('Erro ao ler planilha:', err);
        setErrorMessage('Formato de planilha inválido. Carregue um arquivo .xlsx, .xls ou .csv.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Gerar e baixar planilha modelo estrita com as 5 colunas
  const handleDownloadTemplate = () => {
    const template = [
      {
        'Descrição do produto': '',
        'Código de fornecedor': '',
        'Código reduzido': '',
        'Código EAN': '',
        'Quantidade': '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque_5_Colunas');
    XLSX.writeFile(wb, 'modelo_estoque_5_colunas.xlsx');
  };

  // =========================================================================
  // ETAPA 2: PROCESSAR MAPEAMENTO DAS 5 COLUNAS + LINHAS (COMEÇO/FIM) + SETOR
  // =========================================================================
  const updateMappedItems = (
    currentColMap = colMap, 
    setor = selectedSetor,
    sRow = startRow,
    eRow = endRow,
    matrix = allMatrixRows
  ) => {
    const requiredColumns = [currentColMap.name, currentColMap.ean, currentColMap.quantity];
    if (requiredColumns.includes(-1) || new Set(requiredColumns).size !== requiredColumns.length) {
      return [];
    }

    if (!matrix || matrix.length === 0) return [];

    const startIdx = Math.max(0, sRow - 1);
    const endIdx = Math.min(matrix.length, Math.max(startIdx, eRow));
    const targetSlice = matrix.slice(startIdx, endIdx);

    const items: SpreadsheetProductItem[] = targetSlice.filter(row => row.some(cell => String(cell).trim() !== '')).map((row) => {
      // 1. Descrição do produto (sanitizada contra XSS, SQLi e Formula Injection)
      const name = currentColMap.name >= 0 ? sanitizeSpreadsheetCell(row[currentColMap.name], 200) : '';
      // 2. Código de fornecedor
      const supplierCode = currentColMap.supplierCode >= 0 ? sanitizeIdentifier(row[currentColMap.supplierCode], 32) : '';
      // 3. Código reduzido
      const reducedCode = currentColMap.reducedCode >= 0 ? sanitizeIdentifier(row[currentColMap.reducedCode], 32) : '';
      // 4. Código EAN
      const rawEan = String(row[currentColMap.ean] ?? '').trim();
      const ean = /^[0-9]{1,32}$/.test(rawEan) ? sanitizeBarcode(rawEan, 32) : '';
      const rawQuantity = String(row[currentColMap.quantity] ?? '').trim();
      const quantity = /^\d+$/.test(rawQuantity) ? Number(rawQuantity) : NaN;
      // 6. Categoria/departamento (opcional na planilha; quando vazia, genérica
      //    ou abreviada é classificada automaticamente pela descrição)
      const sourceCategory = currentColMap.category >= 0
        ? sanitizeSpreadsheetCell(row[currentColMap.category], 80)
        : '';
      const department = name
        ? resolveCategory(sourceCategory, name, customCategoryRules)
        : 'Outros';

      const errors: string[] = [];
      if (!name) errors.push('Descrição ausente');
      if (!ean) errors.push('Código de barras inválido');
      if (!Number.isSafeInteger(quantity) || quantity > 10000000) errors.push('Informe uma quantidade inteira entre 0 e 10.000.000');

      return {
        name,
        supplierCode,
        reducedCode,
        ean,
        quantity,
        setor,
        department,
        sourceCategory: sourceCategory || undefined,
        isValid: errors.length === 0,
        errors,
      };
    });

    return items;
  };

  const handleGoToStep2 = () => {
    if (allMatrixRows.length === 0) {
      setErrorMessage('Carregue uma planilha antes de avançar.');
      return;
    }
    setErrorMessage(null);
    const items = updateMappedItems(colMap, selectedSetor, startRow, endRow, allMatrixRows);
    setMappedItems(items);
    setStep(2);
    triggerScanBeep(true);
  };

  const handleSetorChange = (setor: SetorLoja) => {
    setSelectedSetor(setor);
    const items = updateMappedItems(colMap, setor, startRow, endRow, allMatrixRows);
    setMappedItems(items);
  };

  const handleStartRowChange = (val: number) => {
    const s = Math.max(1, val);
    setStartRow(s);
    const items = updateMappedItems(colMap, selectedSetor, s, endRow, allMatrixRows);
    setMappedItems(items);
  };

  const handleEndRowChange = (val: number) => {
    const e = Math.max(startRow, Math.min(totalSheetRows, val));
    setEndRow(e);
    const items = updateMappedItems(colMap, selectedSetor, startRow, e, allMatrixRows);
    setMappedItems(items);
  };

  const handleColMapChange = (key: keyof typeof colMap, value: number) => {
    const updated = { ...colMap, [key]: value };
    setColMap(updated);
    const items = updateMappedItems(updated, selectedSetor, startRow, endRow, allMatrixRows);
    setMappedItems(items);
  };

  const loadHistory = async () => {
    setHistory(await stockImportRequest<StockImportEntry[]>('history', store));
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao comunicar com o estoque.');
    } finally {
      setBusy(false);
    }
  };

  const preview = () => run(async () => {
    if (!mode || !fileName) return;
    setProgress(0);
    setConfirmation(await prepareStockImport(store, fileName, mode, mappedItems, setProgress));
    setStep(4);
  });

  const apply = () => run(async () => {
    if (!confirmation) return;
    await saveStockImport('apply', store, confirmation.id);
    setApplied(true);
    triggerScanBeep(true);
    void refreshProductsFromDatabase();
  });

  const revert = (id: string) => run(async () => {
    await saveStockImport('revert', store, id);
    setRevertId(null);
    void refreshProductsFromDatabase();
    await loadHistory();
  });

  const validItemsCount = mappedItems.filter(i => i.isValid).length;
  const hasInvalidRows = mappedItems.length > validItemsCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 max-h-[94vh] flex flex-col">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-white">
                  Importação de Planilha de Estoque
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  4 Etapas
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  supabaseConnected
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }`}>
                  {supabaseConnected ? '🟢 Supabase Conectado' : 'Conexão necessária'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                A planilha deve representar o estoque completo desta loja.
              </p>
            </div>
          </div>
          <button
            onClick={onClose} disabled={busy}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Visual (1 -> 2 -> 3 -> 4) */}
        <div className="py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 text-xs overflow-x-auto gap-2">
          {/* Etapa 1 */}
          <div className={`flex items-center gap-1.5 shrink-0 ${step === 1 ? 'font-black text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step > 1 ? 'bg-emerald-500 text-white' : step === 1 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800'
            }`}>
              {step > 1 ? '✓' : '1'}
            </span>
            <span>1. Upload & Preview</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />

          {/* Etapa 2 */}
          <div className={`flex items-center gap-1.5 shrink-0 ${step === 2 ? 'font-black text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step > 2 ? 'bg-emerald-500 text-white' : step === 2 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800'
            }`}>
              {step > 2 ? '✓' : '2'}
            </span>
            <span>2. Colunas & Setor</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />

          {/* Etapa 3 */}
          <div className={`flex items-center gap-1.5 shrink-0 ${step === 3 ? 'font-black text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step > 3 ? 'bg-emerald-500 text-white' : step === 3 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800'
            }`}>
              {step > 3 ? '✓' : '3'}
            </span>
            <span>3. Tipo de importação</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />

          {/* Etapa 4 */}
          <div className={`flex items-center gap-1.5 shrink-0 ${step === 4 ? 'font-black text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              applied ? 'bg-emerald-500 text-white' : step === 4 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800'
            }`}>
              {applied ? '✓' : '4'}
            </span>
            <span>4. Conferência</span>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* ETAPA 1: UPLOAD E PREVIEW DA PLANILHA */}
        {/* ================================================================= */}
        {history === null && step === 1 && (
          <div className="py-4 space-y-4 overflow-y-auto flex-1">
            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 rounded-3xl p-5 text-center cursor-pointer bg-emerald-500/5 hover:bg-emerald-500/10 transition group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="w-8 h-8 mx-auto text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {fileName ? `Arquivo: ${fileName} (${fileSize})` : 'Clique ou arraste a planilha aqui (.xlsx, .xls ou .csv)'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                O arquivo será lido instantaneamente para visualização prévia das linhas.
              </p>
            </div>

            {/* Atalho Baixar Modelo */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Deseja o modelo de 5 colunas pronto para preenchimento?
              </span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Baixar Modelo .XLSX
              </button>
            </div>

            {/* Preview da Planilha Bruta (Tabela das primeiras linhas) */}
            {rawHeaders.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Table className="w-4 h-4 text-emerald-500" />
                    Preview dos Dados Brutos ({rawRows.length} linhas detectadas)
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Amostragem das primeiras {rawMatrix.length} linhas
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-52 overflow-x-auto overflow-y-auto text-xs">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-2 w-10 text-center">#</th>
                        {rawHeaders.map((head, idx) => (
                          <th key={idx} className="p-2 border-l border-slate-200 dark:border-slate-700">
                            {head || `Col ${String.fromCharCode(65 + idx)}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {rawMatrix.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 text-center text-slate-400 font-mono text-[10px]">{rIdx + 1}</td>
                          {rawHeaders.map((_, cIdx) => (
                            <td key={cIdx} className="p-2 text-slate-700 dark:text-slate-300 border-l border-slate-100 dark:border-slate-800 text-[11px]">
                              {String(row[cIdx] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ETAPA 2: MAPEAMENTO DE COLUNAS, LINHAS E SELEÇÃO DE SETOR */}
        {/* ================================================================= */}
        {history === null && step === 2 && (
          <div className="py-4 space-y-4 overflow-y-auto flex-1">
            {/* 1. SELEÇÃO DO INTERVALO DE LINHAS (COMEÇO E FIM) */}
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-500" />
                  Intervalo de Linhas para Leitura (Começo e Fim) *
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {Math.max(0, endRow - startRow + 1)} linhas selecionadas de {totalSheetRows}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Informe onde começam e terminam os dados na planilha para ignorar títulos ou rodapés:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Linha de Começo (Início dos dados)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={totalSheetRows || 9999}
                    value={startRow}
                    onChange={(e) => handleStartRowChange(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Normalmente linha 2 (após o cabeçalho)</span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Linha de Fim (Última linha a importar)
                  </label>
                  <input
                    type="number"
                    min={startRow}
                    max={totalSheetRows || 9999}
                    value={endRow}
                    onChange={(e) => handleEndRowChange(parseInt(e.target.value, 10) || startRow)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Total de linhas detectadas: {totalSheetRows}</span>
                </div>
              </div>
            </div>

            {/* 2. SELEÇÃO DO SETOR (FRIOS, AÇOUGUE, PEIXARIA, MERCEARIA, PADARIA, BAZAR) */}
            <div className="p-4 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Tag className="w-4 h-4 text-emerald-500" />
                  Selecione o setor para produtos novos
                </label>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  Setor para produtos novos: {selectedSetor}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Os produtos já cadastrados mantêm seu setor atual.
              </p>

              {/* Botões / Chips dos 6 Setores Oficiais */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {SETORES_DISPONIVEIS.map((setor) => {
                  const isSelected = selectedSetor === setor;
                  return (
                    <button
                      key={setor}
                      type="button"
                      onClick={() => handleSetorChange(setor)}
                      className={`p-2.5 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-1 border cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/30'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <span>{setor}</span>
                      {isSelected && (
                        <span className="text-[9px] font-semibold opacity-90">✓ Selecionado</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {hasInvalidRows && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Corrija {mappedItems.length - validItemsCount} linha(s) inválida(s) antes de gerar a prévia.
              </p>
            )}

            {/* 3. MAPEAMENTO DAS 5 COLUNAS ESTRITAS */}
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-500" />
                  Posição das 5 Colunas Requeridas
                </h4>
                <span className="text-[10px] text-slate-400">
                  Apenas estas 5 informações serão extraídas
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* 1. Descrição */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    1. Descrição do Produto *
                  </label>
                  <select
                    value={colMap.name}
                    onChange={e => handleColMapChange('name', parseInt(e.target.value, 10))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                  >
                    {detectedColumns.map(col => (
                      <option key={col.index} value={col.index}>
                        {col.label} {col.sampleValue && `(Ex: ${col.sampleValue.substring(0, 18)})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Código de Fornecedor */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    2. Código de Fornecedor
                  </label>
                  <select
                    value={colMap.supplierCode}
                    onChange={e => handleColMapChange('supplierCode', parseInt(e.target.value, 10))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                  >
                    <option value={-1}>-- Não mapear / Deixar vazio --</option>
                    {detectedColumns.map(col => (
                      <option key={col.index} value={col.index}>
                        {col.label} {col.sampleValue && `(Ex: ${col.sampleValue.substring(0, 18)})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Código Reduzido */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    3. Código Reduzido
                  </label>
                  <select
                    value={colMap.reducedCode}
                    onChange={e => handleColMapChange('reducedCode', parseInt(e.target.value, 10))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                  >
                    <option value={-1}>-- Não mapear / Deixar vazio --</option>
                    {detectedColumns.map(col => (
                      <option key={col.index} value={col.index}>
                        {col.label} {col.sampleValue && `(Ex: ${col.sampleValue.substring(0, 18)})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Código EAN */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    4. Código EAN (Código de Barras) *
                  </label>
                  <select
                    value={colMap.ean}
                    onChange={e => handleColMapChange('ean', parseInt(e.target.value, 10))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                  >
                    {detectedColumns.map(col => (
                      <option key={col.index} value={col.index}>
                        {col.label} {col.sampleValue && `(Ex: ${col.sampleValue.substring(0, 18)})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Quantidade */}
                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    5. Quantidade (Saldo de Estoque) *
                  </label>
                  <select
                    value={colMap.quantity}
                    onChange={e => handleColMapChange('quantity', parseInt(e.target.value, 10))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                  >
                    {detectedColumns.map(col => (
                      <option key={col.index} value={col.index}>
                        {col.label} {col.sampleValue && `(Ex: ${col.sampleValue.substring(0, 18)})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 6. CATEGORIA/DEPARTAMENTO (OPCIONAL) */}
              <div className="p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase block">
                    6. Categoria / Departamento (opcional)
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    Classificação automática ativa
                  </span>
                </div>
                <select
                  value={colMap.category}
                  onChange={e => handleColMapChange('category', parseInt(e.target.value, 10))}
                  className="w-full p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                >
                  <option value={-1}>-- Não mapear / Classificar pela descrição --</option>
                  {detectedColumns.map(col => (
                    <option key={col.index} value={col.index}>
                      {col.label} {col.sampleValue && `(Ex: ${col.sampleValue.substring(0, 18)})`}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Quando a coluna vier vazia, genérica ("Geral", "Outros") ou abreviada (ex.: "BEB", "LIMP"), o sistema classifica automaticamente pela descrição do produto e pelo dicionário da loja.
                </p>
              </div>
            </div>

            {/* TABELA DE CONFERÊNCIA DOS ITENS MAPEADOS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Itens extraídos ({validItemsCount} válidos de {mappedItems.length})
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Produtos novos: {selectedSetor}
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-48 overflow-x-auto overflow-y-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-2">Descrição</th>
                      <th className="p-2">Categoria (Auto)</th>
                      <th className="p-2">Setor se novo</th>
                      <th className="p-2">Cód. Fornecedor</th>
                      <th className="p-2">Cód. Reduzido</th>
                      <th className="p-2">EAN</th>
                      <th className="p-2 text-right">Qtd</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {mappedItems.map((item, idx) => (
                      <tr key={idx} className={item.isValid ? '' : 'bg-rose-500/10 text-rose-600'}>
                        <td className="p-2 font-bold truncate max-w-[150px]">{item.name || 'NÃO INFORMADO'}</td>
                        <td className="p-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                            item.department === 'Outros'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                              : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                          }`}>
                            {item.department || 'Outros'}
                          </span>
                        </td>
                        <td className="p-2 font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">{item.setor}</td>
                        <td className="p-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.supplierCode || '-'}</td>
                        <td className="p-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.reducedCode || '-'}</td>
                        <td className="p-2 font-mono text-[11px] text-slate-700 dark:text-slate-300">{item.ean}</td>
                        <td className="p-2 text-right font-black text-emerald-600 dark:text-emerald-400">{item.quantity} un</td>
                        <td className="p-2 text-center">
                          {item.isValid ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600">Válido</span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600">{item.errors?.join(', ') || 'Inválido'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {history !== null ? (
          <section className="py-4 space-y-3 overflow-y-auto flex-1">
            <h4 className="font-bold">Histórico de importações</h4>
            {history.length === 0 && <p className="text-sm text-slate-500">Nenhuma importação registrada.</p>}
            {history.map((entry, index) => (
              <div key={entry.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
                <p className="font-semibold break-all">{entry.filename}</p>
                <p className="text-slate-500">{new Date(entry.applied_at).toLocaleString('pt-BR')} · {entry.mode === 'baseline' ? 'Novo estoque' : 'Atualização'} · {entry.summary.total} produtos</p>
                {entry.reverted_at && <p className="text-slate-500">Revertida em {new Date(entry.reverted_at).toLocaleString('pt-BR')}</p>}
                {index === 0 && !entry.reverted_at && (
                  revertId === entry.id ? (
                    <div className="mt-2 space-y-2">
                      <p>Os saldos anteriores serão restaurados. Cadastros novos permanecerão com saldo zero.</p>
                      <button type="button" disabled={busy} onClick={() => revert(entry.id)} className="font-bold text-rose-600">Confirmar reversão</button>
                      <button type="button" disabled={busy} onClick={() => setRevertId(null)} className="ml-4">Cancelar</button>
                    </div>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => setRevertId(entry.id)} className="mt-2 font-semibold text-rose-600">Reverter importação</button>
                  )
                )}
              </div>
            ))}
          </section>
        ) : step === 3 ? (
          <section className="py-5 space-y-4 overflow-y-auto flex-1">
            <fieldset disabled={busy} className="space-y-3">
              <legend className="font-bold mb-3">Esta planilha representa um novo estoque?</legend>
              {([
                ['baseline', 'Sim, novo estoque', 'Cria uma nova base e preserva o histórico anterior.'],
                ['update', 'Não, atualização de estoque', 'Compara os saldos e registra as movimentações.'],
              ] as const).map(([value, label, description]) => (
                <label key={value} className="flex gap-3 items-start p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input type="radio" name="stock-import-mode" checked={mode === value} onChange={() => setMode(value)} />
                  <span><strong className="block text-sm">{label}</strong><span className="text-xs text-slate-500">{description}</span></span>
                </label>
              ))}
            </fieldset>
            <p className="text-sm text-slate-500">Produtos ausentes terão o saldo zerado. Cadastros e históricos serão preservados.</p>
            {busy && <progress className="w-full accent-emerald-600" aria-label="Preparando comparação" value={progress} max={100} />}
          </section>
        ) : step === 4 && confirmation && (
          <section className="py-5 space-y-4 overflow-y-auto flex-1">
            <h4 className="font-bold">{applied ? 'Importação concluída' : 'Resumo da importação'}</h4>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {([
                ['total', 'Produtos após importação'],
                ['new', 'Produtos novos'],
                ['out', 'Com saída'],
                ['in', 'Com reposição'],
                ['restocked', 'Reabastecidos'],
                ['unchanged', 'Sem movimentação'],
                ['zeroed', 'Estoque zerado'],
                ['still_zero', 'Continuam zerados'],
                ['absent', 'Ausentes na planilha'],
              ] as const).filter(([key]) => mode === 'update' || !['out', 'in', 'restocked', 'unchanged'].includes(key)).map(([key, label]) => (
                <div key={key} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <dt className="text-xs text-slate-600 dark:text-slate-300">{label}</dt>
                  <dd className="font-bold text-lg">{confirmation.summary[key].toLocaleString('pt-BR')}</dd>
                </div>
              ))}
            </dl>
            {confirmation.summary.large_reduction && (
              <p role="alert" className="rounded-xl bg-amber-500/15 p-3 text-sm text-amber-800 dark:text-amber-200">
                O saldo total cai mais de 30%. Confira se a planilha inclui todos os setores antes de confirmar.
              </p>
            )}
            {mode === 'update' && <p className="text-xs text-slate-500">Saldo igual entre planilhas pode incluir vendas e reposições na mesma quantidade.</p>}
          </section>
        )}

        {/* ================================================================= */}
        {/* FOOTER DO MODAL COM CONTROLES DE NAVEGAÇÃO POR ETAPA */}
        {/* ================================================================= */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          {history === null && step === 1 && (
            <>
              <button
                type="button"
                onClick={() => run(loadHistory)} disabled={busy || !supabaseConnected}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Histórico
              </button>
              <button
                type="button"
                onClick={handleGoToStep2}
                disabled={rawRows.length === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Avançar para Mapeamento & Setor</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {history === null && step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!supabaseConnected || validItemsCount === 0 || hasInvalidRows}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Avançar com {validItemsCount} produtos</span>
              </button>
            </>
          )}

          {history !== null ? (
            <button type="button" disabled={busy} onClick={() => { setHistory(null); setErrorMessage(null); }} className="text-sm font-semibold">Voltar</button>
          ) : step === 3 ? (
            <>
              <button type="button" disabled={busy} onClick={() => setStep(2)} className="text-sm font-semibold">Voltar</button>
              <button type="button" disabled={busy || !mode} onClick={preview} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">
                {busy ? 'Preparando prévia…' : 'Gerar prévia'}
              </button>
            </>
          ) : step === 4 ? (
            <>
              <button type="button" disabled={busy} onClick={applied ? () => run(loadHistory) : () => { setStep(3); setErrorMessage(null); }} className="text-sm font-semibold">
                {applied ? 'Histórico' : 'Voltar'}
              </button>
              <button type="button" disabled={busy} onClick={applied ? onClose : apply} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">
                {applied ? 'Concluir' : busy ? 'Aplicando…' : 'Confirmar importação'}
              </button>
            </>
          ) : null}

        </div>
      </div>
    </div>
  );
};
