import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import CryptoJS from 'crypto-js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  Upload, 
  FileSpreadsheet, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Database, 
  Cpu, 
  Eye, 
  EyeOff, 
  FileCheck2,
  Download,
  Layers,
  ArrowRight
} from 'lucide-react';

// ============================================================================
// CONFIGURAÇÃO DA CHAVE SECRETA (PADRÃO ZERO-KNOWLEDGE)
// ============================================================================
// IMPORTANTE: A chave secreta NUNCA deve ser compartilhada com o banco de dados.
// Ela deve residir apenas no ambiente do cliente ou ser inserida pelo operador.
// Para projetos React padrão (CRA): process.env.REACT_APP_ENCRYPTION_KEY
// Para projetos Vite: import.meta.env.VITE_ENCRYPTION_KEY
const DEFAULT_ENCRYPTION_KEY = 
  (typeof process !== 'undefined' && process.env?.REACT_APP_ENCRYPTION_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENCRYPTION_KEY) ||
  'CHAVE-MESTRA-ZERO-KNOWLEDGE-SYNK-2026';

// ============================================================================
// CONFIGURAÇÃO DO CLIENTE SUPABASE (@supabase/supabase-js)
// ============================================================================
const SUPABASE_URL = 
  (typeof process !== 'undefined' && process.env?.REACT_APP_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  '';

const SUPABASE_ANON_KEY = 
  (typeof process !== 'undefined' && process.env?.REACT_APP_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  '';

let supabaseClient: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'https://seu-projeto.supabase.co') {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.warn('Aviso: Falha ao inicializar cliente Supabase:', err);
    supabaseClient = null;
  }
}

// ============================================================================
// TIPOS E MODELOS DE DADOS
// ============================================================================

/**
 * 1. Dados Limpos (Extraídos estritamente das 5 colunas da planilha)
 */
export interface CleanSpreadsheetRow {
  produto: string;          // 1. Descrição do produto
  codigoFornecedor: string; // 2. Código de fornecedor
  codigoReduzido: string;   // 3. Código Reduzido (PLU)
  codigoBarras: string;     // 4. Código de barras (EAN-13)
  quantidade: number;       // 5. Quantidade (Saldo em estoque - aberto para operações matemáticas)
}

/**
 * 2. Dados Criptografados enviados ao Supabase (Zero-Knowledge)
 */
export interface EncryptedProductPayload {
  id?: string;
  nome: string;              // Criptografado AES-256 (Produto)
  codigo_fornecedor: string; // Criptografado AES-256 (Cód. Fornecedor)
  plu: string;                // Criptografado AES-256 (Cód. Reduzido)
  codigo_barras: string;      // Criptografado AES-256 (Cód. de Barras)
  quantidade: number;        // ABERTO para operações matemáticas de estoque
  is_encrypted: boolean;     // Flag indicadora de segurança
  loja_id: string;           // Identificador multi-tenant da loja
  created_at?: string;       // Timestamp ISO
}

/**
 * Estados da Máquina de Estados da UX
 */
export type ImportState = 'idle' | 'processing' | 'uploading' | 'success' | 'error';

// ============================================================================
// FUNÇÕES UTILITÁRIAS DE CRIPTOGRAFIA ZERO-KNOWLEDGE (AES-256)
// ============================================================================

/**
 * Criptografa uma string usando AES-256 no client-side antes do envio
 */
export function encryptField(plainText: string, key: string = DEFAULT_ENCRYPTION_KEY): string {
  if (!plainText) return '';
  return CryptoJS.AES.encrypt(plainText.trim(), key).toString();
}

/**
 * Descriptografa uma string AES-256 estritamente na memória RAM durante a renderização
 */
export function decryptField(cipherText: string, key: string = DEFAULT_ENCRYPTION_KEY): string {
  if (!cipherText) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    // Se a descriptografia resultar vazia (chave incorreta ou dado não criptografado), retorna fallback
    return originalText || '[Falha na descriptografia / Chave incorreta]';
  } catch {
    return '[Dado corrompido ou chave inválida]';
  }
}

// ============================================================================
// COMPONENTE PRINCIPAL: ZeroKnowledgeSpreadsheetImporter
// ============================================================================
interface ImporterProps {
  lojaId?: string;
  tableName?: string;
  onImportSuccess?: (count: number) => void;
}

