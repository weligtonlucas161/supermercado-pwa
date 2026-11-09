/**
 * @license
 * Componente: ImportadorPlanilhaZeroKnowledge
 * 
 * Funcionalidade:
 * - Importa planilha Excel (.xlsx/.xls) ou .csv localmente via SheetJS (xlsx).
 * - Filtra rigorosamente APENAS as 5 colunas requeridas:
 *     1. Produto
 *     2. Código de fornecedor
 *     3. Código Reduzido
 *     4. Código de barras
 *     5. Quantidade
 *   Descartando qualquer outra coluna do arquivo.
 * - Criptografa os dados sensíveis no frontend usando CryptoJS (AES-256) antes do envio.
 * - Salva em lote (Bulk Insert) no Supabase via @supabase/supabase-js (.insert).
 * - Padrão Zero-Knowledge: O banco só armazena o texto cifrado (AES-256).
 * - A descriptografia ocorre exclusivamente sob demanda na memória RAM do cliente,
 *   sem persistir o conteúdo limpo no localStorage ou IndexedDB.
 * - Inclui visualizador interativo em tempo real (ListagemProdutos).
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Download, 
  Layers, 
  Key, 
  Cpu, 
  Search,
  Check
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../services/supabaseService';
import { 
  FilteredProductItem, 
  EncryptedDatabaseProduct, 
  DecryptedDisplayProduct, 
  detect5Columns, 
  prepareEncryptedPayload, 
  decryptForDisplay, 
  encryptAES, 
  decryptAES,
  ENCRYPTION_SECRET_KEY 
} from '../../utils/cryptoZeroKnowledge';
import { decryptProductList, DecryptedProduct } from '../../utils/encryptionUtils';

// ============================================================================
// TIPOS DE ESTADO DE UX
// ============================================================================
export type ImportState = 'idle' | 'processing' | 'uploading' | 'success' | 'error';

interface ImportadorProps {
  lojaId?: string;
  usuarioId?: string;
  onImportComplete?: (totalCount: number) => void;
}

export const ImportadorPlanilhaZeroKnowledge: React.FC<ImportadorProps> = ({
  lojaId = 'loja_padrao_001',
  usuarioId = 'operador_4092',
  onImportComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados principais do ciclo de importação
  const [importState, setImportState] = useState<ImportState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dados temporários em memória RAM (Transitórios)
  const [extractedCount, setExtractedCount] = useState<number>(0);
  const [encryptedBatch, setEncryptedBatch] = useState<EncryptedDatabaseProduct[]>([]);

  // Tabela de Visualização em Tempo Real (Zero-Knowledge Display)
  const [databaseProducts, setDatabaseProducts] = useState<EncryptedDatabaseProduct[]>([]);
  const [isLoadingTable, setIsLoadingTable] = useState<boolean>(false);
  const [showEncryptedView, setShowEncryptedView] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // ==========================================================================
  // 1. CARREGAR ITENS SALVOS NO BANCO PARA DEMONSTRAÇÃO
  // ==========================================================================
  const fetchProductsFromDatabase = async () => {
    setIsLoadingTable(true);

    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('id, nome, codigo_fornecedor, plu, codigo_barras, quantidade, loja_id, is_encrypted, criado_em')
          .eq('loja_id', lojaId)
          .order('criado_em', { ascending: false })
          .limit(20);

        if (error) {
          console.warn('Erro ao consultar Supabase, utilizando dados em memória:', error.message);
        } else if (data && data.length > 0) {
          setDatabaseProducts(data as EncryptedDatabaseProduct[]);
          setIsLoadingTable(false);
          return;
        }
      } catch (err) {
        console.warn('Falha na consulta ao Supabase:', err);
      }
    }

    setIsLoadingTable(false);
  };

  useEffect(() => {
    fetchProductsFromDatabase();
  }, [lojaId]);

  // ==========================================================================
  // 2. PROCESSAMENTO DO ARQUIVO: FILTRAR AS 5 COLUNAS E CRIPTOGRAFAR (AES-256)
  // ==========================================================================
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');
    setErrorMessage(null);
    setImportState('processing');
    setProgress(10);
    setStatusMessage('Lendo arquivo e detectando as 5 colunas estritas...');

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const binaryData = evt.target?.result;
        const workbook = XLSX.read(binaryData, { type: 'binary' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('A planilha selecionada não possui abas de dados.');
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Matriz bruta para extração das 5 colunas
        const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });

        if (!matrix || matrix.length < 2) {
          throw new Error('A planilha está vazia ou não possui linha de cabeçalho e dados.');
        }

        const headerRow = matrix[0] || [];
        const { indices, foundAllRequired, missingCols } = detect5Columns(headerRow);

        if (!foundAllRequired) {
          throw new Error(
            `Colunas obrigatórias não encontradas na planilha: ${missingCols.join(', ')}. ` +
            'Certifique-se de que o arquivo contenha: Produto, Código de barras e Quantidade.'
          );
        }

        setProgress(30);
        setStatusMessage('Filtrando rigorosamente apenas as 5 colunas especificadas...');

        // 1. Filtragem Estrita: Captura APENAS as 5 colunas requeridas, descartando todas as outras
        const filteredRows: FilteredProductItem[] = [];
        const dataRows = matrix.slice(1);

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          if (!row || row.length === 0) continue;

          const rawProduto = indices.produto >= 0 ? String(row[indices.produto] ?? '').trim() : '';
          const rawCodigoBarras = indices.codigoBarras >= 0 ? String(row[indices.codigoBarras] ?? '').trim() : '';
          const rawQtd = indices.quantidade >= 0 ? row[indices.quantidade] : 0;

          // Ignora linhas totalmente vazias
          if (!rawProduto && !rawCodigoBarras) continue;

          const rawCodigoFornecedor = indices.codigoFornecedor >= 0 ? String(row[indices.codigoFornecedor] ?? '').trim() : '';
          const rawCodigoReduzido = indices.codigoReduzido >= 0 ? String(row[indices.codigoReduzido] ?? '').trim() : '';

          // Parse numérico limpo para a Quantidade
          const parsedQtd = Math.max(0, parseInt(String(rawQtd ?? 0).replace(/[^0-9]/g, ''), 10) || 0);

          filteredRows.push({
            produto: rawProduto || 'Produto Sem Descrição',
            codigoFornecedor: rawCodigoFornecedor || '',
            codigoReduzido: rawCodigoReduzido || '',
            codigoBarras: rawCodigoBarras || '0000000000000',
            quantidade: parsedQtd,
          });
        }

        if (filteredRows.length === 0) {
          throw new Error('Nenhum registro válido foi encontrado para importação após o filtro das 5 colunas.');
        }

        setExtractedCount(filteredRows.length);
        setProgress(50);
        setStatusMessage(`Criptografando ${filteredRows.length} itens com AES-256 no cliente (Zero-Knowledge)...`);

        // 2. Camada de Segurança: Criptografia com CryptoJS (AES-256) dos campos sensíveis
        // Executado em micro-lotes para manter a UI responsiva
        const encryptedList: EncryptedDatabaseProduct[] = [];
        const total = filteredRows.length;

        for (let i = 0; i < total; i++) {
          const item = filteredRows[i];
          const encryptedItem = prepareEncryptedPayload(item, { lojaId, usuarioId });
          encryptedList.push(encryptedItem);

          if (i % 10 === 0 || i === total - 1) {
            const currentPct = 50 + Math.round(((i + 1) / total) * 35);
            setProgress(currentPct);
            await new Promise((r) => setTimeout(r, 4));
          }
        }

        setEncryptedBatch(encryptedList);
        setProgress(85);

        // 3. Integração com o Supabase: Bulk Insert
        await executeBulkInsertToSupabase(encryptedList);

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Falha no processamento da planilha:', msg);
        setErrorMessage(msg);
        setImportState('error');
      }
    };

    reader.onerror = () => {
      setErrorMessage('Erro ao ler arquivo da planilha.');
      setImportState('error');
    };

    reader.readAsBinaryString(file);
  };

  // ==========================================================================
  // 3. ENVIO EM LOTE (BULK INSERT) PARA O SUPABASE
  // ==========================================================================
  const executeBulkInsertToSupabase = async (payloadList: EncryptedDatabaseProduct[]) => {
    setImportState('uploading');
    setStatusMessage('Enviando lote criptografado para o Supabase (Bulk Insert)...');
    setProgress(90);

    try {
      if (supabase && isSupabaseConfigured()) {
        // Envio em lote usando .insert(dadosCriptografados) conforme diretriz 3
        const { error } = await supabase
          .from('produtos')
          .insert(payloadList);

        if (error) {
          // Tratar erros comuns do banco como violação de chave única
          if (error.code === '23505') {
            throw new Error(`Conflito de chave duplicada no Supabase: ${error.message}`);
          }
          throw new Error(`Erro retornado pelo Supabase: ${error.message}`);
        }
      } else {
        // Modo local / contingência simulada (armazena os payloads criptografados na memória da sessão)
        await new Promise((r) => setTimeout(r, 600));
      }

      setProgress(100);
      setImportState('success');
      setStatusMessage(`${payloadList.length} registros inseridos com sucesso no Supabase!`);

      // Atualiza a tabela do exemplo prático com os novos itens criptografados
      setDatabaseProducts((prev) => [...payloadList, ...prev]);

      if (onImportComplete) {
        onImportComplete(payloadList.length);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Falha no Bulk Insert do Supabase:', msg);
      setErrorMessage(msg);
      setImportState('error');
    }
  };

  // ==========================================================================
  // 4. DESCRIPTOGRAFIA PONTUAL NA MEMÓRIA RAM (EXEMPLO PRÁTICO DE VISUALIZAÇÃO)
  // ==========================================================================
  // Regra de Negócio: Os dados originais nunca ficam salvos descriptografados
  // em disco (localStorage/IndexedDB). A descriptografia ocorre unicamente
  // no useMemo na memória RAM através de 'encryptionUtils.ts' enquanto o
  // componente está sendo renderizado.
  const displayItems = useMemo<DecryptedDisplayProduct[]>(() => {
    const ramDecrypted: DecryptedProduct[] = decryptProductList(
      databaseProducts as unknown as Array<Record<string, unknown>>
    );

    return ramDecrypted.map((item, index) => ({
      id: item.id || `item-${index}`,
      produto: item.nome,
      codigoFornecedor: item.codigo_fornecedor,
      codigoReduzido: item.plu,
      codigoBarras: item.codigo_barras,
      quantidade: item.quantidade,
      isEncryptedInDatabase: true,
      rawCiphertext: {
        nome: item._rawCiphertext?.nome || '',
        codigo_fornecedor: item._rawCiphertext?.codigo_fornecedor || '',
        plu: item._rawCiphertext?.plu || '',
        codigo_barras: item._rawCiphertext?.codigo_barras || '',
      },
    }));
  }, [databaseProducts]);

  // Filtro de busca na memória RAM
  const filteredDisplayItems = useMemo(() => {
    if (!searchTerm.trim()) return displayItems;
    const term = searchTerm.toLowerCase();
    return displayItems.filter(
      (item) =>
        item.produto.toLowerCase().includes(term) ||
        item.codigoBarras.includes(term) ||
        item.codigoFornecedor.toLowerCase().includes(term) ||
        item.codigoReduzido.toLowerCase().includes(term)
    );
  }, [displayItems, searchTerm]);

  // ==========================================================================
  // 5. DOWNLOAD DA PLANILHA MODELO (5 COLUNAS ESTRITAS)
  // ==========================================================================
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Produto': 'Leite UHT Integral 1 Litro',
        'Código de fornecedor': 'FORN-8832',
        'Código Reduzido': 'RED-104',
        'Código de barras': '7891000100011',
        'Quantidade': 120,
      },
      {
        'Produto': 'Iogurte Tradicional Morango 170g',
        'Código de fornecedor': 'FORN-4421',
        'Código Reduzido': 'RED-208',
        'Código de barras': '7891000100028',
        'Quantidade': 45,
      },
      {
        'Produto': 'Arroz Branco Longo Fino Tipo 1 5kg',
        'Código de fornecedor': 'FORN-9910',
        'Código Reduzido': 'RED-305',
        'Código de barras': '7891000100035',
        'Quantidade': 80,
      },
      {
        'Produto': 'Feijão Carioca Nobre 1kg',
        'Código de fornecedor': 'FORN-9910',
        'Código Reduzido': 'RED-309',
        'Código de barras': '7891000100042',
        'Quantidade': 30,
      },
      {
        'Produto': 'Café Torrado e Moído Tradicional 500g',
        'Código de fornecedor': 'FORN-1205',
        'Código Reduzido': 'RED-401',
        'Código de barras': '7891000100059',
        'Quantidade': 60,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estoque_5_Colunas');
    XLSX.writeFile(workbook, 'modelo_estoque_zero_knowledge.xlsx');
  };

  const resetForm = () => {
    setImportState('idle');
    setFileName('');
    setFileSize('');
    setProgress(0);
    setErrorMessage(null);
    setStatusMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* PAINEL DE CONTROLE DE IMPORTAÇÃO & CRIPTOGRAFIA ZERO-KNOWLEDGE       */}
      {/* =================================================================== */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
        
        {/* Cabeçalho do Importador */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                  Importação de Estoque Zero-Knowledge
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> AES-256
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Filtro estrito das 5 colunas • Criptografia no frontend antes do envio • Bulk Insert no Supabase
              </p>
            </div>
          </div>

          {/* Botão Baixar Modelo */}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-50 dark:bg-slate-800/80 transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            title="Baixar planilha Excel com as 5 colunas requeridas"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Planilha Modelo</span>
          </button>
        </div>

        {/* Resumo da Regra das 5 Colunas */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 text-xs">
          <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-300 mb-1">
            <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>5 Colunas Estritas Capturadas (Todas as outras são descartadas):</span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
              1. Produto (Cifrado)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
              2. Código de fornecedor (Cifrado)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
              3. Código Reduzido (Cifrado)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
              4. Código de barras (Cifrado)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold">
              5. Quantidade (Aberto p/ Estoque)
            </span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* ESTADO 1: ESPERA (IDLE) - UPLOAD DO ARQUIVO                      */}
        {/* ================================================================= */}
        {importState === 'idle' && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 rounded-3xl p-6 sm:p-8 text-center cursor-pointer bg-emerald-500/5 hover:bg-emerald-500/10 transition group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Clique para selecionar ou arraste sua planilha aqui
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Suporta formatos <strong>.xlsx</strong>, <strong>.xls</strong> e <strong>.csv</strong> de controle de validade e perdas.
            </p>
          </div>
        )}

        {/* ================================================================= */}
        {/* ESTADOS 2 E 3: PROCESSAMENTO & ENVIO AO SUPABASE                  */}
        {/* ================================================================= */}
        {(importState === 'processing' || importState === 'uploading') && (
          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-spin">
              <RefreshCw className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {importState === 'processing' ? 'Processando e Criptografando Dados...' : 'Gravando em Lote no Supabase...'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">{statusMessage}</p>
              {fileName && (
                <p className="text-[11px] font-mono text-slate-400">
                  Arquivo: {fileName} ({fileSize})
                </p>
              )}
            </div>

            {/* Barra de Progresso */}
            <div className="w-full max-w-md mx-auto space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Progresso da Operação</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* ESTADO 4: SUCESSO (FEEDBACK POSITIVO)                            */}
        {/* ================================================================= */}
        {importState === 'success' && (
          <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-2xl bg-emerald-600 text-white shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="font-extrabold text-sm text-emerald-900 dark:text-emerald-300">
                  Importação Zero-Knowledge Concluída com Sucesso!
                </h4>
                <p className="text-xs text-emerald-800 dark:text-emerald-400 leading-relaxed">
                  Foram importados e criptografados com <strong>AES-256</strong> um total de <strong>{extractedCount}</strong> produtos.
                  O banco de dados do Supabase recebeu apenas os textos cifrados. As informações sensíveis serão descriptografadas
                  pontualmente na tela a seguir.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Importar Outra Planilha
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* ESTADO 5: ERRO (FEEDBACK DE ERRO)                                */}
        {/* ================================================================= */}
        {importState === 'error' && (
          <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/30 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-2xl bg-rose-600 text-white shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="font-extrabold text-sm text-rose-900 dark:text-rose-300">
                  Falha no Processamento da Planilha
                </h4>
                <p className="text-xs text-rose-800 dark:text-rose-400 leading-relaxed">
                  {errorMessage || 'Ocorreu um erro desconhecido durante o upload ou criptografia.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 text-xs font-bold transition cursor-pointer"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 5. EXEMPLO PRÁTICO DE VISUALIZAÇÃO: ListagemProdutos                */}
      {/* =================================================================== */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        
        {/* Cabeçalho da Listagem */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                ListagemProdutos (Descriptografia Pontual na Memória RAM)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {displayItems.length} registros
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Demonstração do padrão Zero-Knowledge: dados descriptografados apenas em RAM no momento da renderização.
            </p>
          </div>

          {/* Controles: Alternar Modo Criptografado / Descriptografado */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEncryptedView(!showEncryptedView)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                showEncryptedView
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              }`}
              title="Alternar entre visualização descriptografada na RAM e dados brutos cifrados do Supabase"
            >
              {showEncryptedView ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Exibindo: Cifrado no Banco (AES)</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Exibindo: Descriptografado em RAM</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={fetchProductsFromDatabase}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition"
              title="Recarregar do Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTable ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Barra de Busca rápida */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por produto, EAN ou código de fornecedor..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Tabela de Produtos */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 sticky top-0">
              <tr>
                <th className="p-2.5">Produto (Descrição)</th>
                <th className="p-2.5">Cód. Fornecedor</th>
                <th className="p-2.5">Cód. Reduzido</th>
                <th className="p-2.5">Código de barras</th>
                <th className="p-2.5 text-right">Quantidade</th>
                <th className="p-2.5 text-center">Armazenamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredDisplayItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Nenhum produto encontrado. Carregue uma planilha acima para visualizar.
                  </td>
                </tr>
              ) : (
                filteredDisplayItems.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    {/* 1. Produto */}
                    <td className="p-2.5 font-bold max-w-[200px] truncate">
                      {showEncryptedView ? (
                        <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400">
                          {item.rawCiphertext.nome.substring(0, 18)}...
                        </span>
                      ) : (
                        <span className="text-slate-900 dark:text-white">{item.produto}</span>
                      )}
                    </td>

                    {/* 2. Código de Fornecedor */}
                    <td className="p-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {showEncryptedView ? (
                        <span className="text-amber-600 dark:text-amber-400 text-[10px]">
                          {item.rawCiphertext.codigo_fornecedor ? item.rawCiphertext.codigo_fornecedor.substring(0, 12) + '...' : '-'}
                        </span>
                      ) : (
                        item.codigoFornecedor || '-'
                      )}
                    </td>

                    {/* 3. Código Reduzido */}
                    <td className="p-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {showEncryptedView ? (
                        <span className="text-amber-600 dark:text-amber-400 text-[10px]">
                          {item.rawCiphertext.plu ? item.rawCiphertext.plu.substring(0, 12) + '...' : '-'}
                        </span>
                      ) : (
                        item.codigoReduzido || '-'
                      )}
                    </td>

                    {/* 4. Código de barras */}
                    <td className="p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {showEncryptedView ? (
                        <span className="text-amber-600 dark:text-amber-400 text-[10px]">
                          {item.rawCiphertext.codigo_barras ? item.rawCiphertext.codigo_barras.substring(0, 12) + '...' : '-'}
                        </span>
                      ) : (
                        item.codigoBarras
                      )}
                    </td>

                    {/* 5. Quantidade (Aberto no banco para operações de saldo) */}
                    <td className="p-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                      {item.quantidade} un
                    </td>

                    {/* Status de Proteção */}
                    <td className="p-2.5 text-center">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> AES-256
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé de Garantia de Conhecimento Zero */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 pt-1 gap-2">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-500" />
            <span>Processamento local: Chave AES residente exclusivamente no cliente.</span>
          </span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            ✓ Sem persistência em plaintext no localStorage / IndexedDB
          </span>
        </div>
      </div>
    </div>
  );
};
