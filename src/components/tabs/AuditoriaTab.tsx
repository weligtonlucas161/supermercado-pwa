import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  CheckSquare, 
  Boxes, 
  CalendarClock, 
  FileText, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Barcode, 
  Download, 
  Construction, 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  Eye, 
  RefreshCw, 
  X, 
  Layers, 
  Zap,
  Check,
  Tag,
  Camera,
  CameraOff,
  Flashlight,
  Volume2,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { SETORES_DISPONIVEIS, SetorLoja, Product, AuditItem } from '../../types';
import { triggerScanBeep } from '../../utils/haptics';
import { useBarcodeDetector } from '../../hooks/useBarcodeDetector';

type AuditoriaInterface = 'presenca' | 'inventario' | 'validade' | 'relatorio';

interface ConfirmedProductItem {
  id: string;
  name: string;
  ean: string;
  reducedCode?: string;
  supplierCode?: string;
  scannedAt: string;
}

export const AuditoriaTab: React.FC = () => {
  const { products, audits, addAudit, operator, darkMode, openScanner } = useApp();

  // Interface Ativa das 4 requeridas
  const [activeInterface, setActiveInterface] = useState<AuditoriaInterface>('presenca');

  // =========================================================================
  // ESTADOS DA INTERFACE 1: AUDITORIA DE PRESENÇA
  // =========================================================================
  const [selectedSetor, setSelectedSetor] = useState<SetorLoja>('MERCEARIA');
  const [isAuditing, setIsAuditing] = useState(false);
  const [sessionSetor, setSessionSetor] = useState<SetorLoja>('MERCEARIA');
  const [sessionStartTime, setSessionStartTime] = useState<string>('');
  
  // Listas de Controle da Auditoria de Presença
  const [pendentes, setPendentes] = useState<Product[]>([]);
  const [confirmados, setConfirmados] = useState<ConfirmedProductItem[]>([]);
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');
  const [isContinuousCameraActive, setIsContinuousCameraActive] = useState<boolean>(true);
  const [lastBipFeedback, setLastBipFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    ean?: string;
  } | null>(null);

  // Sub-Aba dentro da auditoria ativa (Pendentes vs Confirmados)
  const [viewListTab, setViewListTab] = useState<'pendentes' | 'confirmados'>('pendentes');

  // Modal de Detalhes de Auditoria do Relatório
  const [selectedAuditForModal, setSelectedAuditForModal] = useState<AuditItem | null>(null);

  // Referências para evitar stale state durante o streaming contínuo a 30fps
  const pendentesRef = useRef<Product[]>([]);
  const confirmadosRef = useRef<ConfirmedProductItem[]>([]);
  const continuousVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    pendentesRef.current = pendentes;
  }, [pendentes]);

  useEffect(() => {
    confirmadosRef.current = confirmados;
  }, [confirmados]);

  // Produtos cadastrados no setor selecionado antes de iniciar
  const productsInSelectedSetor = products.filter(
    p => p.category?.toUpperCase() === selectedSetor.toUpperCase()
  );

  // =========================================================================
  // PROCESSAMENTO CONTÍNUO DE CÓDIGO DE BARRAS (SEM FECHAR CÂMERA)
  // Identificou o produto da lista -> marca como confirmado -> pronto para o próximo!
  // =========================================================================
  const processContinuousBarcode = useCallback((scannedCode: string) => {
    const cleanEan = scannedCode.replace(/[^0-9A-Za-z]/g, '').trim();
    if (!cleanEan) return;

    const currentPendentes = pendentesRef.current;
    const currentConfirmados = confirmadosRef.current;

    // 1. Verifica se o produto está na lista de PENDENTES
    const pendingIndex = currentPendentes.findIndex(p => {
      const pEan = (p.ean || '').replace(/[^0-9A-Za-z]/g, '').trim();
      const pRed = (p.reducedCode || '').replace(/[^0-9A-Za-z]/g, '').trim();
      const pSup = (p.supplierCode || '').replace(/[^0-9A-Za-z]/g, '').trim();
      return (
        pEan === cleanEan ||
        pEan.endsWith(cleanEan) ||
        cleanEan.endsWith(pEan) ||
        pRed === cleanEan ||
        pSup === cleanEan
      );
    });

    if (pendingIndex >= 0) {
      const foundProduct = currentPendentes[pendingIndex];
      const nowTime = new Date().toLocaleTimeString('pt-BR');

      // Remove de pendentes e atualiza ref imediatamente
      const newPendentes = [...currentPendentes];
      newPendentes.splice(pendingIndex, 1);
      pendentesRef.current = newPendentes;
      setPendentes(newPendentes);

      // Adiciona em confirmados e atualiza ref imediatamente
      const confirmedItem: ConfirmedProductItem = {
        id: foundProduct.id,
        name: foundProduct.name,
        ean: foundProduct.ean,
        reducedCode: foundProduct.reducedCode,
        supplierCode: foundProduct.supplierCode,
        scannedAt: nowTime,
      };
      const newConfirmados = [confirmedItem, ...currentConfirmados];
      confirmadosRef.current = newConfirmados;
      setConfirmados(newConfirmados);

      // Bip sonoro e feedback visual
      triggerScanBeep(true);
      setLastBipFeedback({
        type: 'success',
        message: `✓ Confirmado: "${foundProduct.name}"`,
        ean: foundProduct.ean,
      });
      setManualBarcodeInput('');
      // CÂMERA PERMANECE ABERTA E PRONTA PARA O PRÓXIMO PRODUTO!
      return;
    }

    // 2. Verifica se já foi confirmado anteriormente
    const alreadyConfirmed = currentConfirmados.find(c => {
      const cEan = (c.ean || '').replace(/[^0-9A-Za-z]/g, '').trim();
      const cRed = (c.reducedCode || '').replace(/[^0-9A-Za-z]/g, '').trim();
      return cEan === cleanEan || cEan.endsWith(cleanEan) || cleanEan.endsWith(cEan) || cRed === cleanEan;
    });

    if (alreadyConfirmed) {
      setLastBipFeedback({
        type: 'warning',
        message: `Item já conferido: "${alreadyConfirmed.name}" às ${alreadyConfirmed.scannedAt}`,
        ean: cleanEan,
      });
      setManualBarcodeInput('');
      return;
    }

    // 3. Código não encontrado entre os itens pendentes do setor
    triggerScanBeep(false);
    setLastBipFeedback({
      type: 'error',
      message: `Código ${cleanEan} não consta nos pendentes deste setor (${sessionSetor}).`,
      ean: cleanEan,
    });
    setManualBarcodeInput('');
  }, [sessionSetor]);

  // Hook do Leitor com Google Barcode Service + ZXing tryHarder
  const {
    isScanning,
    hasCameraPermission,
    cameraError,
    torchAvailable,
    torchOn,
    toggleTorch,
    startScanning,
    stopScanning,
  } = useBarcodeDetector(processContinuousBarcode);

  // Iniciar/Parar câmera contínua automaticamente durante a auditoria ativa
  useEffect(() => {
    let mounted = true;
    if (isAuditing && isContinuousCameraActive && continuousVideoRef.current) {
      startScanning(continuousVideoRef.current);
    } else {
      stopScanning();
    }

    return () => {
      mounted = false;
      stopScanning();
    };
  }, [isAuditing, isContinuousCameraActive, startScanning, stopScanning]);

  // =========================================================================
  // AÇÕES DA AUDITORIA DE PRESENÇA
  // =========================================================================
  const handleStartPresenceAudit = () => {
    const sectorProducts = products.filter(
      p => p.category?.toUpperCase() === selectedSetor.toUpperCase()
    );

    if (sectorProducts.length === 0) {
      setLastBipFeedback({
        type: 'warning',
        message: `O setor ${selectedSetor} ainda não possui produtos cadastrados no estoque. Importe uma planilha ou cadastre itens neste setor antes de iniciar.`,
      });
      return;
    }

    setSessionSetor(selectedSetor);
    pendentesRef.current = [...sectorProducts];
    confirmadosRef.current = [];
    setPendentes([...sectorProducts]);
    setConfirmados([]);
    setSessionStartTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    setIsAuditing(true);
    setIsContinuousCameraActive(true);
    setViewListTab('pendentes');
    setLastBipFeedback(null);
    triggerScanBeep(true);
  };

  // Dispara a câmera externa/modal com Google Service como alternativa se preferir
  const handleTriggerGoogleBarcodeScanner = () => {
    openScanner((scannedEan) => {
      processContinuousBarcode(scannedEan);
    });
  };

  // Finalizar e salvar a auditoria de presença
  const handleFinishAndSaveAudit = () => {
    stopScanning();
    const totalItems = confirmados.length + pendentes.length;
    const rate = totalItems > 0 ? ((confirmados.length / totalItems) * 100).toFixed(0) : '0';

    addAudit({
      title: `Auditoria de Presença - ${sessionSetor}`,
      itemsCount: confirmados.length,
      status: 'Concluída',
      auditor: `${operator.name || 'Operador'} (${operator.code || '4092'})`,
      department: sessionSetor,
      type: 'PRESENCA',
      totalItems,
      confirmedItems: confirmados.length,
      pendingItems: pendentes.length,
      presenceRate: `${rate}%`,
      confirmedList: confirmados.map(c => ({ name: c.name, ean: c.ean, scannedAt: c.scannedAt })),
      pendingList: pendentes.map(p => ({ name: p.name, ean: p.ean })),
    });

    setIsAuditing(false);
    setPendentes([]);
    setConfirmados([]);
    setLastBipFeedback(null);
    setActiveInterface('relatorio');
    triggerScanBeep(true);
  };

  // Exportar relatório em XLSX
  const handleExportAuditXLSX = (audit: AuditItem) => {
    const rows = [
      { Informação: 'Título', Valor: audit.title },
      { Informação: 'Setor', Valor: audit.department || '-' },
      { Informação: 'Auditor', Valor: audit.auditor },
      { Informação: 'Data', Valor: audit.date },
      { Informação: 'Status', Valor: audit.status },
      { Informação: 'Taxa de Presença', Valor: audit.presenceRate || '100%' },
      { Informação: 'Itens Confirmados', Valor: audit.confirmedItems ?? audit.itemsCount },
      { Informação: 'Itens Pendentes/Ausentes', Valor: audit.pendingItems ?? 0 },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resumo');
    XLSX.writeFile(wb, `auditoria_${audit.department || 'geral'}_${audit.date}.xlsx`);
  };

  // Cálculos de progresso
  const totalSessionProducts = confirmados.length + pendentes.length;
  const progressPercent = totalSessionProducts > 0
    ? Math.round((confirmados.length / totalSessionProducts) * 100)
    : 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      {/* =================================================================== */}
      {/* HEADER DA ABA AUDITORIA COM SELEÇÃO DAS 4 INTERFACES                */}
      {/* =================================================================== */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Módulos de Auditoria
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Conferência de presença via Google Barcode Service, inventário físico e controle de validade.
          </p>
        </div>
      </div>

      {/* NAVEGAÇÃO ENTRE AS 4 INTERFACES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {/* 1. Auditoria de Presença */}
        <button
          onClick={() => setActiveInterface('presenca')}
          className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-center ${
            activeInterface === 'presenca'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 ring-2 ring-emerald-500/30'
              : darkMode
              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <span>Auditoria de Presença</span>
        </button>

        {/* 2. Auditoria de Inventário */}
        <button
          onClick={() => setActiveInterface('inventario')}
          className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-center relative ${
            activeInterface === 'inventario'
              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-400/40'
              : darkMode
              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Boxes className="w-5 h-5" />
          <span>Auditoria de Inventário</span>
          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-900 border border-amber-600/30 uppercase">
            Em Breve
          </span>
        </button>

        {/* 3. Auditoria de Validade */}
        <button
          onClick={() => setActiveInterface('validade')}
          className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-center relative ${
            activeInterface === 'validade'
              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-400/40'
              : darkMode
              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <CalendarClock className="w-5 h-5" />
          <span>Auditoria de Validade</span>
          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-900 border border-amber-600/30 uppercase">
            Em Breve
          </span>
        </button>

        {/* 4. Relatório de Auditorias */}
        <button
          onClick={() => setActiveInterface('relatorio')}
          className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-center ${
            activeInterface === 'relatorio'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 ring-2 ring-emerald-500/30'
              : darkMode
              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>Relatório de Auditorias</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* INTERFACE 1: AUDITORIA DE PRESENÇA                                  */}
      {/* =================================================================== */}
      {activeInterface === 'presenca' && (
        <div className="space-y-4">
          {!isAuditing ? (
            /* CONFIGURAÇÃO E INÍCIO DA AUDITORIA DE PRESENÇA */
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Auditoria de Presença por Setor
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecione o setor da loja para carregar a lista de produtos pendentes e auditar via Google Barcode Service.
                  </p>
                </div>
              </div>

              {/* Botões dos 6 Setores Oficiais */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-emerald-500" />
                    1. Selecione o Setor para Auditar:
                  </label>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    Setor Escolhido: {selectedSetor} ({productsInSelectedSetor.length} produtos cadastrados)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {SETORES_DISPONIVEIS.map((setor) => {
                    const isSelected = selectedSetor === setor;
                    const countInSetor = products.filter(p => p.category?.toUpperCase() === setor.toUpperCase()).length;
                    return (
                      <button
                        key={setor}
                        type="button"
                        onClick={() => setSelectedSetor(setor)}
                        className={`p-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-1 border cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/30'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500/50'
                        }`}
                      >
                        <span>{setor}</span>
                        <span className={`text-[10px] font-semibold ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {countInSetor} {countInSetor === 1 ? 'item' : 'itens'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detalhes do Setor Selecionado e Botão de Iniciar */}
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Regra de Auditoria de Presença:
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Ao iniciar, todos os <strong>{productsInSelectedSetor.length}</strong> produtos do setor <strong>{selectedSetor}</strong> entram na lista <strong>Pendentes</strong>. A cada bipagem com o <strong>Google Barcode Service</strong>, o produto é verificado e transferido para a lista de <strong>Confirmados</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleStartPresenceAudit}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>Iniciar Auditoria de Presença</span>
                </button>
              </div>

              {lastBipFeedback && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{lastBipFeedback.message}</span>
                </div>
              )}
            </div>
          ) : (
            /* =============================================================== */
            /* AUDITORIA DE PRESENÇA EM ANDAMENTO (COLETOR GOOGLE SERVICE)     */
            /* =============================================================== */
            <div className="space-y-4">
              {/* Barra de Status e Cabeçalho da Sessão */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Auditoria Ativa: Setor {sessionSetor}</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          Ao Vivo
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Início: {sessionStartTime} • Auditor: {operator.name || 'Operador'} ({operator.code || '4092'})
                      </p>
                    </div>
                  </div>

                  {/* Ações de Conclusão */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setIsAuditing(false)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      Pausar / Sair
                    </button>
                    <button
                      type="button"
                      onClick={handleFinishAndSaveAudit}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Concluir e Salvar Relatório</span>
                    </button>
                  </div>
                </div>

                {/* Resumo Numérico e Barra de Progresso */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Total do Setor</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white">{totalSessionProducts}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Confirmados</span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{confirmados.length}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block">Pendentes</span>
                    <span className="text-xl font-black text-amber-600 dark:text-amber-400">{pendentes.length}</span>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Conformidade de Presença</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{progressPercent}% auditado</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* PAINEL DE LEITURA CONTÍNUA COM GOOGLE SERVICE (BARCODE DETECTOR API) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-900/10 border border-emerald-500/30 space-y-3.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                          <span>Leitor Contínuo Hands-Free</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500 text-white font-extrabold tracking-wide uppercase">
                            Google Service + tryHarder
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30">
                            Sem cliques entre itens
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Identificou o código da prateleira, confirma na hora e continua aberto pronto para o próximo.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Botão de Lanterna (se disponível) */}
                      {torchAvailable && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                            torchOn
                              ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-300'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                          title="Alternar Lanterna Física"
                        >
                          <Flashlight className="w-4 h-4" />
                          <span className="hidden sm:inline">{torchOn ? 'Lanterna Ligada' : 'Lanterna'}</span>
                        </button>
                      )}

                      {/* Alternar Câmera Contínua (Ligar/Desligar) */}
                      <button
                        type="button"
                        onClick={() => setIsContinuousCameraActive(prev => !prev)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          isContinuousCameraActive
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isContinuousCameraActive ? (
                          <>
                            <Camera className="w-4 h-4" />
                            <span>Câmera Contínua Ativa</span>
                          </>
                        ) : (
                          <>
                            <CameraOff className="w-4 h-4" />
                            <span>Ativar Câmera</span>
                          </>
                        )}
                      </button>

                      {/* Opção de Modal Completo de Scanner */}
                      <button
                        type="button"
                        onClick={handleTriggerGoogleBarcodeScanner}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold shadow-xs flex items-center gap-1 transition cursor-pointer"
                        title="Abrir em Tela Cheia"
                      >
                        <Barcode className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden sm:inline">Tela Cheia</span>
                      </button>
                    </div>
                  </div>

                  {/* VIEWPORT DA CÂMERA CONTÍNUA */}
                  {isContinuousCameraActive ? (
                    <div className="relative w-full h-56 sm:h-72 bg-black rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-inner flex items-center justify-center">
                      <video
                        ref={continuousVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* HUD DE MIRA E LASER ANIMADO */}
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                        {/* Caixa de Enquadramento */}
                        <div className="w-64 sm:w-80 h-32 sm:h-40 border-2 border-emerald-400/90 rounded-2xl relative shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-emerald-500/5">
                          {/* Cantoneiras Brilhantes */}
                          <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-300" />
                          <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-300" />
                          <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-300" />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-300" />
                          
                          {/* Linha Laser de Varredura */}
                          <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#ef4444] animate-pulse top-1/2 -translate-y-1/2" />
                        </div>

                        {/* Legenda Superior no Viewport */}
                        <div className="absolute top-3 inset-x-4 flex items-center justify-between text-[11px] font-bold text-white pointer-events-none">
                          <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            Amostragem Contínua Ativa
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-emerald-600/80 backdrop-blur-md border border-emerald-400/30">
                            {confirmados.length} auditados / {pendentes.length} pendentes
                          </span>
                        </div>

                        {/* Legenda Inferior no Viewport */}
                        <div className="absolute bottom-3 inset-x-4 flex items-center justify-center pointer-events-none">
                          <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] text-emerald-300 font-mono tracking-wide">
                            Aponte sucessivamente para as embalagens da prateleira
                          </span>
                        </div>
                      </div>

                      {/* Erro de Câmera / Permissão */}
                      {cameraError && (
                        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center space-y-3">
                          <AlertTriangle className="w-8 h-8 text-amber-400" />
                          <p className="text-xs text-white max-w-sm">{cameraError}</p>
                          <button
                            type="button"
                            onClick={() => {
                              if (continuousVideoRef.current) startScanning(continuousVideoRef.current);
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                          >
                            Tentar Acessar Câmera Novamente
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                      <CameraOff className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Câmera Contínua Pausada
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                        Clique no botão acima "Ativar Câmera" para retomar a conferência contínua com bipagem instantânea.
                      </p>
                    </div>
                  )}

                  {/* Input Rápido Manual / Leitor USB / Bluetooth */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ou digite/bipe o EAN com leitor USB/Bluetooth..."
                      value={manualBarcodeInput}
                      onChange={e => setManualBarcodeInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          processContinuousBarcode(manualBarcodeInput);
                        }
                      }}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => processContinuousBarcode(manualBarcodeInput)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      Confirmar
                    </button>
                  </div>

                  {/* Feedback do Último Bip */}
                  {lastBipFeedback && (
                    <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all duration-200 animate-in fade-in ${
                      lastBipFeedback.type === 'success'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-semibold'
                        : lastBipFeedback.type === 'warning'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300 font-medium'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300 font-medium'
                    }`}>
                      <div className="flex items-center gap-2">
                        {lastBipFeedback.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{lastBipFeedback.message}</span>
                      </div>
                      {lastBipFeedback.ean && (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 shrink-0 font-bold">
                          EAN: {lastBipFeedback.ean}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* LISTAS: PENDENTES VS CONFIRMADOS */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-3">
                <div className="flex border-b border-slate-100 dark:border-slate-800 text-xs gap-2">
                  <button
                    onClick={() => setViewListTab('pendentes')}
                    className={`py-2 px-3.5 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                      viewListTab === 'pendentes'
                        ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Lista de Pendentes ({pendentes.length})</span>
                  </button>
                  <button
                    onClick={() => setViewListTab('confirmados')}
                    className={`py-2 px-3.5 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                      viewListTab === 'confirmados'
                        ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Lista de Confirmados ({confirmados.length})</span>
                  </button>
                </div>

                {/* Exibição da Lista Pendentes */}
                {viewListTab === 'pendentes' && (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {pendentes.length === 0 ? (
                      <div className="p-8 text-center rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <h4 className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                          Todos os produtos do setor foram auditados!
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Nenhum produto pendente. Você pode clicar em "Concluir e Salvar Relatório".
                        </p>
                      </div>
                    ) : (
                      pendentes.map(item => (
                        <div
                          key={item.id}
                          className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <h5 className="font-bold text-slate-900 dark:text-white">{item.name}</h5>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                              <span>EAN: {item.ean}</span>
                              {item.reducedCode && <span>• Reduzido: {item.reducedCode}</span>}
                              {item.supplierCode && <span>• Forn: {item.supplierCode}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Pendente
                            </span>
                            <button
                              type="button"
                              onClick={() => processContinuousBarcode(item.ean)}
                              className="px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-200 text-[11px] font-bold transition cursor-pointer"
                              title="Confirmar manualmente este item"
                            >
                              Conferir
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Exibição da Lista Confirmados */}
                {viewListTab === 'confirmados' && (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {confirmados.length === 0 ? (
                      <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Nenhum produto auditado ainda. Use a câmera ou digite o EAN acima para conferir os itens.
                      </div>
                    ) : (
                      confirmados.map(item => (
                        <div
                          key={item.id}
                          className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{item.name}</span>
                            </h5>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                              <span>EAN: {item.ean}</span>
                              {item.reducedCode && <span>• Red: {item.reducedCode}</span>}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 block">
                              Auditado via Google Service
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                              {item.scannedAt}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* INTERFACE 2: AUDITORIA DE INVENTÁRIO (EM DESENVOLVIMENTO)           */}
      {/* =================================================================== */}
      {activeInterface === 'inventario' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* FAIXA AMARELA COM LISTRAS PRETAS SUPERIOR (CAUTION TAPE) */}
          <div 
            className="w-full h-8 rounded-2xl shadow-inner flex items-center justify-center overflow-hidden border border-amber-500"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, #facc15, #facc15 15px, #000000 15px, #000000 30px)',
            }}
          >
            <span className="bg-black/90 text-amber-400 font-black text-[11px] tracking-widest px-4 py-1 rounded uppercase">
              ⚠ EM DESENVOLVIMENTO • AUDITORIA DE INVENTÁRIO • EM BREVE ⚠
            </span>
          </div>

          {/* CARD CENTRAL DE CONSTRUÇÃO */}
          <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-500/40 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center animate-pulse">
              <Construction className="w-8 h-8" />
            </div>

            <div className="space-y-1.5 max-w-md mx-auto">
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                Módulo em Engenharia
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Auditoria de Inventário Físico
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Este módulo está em fase ativa de desenvolvimento. Ele permitirá realizar a contagem cega de gôndola, conciliação patrimonial e apuração de quebras e sobras com fechamento de balanço.
              </p>
            </div>

            <div className="max-w-md mx-auto p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 text-left text-xs space-y-2">
              <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-amber-500" />
                <span>Recursos deste módulo:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-slate-400 space-y-1 pl-1">
                <li>Contagem física cega por operador sem visualização de saldo teórico</li>
                <li>Inventário rotativo diário por curva ABC e produtos de alto valor</li>
                <li>Geração automática de relatórios de divergência para a gerência</li>
              </ul>
            </div>
          </div>

          {/* FAIXA AMARELA COM LISTRAS PRETAS INFERIOR (CAUTION TAPE) */}
          <div 
            className="w-full h-8 rounded-2xl shadow-inner flex items-center justify-center overflow-hidden border border-amber-500"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, #facc15, #facc15 15px, #000000 15px, #000000 30px)',
            }}
          >
            <span className="bg-black/90 text-amber-400 font-black text-[11px] tracking-widest px-4 py-1 rounded uppercase">
              ⚠ EM DESENVOLVIMENTO • ÁREA EM CONSTRUÇÃO • OPSYS ⚠
            </span>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* INTERFACE 3: AUDITORIA DE VALIDADE (EM DESENVOLVIMENTO)             */}
      {/* =================================================================== */}
      {activeInterface === 'validade' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* FAIXA AMARELA COM LISTRAS PRETAS SUPERIOR (CAUTION TAPE) */}
          <div 
            className="w-full h-8 rounded-2xl shadow-inner flex items-center justify-center overflow-hidden border border-amber-500"
            style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, #facc15, #facc15 15px, #000000 15px, #000000 30px)',
            }}
          >
            <span className="bg-black/90 text-amber-400 font-black text-[11px] tracking-widest px-4 py-1 rounded uppercase">
              ⚠ EM DESENVOLVIMENTO • AUDITORIA DE VALIDADE • EM BREVE ⚠
            </span>
          </div>

          {/* CARD CENTRAL DE CONSTRUÇÃO */}
          <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-500/40 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center animate-pulse">
              <CalendarClock className="w-8 h-8" />
            </div>

            <div className="space-y-1.5 max-w-md mx-auto">
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                Módulo em Engenharia
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Auditoria de Validade e FIFO
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Este módulo está em desenvolvimento para o controle dinâmico de datas críticas, conferência de lotes por gôndola e rotação PEPS (Primeiro que Expira, Primeiro que Sai).
              </p>
            </div>

            <div className="max-w-md mx-auto p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 text-left text-xs space-y-2">
              <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Recursos em preparação:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-slate-400 space-y-1 pl-1">
                <li>Auditoria de lotes com cálculo automático de dias para vencimento</li>
                <li>Validação de giro e sugestão de desconto proporcional para queima de estoque</li>
                <li>Alerta sonoro imediato ao identificar lote com data vencida na gôndola</li>
              </ul>
            </div>
          </div>

          {/* FAIXA AMARELA COM LISTRAS PRETAS INFERIOR (CAUTION TAPE) */}
          <div 
            className="w-full h-8 rounded-2xl shadow-inner flex items-center justify-center overflow-hidden border border-amber-500"
            style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, #facc15, #facc15 15px, #000000 15px, #000000 30px)',
            }}
          >
            <span className="bg-black/90 text-amber-400 font-black text-[11px] tracking-widest px-4 py-1 rounded uppercase">
              ⚠ EM DESENVOLVIMENTO • CONTROLE DE PERDAS • OPSYS ⚠
            </span>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* INTERFACE 4: RELATÓRIO DE AUDITORIAS                                */}
      {/* =================================================================== */}
      {activeInterface === 'relatorio' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-500" />
                Histórico & Relatórios de Auditorias
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Consulte as auditorias de presença realizadas, itens confirmados e faltas registradas.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {audits.length} {audits.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          {audits.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">Nenhum relatório de auditoria</h4>
              <p className="text-xs text-slate-400 mt-1">
                Inicie uma <strong>Auditoria de Presença</strong> para gerar seu primeiro relatório de conformidade.
              </p>
              <button
                type="button"
                onClick={() => setActiveInterface('presenca')}
                className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" /> Ir para Auditoria de Presença
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {audits.map(audit => (
                <div
                  key={audit.id}
                  className="p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-sm text-slate-900 dark:text-white">
                        {audit.title}
                      </h4>
                      {audit.department && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Setor: {audit.department}
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {audit.date}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Auditor: <strong>{audit.auditor}</strong>
                    </p>

                    <div className="flex items-center gap-3 text-xs pt-1">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        Confirmados: {audit.confirmedItems ?? audit.itemsCount}
                      </span>
                      {typeof audit.pendingItems === 'number' && (
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          Pendentes/Faltas: {audit.pendingItems}
                        </span>
                      )}
                      {audit.presenceRate && (
                        <span className="font-black text-slate-800 dark:text-slate-100">
                          Conformidade: {audit.presenceRate}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleExportAuditXLSX(audit)}
                      className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
                      title="Exportar planilha Excel deste relatório"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Exportar .XLSX</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedAuditForModal(audit)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Detalhes</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL DE DETALHES DA AUDITORIA SELECIONADA                           */}
      {/* =================================================================== */}
      {selectedAuditForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  {selectedAuditForModal.title}
                </h3>
                <p className="text-xs text-slate-400">
                  Data: {selectedAuditForModal.date} • Auditor: {selectedAuditForModal.auditor}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditForModal(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Total</span>
                <span className="text-base font-black text-slate-800 dark:text-white">
                  {selectedAuditForModal.totalItems ?? selectedAuditForModal.itemsCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <span className="text-[10px] block uppercase font-bold">Confirmados</span>
                <span className="text-base font-black">
                  {selectedAuditForModal.confirmedItems ?? selectedAuditForModal.itemsCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                <span className="text-[10px] block uppercase font-bold">Pendentes</span>
                <span className="text-base font-black">
                  {selectedAuditForModal.pendingItems ?? 0}
                </span>
              </div>
            </div>

            {/* Listagem de Itens da Auditoria */}
            <div className="space-y-3 overflow-y-auto flex-1 text-xs">
              {/* Itens Confirmados */}
              {selectedAuditForModal.confirmedList && selectedAuditForModal.confirmedList.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Itens Confirmados na Gôndola ({selectedAuditForModal.confirmedList.length})
                  </h5>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-40 overflow-y-auto">
                    {selectedAuditForModal.confirmedList.map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                          <p className="font-mono text-[10px] text-slate-400">EAN: {item.ean}</p>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-semibold">{item.scannedAt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Itens Pendentes / Faltantes */}
              {selectedAuditForModal.pendingList && selectedAuditForModal.pendingList.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Itens Pendentes / Não Localizados ({selectedAuditForModal.pendingList.length})
                  </h5>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-40 overflow-y-auto">
                    {selectedAuditForModal.pendingList.map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between bg-amber-500/5">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                          <p className="font-mono text-[10px] text-slate-400">EAN: {item.ean}</p>
                        </div>
                        <span className="text-[10px] text-amber-600 font-bold">Falta</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAuditForModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