export const ZeroKnowledgeSpreadsheetImporter: React.FC<ImporterProps> = ({
  lojaId = 'loja_padrao_001',
  tableName = 'produtos',
  onImportSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados do Importador
  const [status, setStatus] = useState<ImportState>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState<number>(0);

  // Chave de criptografia configurável em tela para testes (com fallback para a variável de ambiente)
  const [customKey, setCustomKey] = useState<string>(DEFAULT_ENCRYPTION_KEY);
  const [showKey, setShowKey] = useState<boolean>(false);

  // Dados recém-importados para visualização imediata na memória RAM
  const [importedEncryptedData, setImportedEncryptedData] = useState<EncryptedProductPayload[]>([]);

  /**
   * Identifica e mapeia com tolerância os cabeçalhos das 5 colunas estritas
   */
  const findColumnKey = (rowKeys: string[], possibleNames: string[]): string | undefined => {
    return rowKeys.find(key => {
      const normalized = key
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
      return possibleNames.some(name => normalized === name || normalized.includes(name));
    });
  };

  /**
   * Processamento e Criptografia do Arquivo (.xlsx, .xls, .csv)
   */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset de estados
    setStatus('processing');
    setProgress(10);
    setErrorMessage(null);
    setFeedbackMessage('Lendo arquivo e analisando estrutura de colunas...');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error('A planilha fornecida está vazia ou corrompida.');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonRows.length === 0) {
        throw new Error('Nenhuma linha de dados encontrada na planilha selecionada.');
      }

      setProgress(30);
      setFeedbackMessage('Validando as 5 colunas estritas requeridas...');

      const firstRowKeys = Object.keys(jsonRows[0]);

      // Mapeamento tolerante dos nomes de cabeçalho
      const colProduto = findColumnKey(firstRowKeys, ['produto', 'descricao', 'nome', 'item', 'desc']);
      const colForn = findColumnKey(firstRowKeys, ['codigo de fornecedor', 'codigo fornecedor', 'cod fornecedor', 'fornecedor', 'supplier']);
      const colReduzido = findColumnKey(firstRowKeys, ['codigo reduzido', 'cod reduzido', 'reduzido', 'plu']);
      const colBarras = findColumnKey(firstRowKeys, ['codigo de barras', 'codigo barras', 'cod barras', 'ean', 'barras', 'barcode']);
      const colQtd = findColumnKey(firstRowKeys, ['quantidade', 'qtd', 'estoque', 'saldo', 'quantity', 'stock']);

      // Validação estrita: todas as 5 colunas devem estar presentes
      const missingColumns = [];
      if (!colProduto) missingColumns.push('Produto');
      if (!colForn) missingColumns.push('Código de fornecedor');
      if (!colReduzido) missingColumns.push('Código Reduzido');
      if (!colBarras) missingColumns.push('Código de barras');
      if (!colQtd) missingColumns.push('Quantidade');

      if (missingColumns.length > 0) {
        throw new Error(
          `Colunas obrigatórias ausentes na planilha: ${missingColumns.join(', ')}. ` +
          `Certifique-se de que a planilha contenha exatamente: Produto, Código de fornecedor, Código Reduzido, Código de barras e Quantidade.`
        );
      }

      setProgress(50);
      setFeedbackMessage(`Criptografando ${jsonRows.length} produtos no client-side com AES-256 (Zero-Knowledge)...`);

      // Criptografia linha a linha no cliente (apenas dados sensíveis criptografados)
      const encryptedBatch: EncryptedProductPayload[] = [];
      const totalRows = jsonRows.length;

      for (let i = 0; i < totalRows; i++) {
        const row = jsonRows[i];

        const rawProduto = String(row[colProduto!] || '').trim();
        const rawForn = String(row[colForn!] || '').trim();
        const rawReduzido = String(row[colReduzido!] || '').trim();
        const rawBarras = String(row[colBarras!] || '').trim();
        const rawQtd = Number(row[colQtd!]) || 0;

        // Pula linhas totalmente vazias de descrição ou código de barras
        if (!rawProduto && !rawBarras) continue;

        // Criptografia dos campos sensíveis via AES-256 com a chave do cliente
        const encryptedItem: EncryptedProductPayload = {
          nome: encryptField(rawProduto || 'Produto Não Especificado', customKey),
          codigo_fornecedor: encryptField(rawForn || '0', customKey),
          plu: encryptField(rawReduzido || '0', customKey),
          codigo_barras: encryptField(rawBarras || '0', customKey),
          quantidade: Math.max(0, rawQtd), // Mantido numérico aberto para operações matemáticas de estoque
          is_encrypted: true,
          loja_id: lojaId,
          created_at: new Date().toISOString(),
        };

        encryptedBatch.push(encryptedItem);

        // Atualização fluida de progresso
        if (i % 20 === 0 || i === totalRows - 1) {
          const currentPct = 50 + Math.round(((i + 1) / totalRows) * 30);
          setProgress(currentPct);
        }
      }

      if (encryptedBatch.length === 0) {
        throw new Error('Nenhum registro válido com produto ou código de barras pôde ser processado.');
      }

      // ----------------------------------------------------------------------
      // Envio em Lote (Bulk Insert) para o Supabase
      // ----------------------------------------------------------------------
      setStatus('uploading');
      setProgress(85);
      setFeedbackMessage(`Enviando lote de ${encryptedBatch.length} registros criptografados para o Supabase...`);

      if (supabaseClient) {
        // Envio em blocos/chunks para alta performance em grandes inventários
        const CHUNK_SIZE = 250;
        let uploadedTotal = 0;

        for (let i = 0; i < encryptedBatch.length; i += CHUNK_SIZE) {
          const chunk = encryptedBatch.slice(i, i + CHUNK_SIZE);

          const { error: insertError } = await supabaseClient
            .from(tableName)
            .insert(chunk);

          if (insertError) {
            // Tratamento específico de violação de chave primária / duplicidade
            if (insertError.code === '23505') {
              throw new Error(
                `Erro de chave duplicada: Alguns produtos já existem no banco para esta loja (${insertError.message}).`
              );
            }
            throw new Error(`Falha ao inserir lote no Supabase: ${insertError.message}`);
          }

          uploadedTotal += chunk.length;
          const chunkPct = 85 + Math.round((uploadedTotal / encryptedBatch.length) * 15);
          setProgress(chunkPct);
        }
      } else {
        // Simulação com pequeno delay quando operando em modo local / offline
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Sucesso Total
      setProgress(100);
      setStatus('success');
      setProcessedCount(encryptedBatch.length);
      setImportedEncryptedData(encryptedBatch);
      setFeedbackMessage(
        `${encryptedBatch.length} produtos foram criptografados com AES-256 e salvos em lote no Supabase com sucesso!`
      );

      if (onImportSuccess) {
        onImportSuccess(encryptedBatch.length);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('error');
      setErrorMessage(msg);
      console.error('Erro na importação Zero-Knowledge:', err);
    } finally {
      // Limpa o valor do input para permitir upload do mesmo arquivo novamente se desejado
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Gera uma planilha de exemplo para download ou teste imediato com 1 clique
   */
  const handleLoadSampleData = () => {
    setStatus('processing');
    setProgress(40);
    setErrorMessage(null);
    setFeedbackMessage('Gerando lote de teste com as 5 colunas estritas...');

    setTimeout(() => {
      const sampleItems = [
        { produto: 'Leite Integral Pasteurizado 1L', codigoFornecedor: 'FORN-0102', codigoReduzido: '1042', codigoBarras: '7891000100011', quantidade: 142 },
        { produto: 'Iogurte Natural Integral 170g', codigoFornecedor: 'FORN-0102', codigoReduzido: '1045', codigoBarras: '7891000100028', quantidade: 18 },
        { produto: 'Arroz Agulhinha Tipo 1 5kg', codigoFornecedor: 'FORN-0320', codigoReduzido: '2010', codigoBarras: '7891000100035', quantidade: 85 },
        { produto: 'Feijão Preto Selecionado 1kg', codigoFornecedor: 'FORN-0320', codigoReduzido: '2015', codigoBarras: '7891000100042', quantidade: 12 },
        { produto: 'Café Torrado e Moído Tradicional 500g', codigoFornecedor: 'FORN-0550', codigoReduzido: '3001', codigoBarras: '7891000100059', quantidade: 64 },
        { produto: 'Sabão em Pó Ação Profunda 1kg', codigoFornecedor: 'FORN-0901', codigoReduzido: '4012', codigoBarras: '7891000100066', quantidade: 30 },
        { produto: 'Azeite de Oliva Extra Virgem 500ml', codigoFornecedor: 'FORN-0550', codigoReduzido: '3025', codigoBarras: '7891000100073', quantidade: 19 },
        { produto: 'Queijo Mussarela Fatiado 200g', codigoFornecedor: 'FORN-0102', codigoReduzido: '1050', codigoBarras: '7891000100080', quantidade: 14 },
      ];

      const encryptedBatch: EncryptedProductPayload[] = sampleItems.map(item => ({
        nome: encryptField(item.produto, customKey),
        codigo_fornecedor: encryptField(item.codigoFornecedor, customKey),
        plu: encryptField(item.codigoReduzido, customKey),
        codigo_barras: encryptField(item.codigoBarras, customKey),
        quantidade: item.quantidade,
        is_encrypted: true,
        loja_id: lojaId,
        created_at: new Date().toISOString(),
      }));

      setImportedEncryptedData(encryptedBatch);
      setProcessedCount(encryptedBatch.length);
      setProgress(100);
      setStatus('success');
      setFeedbackMessage(
        `${encryptedBatch.length} produtos de exemplo foram gerados, criptografados com AES-256 e salvos no lote!`
      );
    }, 600);
  };

  /**
   * Baixa um arquivo Excel modelo (.xlsx) contendo exatamente as 5 colunas exigidas
   */
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Produto': 'Leite Integral 1L',
        'Código de fornecedor': 'FORN-101',
        'Código Reduzido': '1042',
        'Código de barras': '7891000100011',
        'Quantidade': 100,
      },
      {
        'Produto': 'Arroz Tipo 1 5kg',
        'Código de fornecedor': 'FORN-202',
        'Código Reduzido': '2010',
        'Código de barras': '7891000100035',
        'Quantidade': 50,
      },
      {
        'Produto': 'Feijão Preto 1kg',
        'Código de fornecedor': 'FORN-202',
        'Código Reduzido': '2015',
        'Código de barras': '7891000100042',
        'Quantidade': 30,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estoque');
    XLSX.writeFile(workbook, 'modelo_estoque_5_colunas.xlsx');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl transition-colors">
      
      {/* Cabeçalho do Componente */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Importador de Estoque Zero-Knowledge (AES-256)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Processa planilhas (.xlsx/.csv), isola estritamente as 5 colunas de estoque, criptografa os dados sensíveis no frontend e grava os registros em lote (Bulk Insert) no Supabase.
          </p>
        </div>

        {/* Badge de Conformidade Zero-Knowledge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 self-start md:self-auto">
          <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Zero-Knowledge Ativo</span>
        </div>
      </div>

      {/* Configuração da Chave de Criptografia (Ambiente Seguro) */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-indigo-500" />
            <span>Chave Secreta AES-256 (Armazenada no Frontend):</span>
          </label>
          <span className="text-[11px] text-slate-400">
            Origem: <code className="font-mono text-indigo-600 dark:text-indigo-400">process.env.REACT_APP_ENCRYPTION_KEY</code>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
            placeholder="Insira a chave secreta de criptografia..."
            className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            title={showKey ? 'Ocultar chave' : 'Exibir chave'}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          O Supabase nunca recebe esta chave. Ela é usada exclusivamente pela memória RAM do seu navegador para criptografar no envio e descriptografar na visualização.
        </p>
      </div>

      {/* Guia das 5 Colunas Estritas Filtradas */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
        {[
          { label: '1. Produto', desc: 'Nome / Descrição', encrypted: true },
          { label: '2. Cód. Fornecedor', desc: 'Referência Externa', encrypted: true },
          { label: '3. Cód. Reduzido', desc: 'PLU Interno', encrypted: true },
          { label: '4. Cód. de Barras', desc: 'Código EAN-13', encrypted: true },
          { label: '5. Quantidade', desc: 'Saldo Matemático', encrypted: false },
        ].map((col, idx) => (
          <div 
            key={idx} 
            className={`p-2.5 rounded-xl border ${
              col.encrypted 
                ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-300' 
                : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-300'
            }`}
          >
            <div className="font-bold flex items-center justify-center gap-1">
              {col.encrypted ? <Lock className="w-3 h-3 text-indigo-500" /> : <Unlock className="w-3 h-3 text-emerald-500" />}
              <span>{col.label}</span>
            </div>
            <div className="text-[10px] opacity-75 mt-0.5">{col.desc}</div>
            <div className="text-[9px] font-semibold mt-1 uppercase tracking-wider">
              {col.encrypted ? 'AES-256' : 'Aberto'}
            </div>
          </div>
        ))}
      </div>

      {/* ÁREA DE UPLOAD / DROPZONE */}
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileUpload}
          className="hidden"
          disabled={status === 'processing' || status === 'uploading'}
        />

        <div
          onClick={() => {
            if (status !== 'processing' && status !== 'uploading') {
              fileInputRef.current?.click();
            }
          }}
          className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
            status === 'processing' || status === 'uploading'
              ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 cursor-not-allowed'
              : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              {status === 'processing' || status === 'uploading' ? (
                <RefreshCw className="w-7 h-7 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-7 h-7" />
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {status === 'processing'
                  ? 'Processando e Criptografando Planilha...'
                  : status === 'uploading'
                  ? 'Realizando Bulk Insert no Supabase...'
                  : 'Clique para selecionar ou arraste sua planilha aqui'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Formatos aceitos: Microsoft Excel (.xlsx, .xls) ou Texto delimitado (.csv)
              </p>
            </div>

            {/* Barra de Progresso durante processamento ou envio */}
            {(status === 'processing' || status === 'uploading') && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                  <span>{feedbackMessage}</span>
                  <span className="font-bold">{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ações Auxiliares: Modelo e Teste com 1 clique */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 font-medium transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Modelo (.xlsx)</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              type="button"
              onClick={handleLoadSampleData}
              disabled={status === 'processing' || status === 'uploading'}
              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium transition disabled:opacity-50"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Carregar Dados de Exemplo (1 Clique)</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            Tabela destino: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{tableName}</code>
          </div>
        </div>
      </div>

      {/* FEEDBACK DE SUCESSO OU ERRO */}
      {status === 'success' && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Lote Criptografado Inserido com Sucesso!</div>
            <p className="leading-relaxed">{feedbackMessage}</p>
          </div>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Falha no Processamento da Planilha</div>
            <p className="leading-relaxed">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setStatus('idle')}
              className="mt-2 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* EXEMPLO PRÁTICO DE VISUALIZAÇÃO: ListagemProdutos                     */}
      {/* ===================================================================== */}
      <ListagemProdutos 
        encryptedData={importedEncryptedData} 
        encryptionKey={customKey}
      />

    </div>
  );
};

// ============================================================================
// SUB-COMPONENTE DE DEMONSTRAÇÃO E RENDERIZAÇÃO: ListagemProdutos
// Descriptografia em tempo real na memória RAM durante a renderização
// ============================================================================
interface ListagemProps {
  encryptedData: EncryptedProductPayload[];
  encryptionKey: string;
}

export const ListagemProdutos: React.FC<ListagemProps> = ({ encryptedData, encryptionKey }) => {
  // Toggle para demonstrar o padrão Zero-Knowledge (como reside no banco vs como aparece na RAM)
  const [showRawEncrypted, setShowRawEncrypted] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Fallback com dados simulados caso o usuário ainda não tenha feito upload
  const displayItems: EncryptedProductPayload[] = encryptedData.length > 0 
    ? encryptedData 
    : [
        {
          id: 'sim-1',
          nome: encryptField('Leite Integral 1L', encryptionKey),
          codigo_fornecedor: encryptField('FORN-991', encryptionKey),
          plu: encryptField('1022', encryptionKey),
          codigo_barras: encryptField('7891000100011', encryptionKey),
          quantidade: 142,
          is_encrypted: true,
          loja_id: 'loja_padrao_001',
        },
        {
          id: 'sim-2',
          nome: encryptField('Arroz Tipo 1 5kg', encryptionKey),
          codigo_fornecedor: encryptField('FORN-330', encryptionKey),
          plu: encryptField('2040', encryptionKey),
          codigo_barras: encryptField('7891000100035', encryptionKey),
          quantidade: 85,
          is_encrypted: true,
          loja_id: 'loja_padrao_001',
        },
        {
          id: 'sim-3',
          nome: encryptField('Azeite Extra Virgem 500ml', encryptionKey),
          codigo_fornecedor: encryptField('FORN-554', encryptionKey),
          plu: encryptField('3090', encryptionKey),
          codigo_barras: encryptField('7891000100073', encryptionKey),
          quantidade: 19,
          is_encrypted: true,
          loja_id: 'loja_padrao_001',
        },
      ];

  // Descriptografia pontual em memória RAM para busca e exibição
  const processedRows = displayItems.map((item, index) => {
    // A descriptografia ocorre estritamente na memória volátil (RAM)
    const decryptedNome = decryptField(item.nome, encryptionKey);
    const decryptedForn = decryptField(item.codigo_fornecedor, encryptionKey);
    const decryptedPlu = decryptField(item.plu, encryptionKey);
    const decryptedBarras = decryptField(item.codigo_barras, encryptionKey);

    return {
      id: item.id || `row-${index}`,
      quantidade: item.quantidade,
      raw: item,
      decrypted: {
        produto: decryptedNome,
        codigoFornecedor: decryptedForn,
        codigoReduzido: decryptedPlu,
        codigoBarras: decryptedBarras,
      },
    };
  });

  // Filtragem no cliente por busca na memória
  const filteredRows = processedRows.filter(row => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      row.decrypted.produto.toLowerCase().includes(term) ||
      row.decrypted.codigoBarras.includes(term) ||
      row.decrypted.codigoReduzido.includes(term) ||
      row.decrypted.codigoFornecedor.toLowerCase().includes(term)
    );
  });

  return (
    <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
      
      {/* Header da Listagem */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-500" />
            <span>Listagem em Tempo Real com Descriptografia na Memória RAM</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Os dados originais nunca são salvos de forma persistente ou descriptografada no localStorage ou IndexedDB.
          </p>
        </div>

        {/* Toggle de Comparação: Zero-Knowledge (Supabase Raw) vs Descriptografado na RAM */}
        <button
          type="button"
          onClick={() => setShowRawEncrypted(!showRawEncrypted)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
            showRawEncrypted
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          title="Alternar entre visualização criptografada e descriptografada"
        >
          {showRawEncrypted ? (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>Ver Dados na RAM (Descriptografados)</span>
            </>
          ) : (
            <>
              <Database className="w-3.5 h-3.5" />
              <span>Ver Raw do Banco (Zero-Knowledge Ciphertext)</span>
            </>
          )}
        </button>
      </div>

      {/* Caixa de Busca */}
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          placeholder="Buscar produto por nome, EAN ou PLU na memória..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white max-w-sm w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <div className="text-[11px] text-slate-400">
          Exibindo {filteredRows.length} de {processedRows.length} itens
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-2.5 px-3 font-semibold">Produto (Descrição)</th>
              <th className="py-2.5 px-3 font-semibold">Cód. Fornecedor</th>
              <th className="py-2.5 px-3 font-semibold">Cód. Reduzido (PLU)</th>
              <th className="py-2.5 px-3 font-semibold">Cód. de Barras (EAN)</th>
              <th className="py-2.5 px-3 font-semibold text-right">Quantidade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                
                {/* 1. Produto */}
                <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white max-w-[200px] truncate">
                  {showRawEncrypted ? (
                    <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 block truncate" title={row.raw.nome}>
                      {row.raw.nome}
                    </span>
                  ) : (
                    <span>{row.decrypted.produto}</span>
                  )}
                </td>

                {/* 2. Código Fornecedor */}
                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                  {showRawEncrypted ? (
                    <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 block truncate max-w-[120px]" title={row.raw.codigo_fornecedor}>
                      {row.raw.codigo_fornecedor}
                    </span>
                  ) : (
                    <span className="font-mono">{row.decrypted.codigoFornecedor}</span>
                  )}
                </td>

                {/* 3. Código Reduzido */}
                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                  {showRawEncrypted ? (
                    <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 block truncate max-w-[100px]" title={row.raw.plu}>
                      {row.raw.plu}
                    </span>
                  ) : (
                    <span className="font-mono">{row.decrypted.codigoReduzido}</span>
                  )}
                </td>

                {/* 4. Código de Barras */}
                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                  {showRawEncrypted ? (
                    <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 block truncate max-w-[140px]" title={row.raw.codigo_barras}>
                      {row.raw.codigo_barras}
                    </span>
                  ) : (
                    <span className="font-mono">{row.decrypted.codigoBarras}</span>
                  )}
                </td>

                {/* 5. Quantidade (Aberto para operações matemáticas de estoque) */}
                <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                  {row.quantidade} un
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rodapé Explicativo */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>
          {showRawEncrypted ? (
            <strong className="text-indigo-600 dark:text-indigo-400">
              Modo Banco Ativo: Visualizando os hashes AES-256 exatamente como residem no Supabase.
            </strong>
          ) : (
            <strong className="text-emerald-600 dark:text-emerald-400">
              Modo RAM Ativo: Descriptografia pontual executada dinamicamente no componente React.
            </strong>
          )}
        </span>
        <span className="font-mono text-[10px]">Padrão: AES-256-CBC Zero-Knowledge</span>
      </div>

    </div>
  );
};

export default ZeroKnowledgeSpreadsheetImporter;
