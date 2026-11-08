import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  X, 
  Check, 
  AlertTriangle, 
  Download, 
  HelpCircle,
  FileCheck2,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { importProductsToSupabase } from '../../services/supabaseService';
import { triggerScanBeep } from '../../utils/haptics';

interface ImportSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedProductRow {
  ean: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  location: string;
  isValid: boolean;
  error?: string;
}

export const ImportSpreadsheetModal: React.FC<ImportSpreadsheetModalProps> = ({ isOpen, onClose }) => {
  const { addProduct, products } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  // Normalização de chaves de coluna de planilhas variadas
  const normalizeKey = (key: string) => {
    return key
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatusMessage(null);
    setIsProcessing(true);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        if (!data || data.length === 0) {
          setStatusMessage({ type: 'error', text: 'A planilha está vazia ou ilegível.' });
          setIsProcessing(false);
          return;
        }

        const mapped: ParsedProductRow[] = data.map((row) => {
          const keys = Object.keys(row);
          let ean = '';
          let name = '';
          let category = 'Mercearia';
          let stock = 0;
          let minStock = 10;
          let price = 0;
          let location = 'Gôndola';

          keys.forEach((k) => {
            const norm = normalizeKey(k);
            const val = String(row[k] ?? '').trim();

            if (norm.includes('ean') || norm.includes('codigo') || norm.includes('barras') || norm.includes('gtin')) {
              ean = val;
            } else if (norm.includes('nome') || norm.includes('produto') || norm.includes('descricao') || norm.includes('item')) {
              name = val;
            } else if (norm.includes('cat') || norm.includes('setor') || norm.includes('depto') || norm.includes('departamento')) {
              category = val || 'Mercearia';
            } else if (norm.includes('estoque') || norm.includes('saldo') || norm.includes('qtd') || norm.includes('quantidade')) {
              stock = Math.max(0, parseInt(val, 10) || 0);
            } else if (norm.includes('min') || norm.includes('minimo') || norm.includes('seguranca')) {
              minStock = Math.max(0, parseInt(val, 10) || 10);
            } else if (norm.includes('preco') || norm.includes('valor') || norm.includes('custo') || norm.includes('venda')) {
              price = Math.max(0, parseFloat(val.replace(',', '.')) || 0);
            } else if (norm.includes('local') || norm.includes('corredor') || norm.includes('prateleira') || norm.includes('gondola')) {
              location = val || 'Gôndola';
            }
          });

          // Validações básicas
          let isValid = true;
          let error = '';

          if (!ean) {
            isValid = false;
            error = 'EAN ausente';
          } else if (!name) {
            isValid = false;
            error = 'Nome ausente';
          }

          return {
            ean,
            name,
            category,
            stock,
            minStock,
            price,
            location,
            isValid,
            error,
          };
        });

        setParsedRows(mapped);
      } catch (err) {
        console.error('Erro ao ler planilha:', err);
        setStatusMessage({ type: 'error', text: 'Não foi possível processar o arquivo. Verifique o formato (.xlsx, .csv).' });
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Gerar e baixar planilha modelo
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Codigo EAN': '7891000100099',
        'Nome do Produto': 'Biscoito Recheado Chocolate 140g',
        'Categoria': 'Mercearia',
        'Estoque Atual': 80,
        'Estoque Minimo': 25,
        'Preco Venda': 3.99,
        'Localizacao': 'Corredor 4 - Prateleira C',
      },
      {
        'Codigo EAN': '7891000100105',
        'Nome do Produto': 'Detergente Líquido Maçã 500ml',
        'Categoria': 'Limpeza',
        'Estoque Atual': 120,
        'Estoque Minimo': 30,
        'Preco Venda': 2.49,
        'Localizacao': 'Corredor 8 - Prateleira B',
      },
      {
        'Codigo EAN': '7891000100112',
        'Nome do Produto': 'Manteiga com Sal 200g',
        'Categoria': 'Laticínios',
        'Estoque Atual': 22,
        'Estoque Minimo': 20,
        'Preco Venda': 10.50,
        'Localizacao': 'Geladeira 3',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
    XLSX.writeFile(wb, 'modelo_estoque_supermercado.xlsx');
  };

  // Gravar no Supabase e no Banco Local
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    setIsProcessing(true);

    try {
      // 1. Gravar no Supabase (se configurado)
      await importProductsToSupabase(validRows, overwriteExisting);

      // 2. Gravar no estado local / AppContext
      validRows.forEach(row => {
        addProduct({
          ean: row.ean,
          name: row.name,
          category: row.category,
          stock: row.stock,
          minStock: row.minStock,
          price: row.price,
          location: row.location,
        });
      });

      triggerScanBeep(true);
      setStatusMessage({
        type: 'success',
        text: `Sucesso! ${validRows.length} itens foram gravados na tabela de estoque.`,
      });

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: 'Erro ao gravar itens no banco de dados.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-5 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                Importar Planilha de Estoque
              </h3>
              <p className="text-[11px] text-slate-400">
                Carregue arquivos .xlsx, .xls ou .csv para alimentar a base de dados
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          {/* Área de Seleção de Arquivo */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer bg-emerald-500/5 hover:bg-emerald-500/10 transition group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload className="w-8 h-8 mx-auto text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {fileName ? fileName : 'Clique para selecionar a planilha de estoque'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Suporta Excel (.xlsx, .xls) e arquivos separados por vírgula (.csv)
            </p>
          </div>

          {/* Atalho Baixar Modelo */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <HelpCircle className="w-4 h-4 text-emerald-500" />
              <span>Precisa de um modelo pronto para preencher?</span>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Baixar Modelo .XLSX
            </button>
          </div>

          {/* Mensagens de Status */}
          {statusMessage && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? <FileCheck2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Prévia da Planilha Processada */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Prévia dos Dados ({validCount} válidos, {invalidCount} com erro)
                </span>
                <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwriteExisting}
                    onChange={e => setOverwriteExisting(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Sobrescrever itens com mesmo EAN</span>
                </label>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-2.5">EAN</th>
                      <th className="p-2.5">Produto</th>
                      <th className="p-2.5">Cat</th>
                      <th className="p-2.5 text-right">Estoque</th>
                      <th className="p-2.5 text-right">Preço</th>
                      <th className="p-2.5">Local</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedRows.slice(0, 15).map((row, idx) => (
                      <tr key={idx} className={row.isValid ? '' : 'bg-rose-500/10 text-rose-600'}>
                        <td className="p-2.5 font-mono text-[10px]">{row.ean || 'ERRO'}</td>
                        <td className="p-2.5 font-medium truncate max-w-[140px]">{row.name}</td>
                        <td className="p-2.5 text-slate-400">{row.category}</td>
                        <td className="p-2.5 text-right font-bold">{row.stock} un</td>
                        <td className="p-2.5 text-right font-bold text-emerald-600">R$ {row.price.toFixed(2)}</td>
                        <td className="p-2.5 text-slate-400 truncate max-w-[100px]">{row.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 15 && (
                <p className="text-[10px] text-slate-400 text-center">
                  Mostrando primeiras 15 de {parsedRows.length} linhas
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={validCount === 0 || isProcessing}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition"
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Gravar {validCount} Produtos no Banco
          </button>
        </div>
      </div>
    </div>
  );
};
