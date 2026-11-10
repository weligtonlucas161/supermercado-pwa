import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  X, 
  Check, 
  AlertTriangle, 
  Download, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  SlidersHorizontal,
  Layers,
  Table,
  CheckCircle2,
  FileCheck,
  Eye,
  Tag,
  Database
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { SpreadsheetProductItem, SetorLoja, SETORES_DISPONIVEIS } from '../../types';
import { 
  uploadEncryptedProductsRealtime, 
  isSupabaseConfigured, 
  setCustomSupabaseConfig, 
  getSupabaseConfigInfo 
} from '../../services/supabaseService';
import { encryptProductList } from '../../utils/crypto';
import { triggerScanBeep } from '../../utils/haptics';

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
  const { addProduct, operator, refreshProductsFromDatabase } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados de Conexão com Supabase
  const supabaseConnected = isSupabaseConfigured();
  const [dbSaveStatus, setDbSaveStatus] = useState<'IDLE' | 'SAVED_TO_SUPABASE' | 'LOCAL_ONLY' | 'ERROR'>('IDLE');
  const [quickSupabaseUrl, setQuickSupabaseUrl] = useState(getSupabaseConfigInfo().url || '');
  const [quickSupabaseKey, setQuickSupabaseKey] = useState('');
  const [isConnectingQuick, setIsConnectingQuick] = useState(false);
  const [quickConnectError, setQuickConnectError] = useState<string | null>(null);

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
  });
  const [mappedItems, setMappedItems] = useState<SpreadsheetProductItem[]>([]);

  // Estados da Etapa 3: Criptografia Local (AES-GCM 256 bits)
  const [encryptionProgress, setEncryptionProgress] = useState(0);
  const [encryptedPayloads, setEncryptedPayloads] = useState<
    Array<{ original: SpreadsheetProductItem; encrypted: { ciphertext: string; iv: string } }>
  >([]);
  const [sampleCiphertext, setSampleCiphertext] = useState('');
  const [isEncrypting, setIsEncrypting] = useState(false);

  // Estados da Etapa 4: Sincronização Supabase e Exibição Descriptografada
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showEncryptedView, setShowEncryptedView] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');
    setErrorMessage(null);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

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
        };

        headerRow.forEach((colName, idx) => {
          const norm = normalize(String(colName));
          if (norm.includes('desc') || norm.includes('nome') || norm.includes('produto') || norm.includes('item')) {
            if (autoMap.name === -1) autoMap.name = idx;
          } else if (norm.includes('fornec') || norm.includes('forn') || norm.includes('fabr') || norm.includes('sup')) {
            if (autoMap.supplierCode === -1) autoMap.supplierCode = idx;
          } else if (norm.includes('reduz') || norm.includes('red') || norm.includes('interno') || norm.includes('plu')) {
            if (autoMap.reducedCode === -1) autoMap.reducedCode = idx;
          } else if (norm.includes('ean') || norm.includes('barras') || norm.includes('gtin') || norm.includes('codigo')) {
            if (autoMap.ean === -1) autoMap.ean = idx;
          } else if (norm.includes('quant') || norm.includes('qtd') || norm.includes('estoque') || norm.includes('saldo')) {
            if (autoMap.quantity === -1) autoMap.quantity = idx;
          }
        });

        // Fallbacks se as colunas forem A, B, C, D, E sequenciais
        if (autoMap.name === -1 && cols.length > 0) autoMap.name = 0;
        if (autoMap.supplierCode === -1 && cols.length > 1) autoMap.supplierCode = 1;
        if (autoMap.reducedCode === -1 && cols.length > 2) autoMap.reducedCode = 2;
        if (autoMap.ean === -1 && cols.length > 3) autoMap.ean = 3;
        if (autoMap.quantity === -1 && cols.length > 4) autoMap.quantity = 4;

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
        'Descrição do produto': 'Leite UHT Integral 1 Litro',
        'Código de fornecedor': 'FORN-8832',
        'Código reduzido': 'RED-104',
        'Código EAN': '7891000100011',
        'Quantidade': 120,
      },
      {
        'Descrição do produto': 'Iogurte Tradicional Morango 170g',
        'Código de fornecedor': 'FORN-4421',
        'Código reduzido': 'RED-208',
        'Código EAN': '7891000100028',
        'Quantidade': 45,
      },
      {
        'Descrição do produto': 'Arroz Branco Longo Fino 5kg',
        'Código de fornecedor': 'FORN-9910',
        'Código reduzido': 'RED-305',
        'Código EAN': '7891000100035',
        'Quantidade': 80,
      },
      {
        'Descrição do produto': 'Feijão Carioca Nobre 1kg',
        'Código de fornecedor': 'FORN-9910',
        'Código reduzido': 'RED-309',
        'Código EAN': '7891000100042',
        'Quantidade': 30,
      },
      {
        'Descrição do produto': 'Café Torrado e Moído Tradicional 500g',
        'Código de fornecedor': 'FORN-1205',
        'Código reduzido': 'RED-401',
        'Código EAN': '7891000100059',
        'Quantidade': 60,
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
    if (currentColMap.name === -1 || currentColMap.ean === -1 || currentColMap.quantity === -1) {
      return [];
    }

    if (!matrix || matrix.length === 0) return [];

    const startIdx = Math.max(0, sRow - 1);
    const endIdx = Math.min(matrix.length, Math.max(startIdx, eRow));
    const targetSlice = matrix.slice(startIdx, endIdx);

    const items: SpreadsheetProductItem[] = targetSlice.map((row) => {
      // 1. Descrição do produto
      const name = currentColMap.name >= 0 ? String(row[currentColMap.name] ?? '').trim() : '';
      // 2. Código de fornecedor
      const supplierCode = currentColMap.supplierCode >= 0 ? String(row[currentColMap.supplierCode] ?? '').trim() : '';
      // 3. Código reduzido
      const reducedCode = currentColMap.reducedCode >= 0 ? String(row[currentColMap.reducedCode] ?? '').trim() : '';
      // 4. Código EAN
      const ean = currentColMap.ean >= 0 ? String(row[currentColMap.ean] ?? '').trim() : '';
      // 5. Quantidade
      const quantityRaw = currentColMap.quantity >= 0 ? row[currentColMap.quantity] : 0;
      const quantity = Math.max(0, parseInt(String(quantityRaw ?? 0).replace(/[^0-9]/g, ''), 10) || 0);

      const errors: string[] = [];
      if (!name) errors.push('Descrição ausente');
      if (!ean) errors.push('EAN ausente');

      return {
        name,
        supplierCode,
        reducedCode,
        ean,
        quantity,
        setor,
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

  // =========================================================================
  // ETAPA 3: CRIPTOGRAFIA LOCAL (AES-GCM 256 BITS)
  // =========================================================================
  const handleStartEncryption = async () => {
    const validItems = mappedItems.filter(i => i.isValid);
    if (validItems.length === 0) {
      setErrorMessage('Nenhum item válido para criptografar. Verifique o mapeamento das colunas.');
      return;
    }

    setErrorMessage(null);
    setStep(3);
    setIsEncrypting(true);
    setEncryptionProgress(0);

    try {
      const encrypted = await encryptProductList(validItems, (processed, total, pct) => {
        setEncryptionProgress(pct);
      });

      setEncryptedPayloads(encrypted);
      if (encrypted.length > 0) {
        setSampleCiphertext(encrypted[0].encrypted.ciphertext);
      }
      setIsEncrypting(false);
      triggerScanBeep(true);

      // Transição automática para Etapa 4 após breve intervalo
      setTimeout(() => {
        handleStartSync(encrypted);
      }, 700);
    } catch (err) {
      console.error('Falha na criptografia:', err);
      setIsEncrypting(false);
      setErrorMessage('Erro ao criptografar dados com AES-GCM 256 bits.');
    }
  };

  // =========================================================================
  // ETAPA 4: SINCRONIZAÇÃO COM BACKEND SUPABASE & EXIBIÇÃO NO SOFTWARE
  // =========================================================================
  const handleStartSync = async (
    encryptedList = encryptedPayloads
  ) => {
    setStep(4);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);
    setErrorMessage(null);

    try {
      // 1. Upload em tempo real para o banco de dados oficial Synk
      const res = await uploadEncryptedProductsRealtime(
        encryptedList,
        (uploaded, total, pct) => {
          setUploadProgress(pct);
        },
        {
          lojaId: operator.loja_id || 'loja_padrao_001',
          operatorMatricula: operator.code || '4092',
          operatorNome: operator.name || 'Carlos Silva',
        }
      );

      // 2. Gravação no estoque do App (informações descriptografadas com o setor escolhido)
      encryptedList.forEach(item => {
        addProduct({
          name: item.original.name,
          supplierCode: item.original.supplierCode,
          reducedCode: item.original.reducedCode,
          ean: item.original.ean,
          stock: item.original.quantity,
          minStock: 10,
          price: 9.90,
          category: item.original.setor || selectedSetor,
          location: `Gôndola - ${item.original.setor || selectedSetor}`,
          loja_id: operator.loja_id || 'loja_padrao_001',
          isEncryptedInStorage: true,
          encryptedPayload: {
            ciphertext: item.encrypted.ciphertext,
            iv: item.encrypted.iv,
            encryptedAt: new Date().toISOString(),
          },
        });
      });

      setIsUploading(false);

      if (res.success) {
        setUploadSuccess(true);
        setDbSaveStatus('SAVED_TO_SUPABASE');
        triggerScanBeep(true);
        refreshProductsFromDatabase();
      } else if (res.isLocalOnly) {
        setUploadSuccess(false);
        setDbSaveStatus('LOCAL_ONLY');
      } else {
        setUploadSuccess(false);
        setDbSaveStatus('ERROR');
        setErrorMessage(res.error || 'Falha ao gravar no banco de dados Supabase.');
      }
    } catch (err) {
      console.error('Erro na sincronização:', err);
      setIsUploading(false);
      setDbSaveStatus('ERROR');
      setErrorMessage('Ocorreu um erro durante a sincronização com o banco de dados.');
    }
  };

  const handleQuickConnectAndUpload = async () => {
    setQuickConnectError(null);
    setIsConnectingQuick(true);

    const result = setCustomSupabaseConfig(quickSupabaseUrl, quickSupabaseKey);
    if (!result.success) {
      setQuickConnectError(result.message);
      setIsConnectingQuick(false);
      return;
    }

    setIsConnectingQuick(false);
    // Dispara o upload real com as credenciais salvas
    await handleStartSync(encryptedPayloads);
  };

  const validItemsCount = mappedItems.filter(i => i.isValid).length;

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
                  {supabaseConnected ? '🟢 Supabase Conectado' : '⚪ Modo Local (Offline)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Mapeamento das 5 colunas estritas • Seleção de Setor • AES-256 • Supabase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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
            <span>3. Criptografia</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />

          {/* Etapa 4 */}
          <div className={`flex items-center gap-1.5 shrink-0 ${step === 4 ? 'font-black text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              uploadSuccess ? 'bg-emerald-500 text-white' : step === 4 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800'
            }`}>
              {uploadSuccess ? '✓' : '4'}
            </span>
            <span>4. Sincronização</span>
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
        {step === 1 && (
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
        {step === 2 && (
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
                  Selecione o Setor da Loja para estes Produtos *
                </label>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  Setor Ativo: {selectedSetor}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Escolha a qual setor operacional os produtos importados serão vinculados no estoque:
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
            </div>

            {/* TABELA DE CONFERÊNCIA DOS ITENS MAPEADOS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Itens Extraídos com o Setor Aplicado ({validItemsCount} válidos de {mappedItems.length})
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Setor: {selectedSetor}
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-2">Descrição</th>
                      <th className="p-2">Setor</th>
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
                        <td className="p-2 font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">{item.setor}</td>
                        <td className="p-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.supplierCode || '-'}</td>
                        <td className="p-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.reducedCode || '-'}</td>
                        <td className="p-2 font-mono text-[11px] text-slate-700 dark:text-slate-300">{item.ean}</td>
                        <td className="p-2 text-right font-black text-emerald-600 dark:text-emerald-400">{item.quantity} un</td>
                        <td className="p-2 text-center">
                          {item.isValid ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600">Válido</span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600">{item.errors.join(', ')}</span>
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

        {/* ================================================================= */}
        {/* ETAPA 3: CRIPTOGRAFIA LOCAL (AES-GCM 256 BITS) */}
        {/* ================================================================= */}
        {step === 3 && (
          <div className="py-8 space-y-6 text-center flex-1 flex flex-col justify-center items-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 animate-pulse">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1.5 max-w-md">
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                Criptografando Dados da Planilha
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                As 5 colunas e o setor <strong>{selectedSetor}</strong> estão sendo cifrados localmente com chave AES-GCM 256 bits antes do trânsito para a nuvem.
              </p>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full max-w-md space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Cifrando registros em memória...</span>
                <span>{encryptionProgress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                  style={{ width: `${encryptionProgress}%` }}
                />
              </div>
            </div>

            {sampleCiphertext && (
              <div className="p-3 rounded-2xl bg-slate-900 text-left font-mono text-[10px] text-emerald-400 max-w-md w-full truncate border border-emerald-500/30">
                <span className="text-slate-400 block font-sans font-bold mb-0.5">Exemplo do Ciphertext Criptografado:</span>
                {sampleCiphertext}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ETAPA 4: SINCRONIZAÇÃO COM O SUPABASE & EXIBIÇÃO NO SOFTWARE */}
        {/* ================================================================= */}
        {step === 4 && (
          <div className="py-4 space-y-4 overflow-y-auto flex-1">
            {/* Status do Upload e Gravação no Banco */}
            {dbSaveStatus === 'SAVED_TO_SUPABASE' && (
              <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-500 text-white">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                      Sincronização Concluída com Sucesso no Banco Supabase!
                    </h4>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      {encryptedPayloads.length} produtos gravados no banco na nuvem (tabela 'produtos' e catálogo universal) no setor <strong>{selectedSetor}</strong>.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEncryptedView(!showEncryptedView)}
                  className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-white dark:bg-slate-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 transition shadow-xs cursor-pointer shrink-0"
                >
                  {showEncryptedView ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{showEncryptedView ? 'Ver Descriptografado' : 'Ver Criptografado'}</span>
                </button>
              </div>
            )}

            {/* Aviso Quando Supabase está Desconectado / Modo Local */}
            {dbSaveStatus === 'LOCAL_ONLY' && (
              <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-2xl bg-amber-500 text-white shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Gravado apenas localmente no aparelho (Supabase Desconectado)
                    </h4>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                      Os produtos foram carregados na memória do app, mas <strong>NÃO foram gravados no banco de dados Supabase</strong> porque o banco ainda não foi conectado com sua URL e Chave Anon.
                    </p>
                  </div>
                </div>

                {/* Formulário de Conexão Rápida com o Supabase */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-amber-500/20 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-amber-500" />
                      Conectar ao seu Banco Supabase para Gravar os Dados na Nuvem:
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">URL do Supabase</label>
                      <input
                        type="text"
                        value={quickSupabaseUrl}
                        onChange={e => setQuickSupabaseUrl(e.target.value)}
                        placeholder="https://seu-id.supabase.co"
                        className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Chave Anon (Public Key)</label>
                      <input
                        type="password"
                        value={quickSupabaseKey}
                        onChange={e => setQuickSupabaseKey(e.target.value)}
                        placeholder="eyJhbGciOiJIUz..."
                        className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {quickConnectError && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                      {quickConnectError}
                    </p>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleQuickConnectAndUpload}
                      disabled={!quickSupabaseUrl || !quickSupabaseKey || isConnectingQuick}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>{isConnectingQuick ? 'Conectando...' : 'Conectar e Gravar no Supabase Agora'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Erro Durante o Upload */}
            {dbSaveStatus === 'ERROR' && (
              <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-rose-500 text-white shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200">
                      Falha ao Gravar no Banco de Dados Supabase
                    </h4>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300">
                      {errorMessage || 'Ocorreu um erro ao comunicar com as tabelas do Supabase.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleStartSync(encryptedPayloads)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 transition"
                >
                  Tentar Novamente
                </button>
              </div>
            )}

            {/* Progresso do Upload se ainda em andamento */}
            {isUploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Enviando em tempo real para o banco...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Tabela do Software (Mostrando Informações Descriptografadas ou Criptografadas) */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-56 overflow-y-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 sticky top-0">
                  <tr>
                    <th className="p-2">Descrição</th>
                    <th className="p-2">Setor</th>
                    <th className="p-2">Cód. Fornecedor</th>
                    <th className="p-2">Cód. Reduzido</th>
                    <th className="p-2">EAN</th>
                    <th className="p-2 text-right">Qtd</th>
                    <th className="p-2 text-center">Proteção</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {encryptedPayloads.map((row, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold truncate max-w-[160px]">
                        {showEncryptedView ? row.encrypted.ciphertext.substring(0, 18) + '...' : row.original.name}
                      </td>
                      <td className="p-2 font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                        {row.original.setor || selectedSetor}
                      </td>
                      <td className="p-2 font-mono text-[11px] text-slate-400">
                        {showEncryptedView ? '***' : row.original.supplierCode || '-'}
                      </td>
                      <td className="p-2 font-mono text-[11px] text-slate-400">
                        {showEncryptedView ? '***' : row.original.reducedCode || '-'}
                      </td>
                      <td className="p-2 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {row.original.ean}
                      </td>
                      <td className="p-2 text-right font-black text-emerald-600 dark:text-emerald-400">
                        {showEncryptedView ? '***' : `${row.original.quantity} un`}
                      </td>
                      <td className="p-2 text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> AES-256
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              ✓ Na interface operacional, os operadores visualizam as informações descriptografadas instantaneamente para auditoria e conferência.
            </p>
          </div>
        )}

        {/* ================================================================= */}
        {/* FOOTER DO MODAL COM CONTROLES DE NAVEGAÇÃO POR ETAPA */}
        {/* ================================================================= */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancelar
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

          {step === 2 && (
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
                onClick={handleStartEncryption}
                disabled={validItemsCount === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Criptografar Dados ({validItemsCount} itens no setor {selectedSetor})</span>
              </button>
            </>
          )}

          {step === 3 && (
            <div className="w-full text-center text-xs font-bold text-slate-400">
              Aguarde a finalização da criptografia AES-GCM...
            </div>
          )}

          {step === 4 && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Check className="w-4 h-4" /> Concluir e Visualizar no Estoque
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
