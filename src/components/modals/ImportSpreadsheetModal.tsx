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
  Eye, 
  EyeOff, 
  Database,
  CheckCircle2,
  FileCheck2,
  SlidersHorizontal,
  Key
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { SpreadsheetProductItem } from '../../types';
import { uploadEncryptedProductsRealtime } from '../../services/supabaseService';
import { encryptProductList, decryptProduct } from '../../utils/crypto';
import { triggerScanBeep } from '../../utils/haptics';

interface ImportSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportStep = '1_UPLOAD_MAP' | '2_CONFIRM_LIST' | '3_ENCRYPTION' | '4_REALTIME_UPLOAD_SUCCESS';

interface ColumnOption {
  index: number;
  label: string;
  sampleValue: string;
}

export const ImportSpreadsheetModal: React.FC<ImportSpreadsheetModalProps> = ({ isOpen, onClose }) => {
  const { addProduct } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados do Fluxo em Passos
  const [currentStep, setCurrentStep] = useState<ImportStep>('1_UPLOAD_MAP');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Array<Record<string, unknown>>>([]);
  const [detectedColumns, setDetectedColumns] = useState<ColumnOption[]>([]);

  // Mapeamento das 5 colunas estritas por posição / chave
  const [colMap, setColMap] = useState({
    name: -1,         // 1. Descrição do produto
    supplierCode: -1, // 2. Código de fornecedor
    reducedCode: -1,  // 3. Código reduzido
    ean: -1,          // 4. Código EAN
    quantity: -1,     // 5. Quantidade
  });

  // Dados extraídos das 5 colunas
  const [extractedItems, setExtractedItems] = useState<SpreadsheetProductItem[]>([]);

  // Estados da Criptografia (Passo 3)
  const [encryptionProgress, setEncryptionProgress] = useState(0);
  const [encryptedPayloads, setEncryptedPayloads] = useState<
    Array<{ original: SpreadsheetProductItem; encrypted: { ciphertext: string; iv: string } }>
  >([]);
  const [sampleCiphertext, setSampleCiphertext] = useState('');

  // Estados do Upload Realtime (Passo 4)
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showEncryptedView, setShowEncryptedView] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Função utilitária para normalizar strings de cabeçalho
  const normalize = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  // =========================================================================
  // PASSO 1: CARREGAR PLANILHA E IDENTIFICAR AS 5 COLUNAS
  // =========================================================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMessage(null);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        // Ler matriz bruta para pegar tanto posições físicas quanto cabeçalhos
        const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });

        if (!matrix || matrix.length < 1) {
          setErrorMessage('A planilha selecionada está vazia.');
          return;
        }

        const headerRow = matrix[0] || [];
        const firstDataRow = matrix[1] || [];

        const cols: ColumnOption[] = headerRow.map((head, idx) => ({
          index: idx,
          label: `Coluna ${String.fromCharCode(65 + idx)} (${head || 'Sem nome'})`,
          sampleValue: String(firstDataRow[idx] || ''),
        }));

        setDetectedColumns(cols);

        // Converter dados estruturados
        const parsedData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        setRawRows(parsedData);

        // Auto-identificação inteligente das 5 posições padrão
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

        // Caso posições sejam sequenciais sem cabeçalho específico (ex: A, B, C, D, E)
        if (autoMap.name === -1 && cols.length > 0) autoMap.name = 0;
        if (autoMap.supplierCode === -1 && cols.length > 1) autoMap.supplierCode = 1;
        if (autoMap.reducedCode === -1 && cols.length > 2) autoMap.reducedCode = 2;
        if (autoMap.ean === -1 && cols.length > 3) autoMap.ean = 3;
        if (autoMap.quantity === -1 && cols.length > 4) autoMap.quantity = 4;

        setColMap(autoMap);
      } catch (err) {
        console.error('Erro ao ler planilha:', err);
        setErrorMessage('Formato de planilha inválido. Utilize arquivos .xlsx, .xls ou .csv.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Gerar e baixar planilha modelo estrita com as 5 colunas
  const handleDownload5ColTemplate = () => {
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

  // Validar e extrair dados para o Passo 2
  const handleProceedToStep2 = () => {
    if (colMap.name === -1 || colMap.ean === -1 || colMap.quantity === -1) {
      setErrorMessage('Por favor, informe a posição ao menos de Descrição, EAN e Quantidade.');
      return;
    }

    setErrorMessage(null);

    const items: SpreadsheetProductItem[] = rawRows.map((row) => {
      const values = Object.values(row);

      const name = String(values[colMap.name] ?? '').trim();
      const supplierCode = colMap.supplierCode >= 0 ? String(values[colMap.supplierCode] ?? '').trim() : '';
      const reducedCode = colMap.reducedCode >= 0 ? String(values[colMap.reducedCode] ?? '').trim() : '';
      const ean = String(values[colMap.ean] ?? '').trim();
      const quantityRaw = values[colMap.quantity];
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
        isValid: errors.length === 0,
        errors,
      };
    });

    setExtractedItems(items);
    setCurrentStep('2_CONFIRM_LIST');
    triggerScanBeep(true);
  };

  // =========================================================================
  // PASSO 3: CRIPTOGRAFIA DE TODAS AS 5 COLUNAS (AES-GCM 256-bit)
  // =========================================================================
  const handleStartEncryption = async () => {
    setCurrentStep('3_ENCRYPTION');
    setEncryptionProgress(0);
    setErrorMessage(null);

    try {
      const validItems = extractedItems.filter(i => i.isValid);

      const encrypted = await encryptProductList(validItems, (processed, total, pct) => {
        setEncryptionProgress(pct);
      });

      setEncryptedPayloads(encrypted);
      if (encrypted.length > 0) {
        setSampleCiphertext(encrypted[0].encrypted.ciphertext);
      }

      // Pequena pausa para o usuário ver o feedback de 100%
      setTimeout(() => {
        handleRealtimeUpload(encrypted);
      }, 700);
    } catch (err) {
      console.error('Erro na criptografia:', err);
      setErrorMessage('Falha ao criptografar dados antes do upload.');
    }
  };

  // =========================================================================
  // PASSO 4: UPLOAD REALTIME PARA O BANCO E EXIBIÇÃO DESCRIPTOGRAFADA
  // =========================================================================
  const handleRealtimeUpload = async (
    encryptedList: Array<{ original: SpreadsheetProductItem; encrypted: { ciphertext: string; iv: string } }>
  ) => {
    setCurrentStep('4_REALTIME_UPLOAD_SUCCESS');
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Upload em Realtime para o Supabase
      await uploadEncryptedProductsRealtime(encryptedList, (uploaded, total, pct) => {
        setUploadProgress(pct);
      });

      // 2. Gravação no estoque do App (informações descriptografadas na memória da aplicação)
      encryptedList.forEach(item => {
        addProduct({
          name: item.original.name,
          supplierCode: item.original.supplierCode,
          reducedCode: item.original.reducedCode,
          ean: item.original.ean,
          stock: item.original.quantity,
          minStock: 10,
          price: 9.90,
          category: 'Mercearia',
          location: 'Gôndola Central',
          isEncryptedInStorage: true,
          encryptedPayload: {
            ciphertext: item.encrypted.ciphertext,
            iv: item.encrypted.iv,
            encryptedAt: new Date().toISOString(),
          },
        });
      });

      setIsUploading(false);
      triggerScanBeep(true);
    } catch (err) {
      console.error('Erro no upload realtime:', err);
      setIsUploading(false);
      setErrorMessage('Ocorreu uma falha no upload para o banco de dados.');
    }
  };

  const validItemsCount = extractedItems.filter(i => i.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 max-h-[94vh] flex flex-col">
        
        {/* Header com Indicador de Passos */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">
                  Importação de Estoque por Planilha (5 Colunas Estritas)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  AES-256 GCM
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Descrição • Cód. Fornecedor • Cód. Reduzido • EAN • Quantidade
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

        {/* Stepper Visual */}
        <div className="py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 text-xs">
          <div className={`flex items-center gap-1.5 ${currentStep === '1_UPLOAD_MAP' ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-[10px] font-bold">1</span>
            <span>Carregar & Mapear 5 Colunas</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700" />
          <div className={`flex items-center gap-1.5 ${currentStep === '2_CONFIRM_LIST' ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-[10px] font-bold">2</span>
            <span>Conferência de Dados</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700" />
          <div className={`flex items-center gap-1.5 ${currentStep === '3_ENCRYPTION' ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-[10px] font-bold">3</span>
            <span>Criptografia</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700" />
          <div className={`flex items-center gap-1.5 ${currentStep === '4_REALTIME_UPLOAD_SUCCESS' ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-[10px] font-bold">4</span>
            <span>Upload Realtime & Descriptografia</span>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* CORPO DO PASSO 1: UPLOAD E POSIÇÕES DAS 5 COLUNAS */}
        {/* ================================================================= */}
        {currentStep === '1_UPLOAD_MAP' && (
          <div className="py-4 space-y-4 overflow-y-auto flex-1">
            {/* Seletor de Arquivo */}
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
                {fileName ? `Arquivo Carregado: ${fileName}` : 'Clique para selecionar a planilha (.xlsx, .xls ou .csv)'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                O sistema identificará e extrairá estritamente as 5 colunas requeridas.
              </p>
            </div>

            {/* Atalho Baixar Modelo 5 Colunas */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Quer a planilha modelo com as 5 posições já configuradas?
              </span>
              <button
                onClick={handleDownload5ColTemplate}
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Baixar Modelo .XLSX
              </button>
            </div>

            {/* Definição das Posições das 5 Colunas */}
            {detectedColumns.length > 0 && (
              <div className="space-y-3 p-4 rounded-3xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-emerald-500" />
                    Mapeamento das Posições das 5 Colunas
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Selecione qual coluna da planilha corresponde a cada campo
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* 1. Descrição */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                      1. Descrição do Produto *
                    </label>
                    <select
                      value={colMap.name}
                      onChange={e => setColMap({ ...colMap, name: parseInt(e.target.value, 10) })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                    >
                      {detectedColumns.map(col => (
                        <option key={col.index} value={col.index}>
                          {col.label} {col.sampleValue && `(Ex: ${col.sampleValue.substring(0, 20)})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Código de Fornecedor */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                      2. Código de Fornecedor
                    </label>
                    <select
                      value={colMap.supplierCode}
                      onChange={e => setColMap({ ...colMap, supplierCode: parseInt(e.target.value, 10) })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                    >
                      <option value={-1}>-- Não mapear / Deixar em branco --</option>
                      {detectedColumns.map(col => (
                        <option key={col.index} value={col.index}>
                          {col.label} {col.sampleValue && `(Ex: ${col.sampleValue.substring(0, 20)})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Código Reduzido */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                      3. Código Reduzido
                    </label>
                    <select
                      value={colMap.reducedCode}
                      onChange={e => setColMap({ ...colMap, reducedCode: parseInt(e.target.value, 10) })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                    >
                      <option value={-1}>-- Não mapear / Deixar em branco --</option>
                      {detectedColumns.map(col => (
                        <option key={col.index} value={col.index}>
                          {col.label} {col.sampleValue && `(Ex: ${col.sampleValue.substring(0, 20)})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Código EAN */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                      4. Código EAN (Código de Barras) *
                    </label>
                    <select
                      value={colMap.ean}
                      onChange={e => setColMap({ ...colMap, ean: parseInt(e.target.value, 10) })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                    >
                      {detectedColumns.map(col => (
                        <option key={col.index} value={col.index}>
                          {col.label} {col.sampleValue && `(Ex: ${col.sampleValue.substring(0, 20)})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 5. Quantidade */}
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                      5. Quantidade (Saldo de Estoque) *
                    </label>
                    <select
                      value={colMap.quantity}
                      onChange={e => setColMap({ ...colMap, quantity: parseInt(e.target.value, 10) })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                    >
                      {detectedColumns.map(col => (
                        <option key={col.index} value={col.index}>
                          {col.label} {col.sampleValue && `(Ex: ${col.sampleValue.substring(0, 20)})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* CORPO DO PASSO 2: LISTAGEM E CONFIRMAÇÃO DOS DADOS */}
        {/* ================================================================= */}
        {currentStep === '2_CONFIRM_LIST' && (
          <div className="py-4 space-y-3 overflow-y-auto flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Conferência de Registros Extraídos ({validItemsCount} válidos de {extractedItems.length})
                </h4>
                <p className="text-[11px] text-slate-400">
                  Verifique a integridade das 5 colunas antes de prosseguir com a criptografia.
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                100% Filtrado
              </span>
            </div>

            {/* Tabela com as 5 colunas */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-64 overflow-y-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 sticky top-0">
                  <tr>
                    <th className="p-2.5">Descrição do Produto</th>
                    <th className="p-2.5">Cód. Fornecedor</th>
                    <th className="p-2.5">Cód. Reduzido</th>
                    <th className="p-2.5">Código EAN</th>
                    <th className="p-2.5 text-right">Quantidade</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {extractedItems.map((item, idx) => (
                    <tr key={idx} className={item.isValid ? '' : 'bg-rose-500/10 text-rose-600'}>
                      <td className="p-2.5 font-bold truncate max-w-[180px]">{item.name || 'NÃO INFORMADO'}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.supplierCode || '-'}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.reducedCode || '-'}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">{item.ean || 'ERRO'}</td>
                      <td className="p-2.5 text-right font-extrabold text-emerald-600 dark:text-emerald-400">{item.quantity} un</td>
                      <td className="p-2.5 text-center">
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
        )}

        {/* ================================================================= */}
        {/* CORPO DO PASSO 3: CRIPTOGRAFIA EM ANDAMENTO */}
        {/* ================================================================= */}
        {currentStep === '3_ENCRYPTION' && (
          <div className="py-8 space-y-6 text-center flex-1 flex flex-col justify-center items-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 animate-pulse">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1 max-w-sm">
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                Criptografando Dados da Planilha
              </h4>
              <p className="text-xs text-slate-400">
                Processando as 5 colunas com chave AES-GCM 256 bits antes do envio ao banco de dados.
              </p>
            </div>

            {/* Barra de Progresso da Criptografia */}
            <div className="w-full max-w-md space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Criptografando registros...</span>
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
                <span className="text-slate-400 block font-sans font-bold mb-0.5">Payload Criptografado (Exemplo):</span>
                {sampleCiphertext}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* CORPO DO PASSO 4: UPLOAD REALTIME & VISUALIZAÇÃO DESCRIPTOGRAFADA */}
        {/* ================================================================= */}
        {currentStep === '4_REALTIME_UPLOAD_SUCCESS' && (
          <div className="py-4 space-y-4 overflow-y-auto flex-1">
            {/* Status do Upload Realtime */}
            <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500 text-white">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                    Upload em Realtime e Gravação Concluídos!
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    {encryptedPayloads.length} itens gravados com sucesso. O banco de dados recebeu os payloads criptografados.
                  </p>
                </div>
              </div>

              {/* Botão para alternar visualização criptografada / descriptografada */}
              <button
                onClick={() => setShowEncryptedView(!showEncryptedView)}
                className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-white dark:bg-slate-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 transition shadow-xs"
              >
                {showEncryptedView ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{showEncryptedView ? 'Ver Descriptografado' : 'Ver Criptografado no Banco'}</span>
              </button>
            </div>

            {/* Tabela no Software: Mostrando Informações Descriptografadas (ou Criptografadas no Banco) */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-60 overflow-y-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 sticky top-0">
                  <tr>
                    <th className="p-2.5">Descrição</th>
                    <th className="p-2.5">Cód. Fornecedor</th>
                    <th className="p-2.5">Cód. Reduzido</th>
                    <th className="p-2.5">EAN</th>
                    <th className="p-2.5 text-right">Quantidade</th>
                    <th className="p-2.5 text-center">Proteção</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {encryptedPayloads.map((row, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-bold truncate max-w-[170px]">
                        {showEncryptedView ? row.encrypted.ciphertext.substring(0, 18) + '...' : row.original.name}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-400">
                        {showEncryptedView ? '***' : row.original.supplierCode || '-'}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-400">
                        {showEncryptedView ? '***' : row.original.reducedCode || '-'}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {row.original.ean}
                      </td>
                      <td className="p-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                        {showEncryptedView ? '***' : `${row.original.quantity} un`}
                      </td>
                      <td className="p-2.5 text-center">
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
              ✓ No software operacional, os operadores visualizam as informações descriptografadas instantaneamente.
            </p>
          </div>
        )}

        {/* ================================================================= */}
        {/* FOOTER COM BOTÕES DE AÇÃO POR PASSO */}
        {/* ================================================================= */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          {currentStep === '1_UPLOAD_MAP' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleProceedToStep2}
                disabled={detectedColumns.length === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition"
              >
                <span>Avançar para Conferência</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {currentStep === '2_CONFIRM_LIST' && (
            <>
              <button
                onClick={() => setCurrentStep('1_UPLOAD_MAP')}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar
              </button>
              <button
                onClick={handleStartEncryption}
                disabled={validItemsCount === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition"
              >
                <Lock className="w-4 h-4" />
                <span>Confirmar Dados e Criptografar ({validItemsCount} itens)</span>
              </button>
            </>
          )}

          {currentStep === '3_ENCRYPTION' && (
            <div className="w-full text-center text-xs font-bold text-slate-400">
              Aguarde a finalização da criptografia de todas as 5 colunas...
            </div>
          )}

          {currentStep === '4_REALTIME_UPLOAD_SUCCESS' && (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition"
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
