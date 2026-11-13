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
  Sparkles,
  Users,
  Radio,
  ZoomIn,
  ZoomOut,
  Target,
  Sliders,
  WifiOff,
  UserPlus,
  Info,
  Lock,
  FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { SETORES_DISPONIVEIS, SetorLoja, Product, AuditItem } from '../../types';
import { triggerScanBeep } from '../../utils/haptics';
import { exportAuditReportToPDF } from '../../utils/pdfExport';
import { useBarcodeDetector } from '../../hooks/useBarcodeDetector';
import {
  fetchActiveAuditSessions,
  startAuditSessionInDatabase,
  fetchSessionBipsFromDatabase,
  insertAuditBipInDatabase,
  finalizeAuditSessionInDatabase,
  checkAuditSessionStatus,
  confirmMissingAuditProductInDatabase,
  buildAuditCompositeParts,
  subscribeToAuditRealtime,
  notifySessionJoinRealtime,
  AUDIT_SESSION_MAX_INACTIVITY_MS,
  AuditSessionTipo,
  DbActiveAuditSession,
  DbAuditBip,
} from '../../services/supabaseService';

type AuditoriaInterface = 'presenca' | 'inventario' | 'validade' | 'relatorio';

interface ConfirmedProductItem {
  id: string;
  name: string;
  ean: string;
  reducedCode?: string;
  supplierCode?: string;
  scannedAt: string;
  scannedBy?: string;
  scanMethod?: 'camera' | 'manual';
  physicalQuantity?: number;
}

function formatAuditDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

export const AuditoriaTab: React.FC = () => {
  const {
    products,
    audits,
    addAudit,
    updateAudit,
    refreshAuditsFromDatabase,
    operator,
    darkMode,
    openScanner,
    storeName,
    isInventoryLocked,
    setIsInventoryLocked,
  } = useApp();

  // Interface Ativa das 4 requeridas
  const [activeInterface, setActiveInterface] = useState<AuditoriaInterface>('presenca');

  // Permissões para relatórios e visualização de estoque teórico
  const isManagerUser =
    operator.role === 'gerente' ||
    operator.role === 'adm' ||
    operator.role === 'saas_admin' ||
    operator.role === 'master';

  const visibleAudits = audits.filter((a) => {
    if (operator.loja_id && a.lojaId && a.lojaId !== operator.loja_id) return false;
    if (isManagerUser) return true;
    const userSector = (operator.setor_restrito || '').trim().toUpperCase();
    if (!userSector || userSector === 'TODOS' || userSector === 'GERAL') return true;
    return (a.department || '').trim().toUpperCase() === userSector;
  });

  // =========================================================================
  // ESTADOS DA SESSÃO ATIVA (PRESENÇA E INVENTÁRIO CEGO)
  // =========================================================================
  const [selectedSetor, setSelectedSetor] = useState<SetorLoja>('MERCEARIA');
  const [isAuditing, setIsAuditing] = useState(false);
  const [sessionTipo, setSessionTipo] = useState<'PRESENCA' | 'INVENTARIO'>('PRESENCA');
  const sessionTipoRef = useRef<'PRESENCA' | 'INVENTARIO'>('PRESENCA');
  useEffect(() => {
    sessionTipoRef.current = sessionTipo;
  }, [sessionTipo]);
  const [sessionSetor, setSessionSetor] = useState<SetorLoja>('MERCEARIA');
  const [sessionStartTime, setSessionStartTime] = useState<string>('');
  const [sessionStartTimeMs, setSessionStartTimeMs] = useState<number>(Date.now());
  const [sessionIniciadaPor, setSessionIniciadaPor] = useState<{ nome: string; matricula: string } | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<string[]>([]);
  const [showStartSessionPopup, setShowStartSessionPopup] = useState<boolean>(false);

  // Estado de digitação de quantidade física ao bipar item no Inventário Cego
  const [pendingInventoryCountItem, setPendingInventoryCountItem] = useState<{
    product: Product;
    scannedAt: string;
  } | null>(null);
  const pendingInventoryCountRef = useRef<{ product: Product; scannedAt: string } | null>(null);
  useEffect(() => {
    pendingInventoryCountRef.current = pendingInventoryCountItem;
  }, [pendingInventoryCountItem]);
  const [physicalCountInput, setPhysicalCountInput] = useState<string>('');
  const physicalCountInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (pendingInventoryCountItem) {
      setTimeout(() => physicalCountInputRef.current?.focus(), 80);
    }
  }, [pendingInventoryCountItem]);

  // Sincroniza bloqueio restrito global sempre que sessão de Inventário Cego estiver ativa
  useEffect(() => {
    setIsInventoryLocked(isAuditing && sessionTipo === 'INVENTARIO');
    return () => {
      setIsInventoryLocked(false);
    };
  }, [isAuditing, sessionTipo, setIsInventoryLocked]);

  // Atualiza relatórios do servidor ao abrir a aba Relatórios
  useEffect(() => {
    if (activeInterface === 'relatorio') {
      refreshAuditsFromDatabase();
    }
  }, [activeInterface, refreshAuditsFromDatabase]);

  // Sessões em tempo real no banco de dados (tabela auditoria_presenca_sessoes)
  const [activeRemoteSessions, setActiveRemoteSessions] = useState<DbActiveAuditSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);
  
  // Listas de Controle da Auditoria Ativa
  const [pendentes, setPendentes] = useState<Product[]>([]);
  const [confirmados, setConfirmados] = useState<ConfirmedProductItem[]>([]);
  const [isContinuousCameraActive, setIsContinuousCameraActive] = useState<boolean>(true);
  const [lastBipFeedback, setLastBipFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    ean?: string;
  } | null>(null);

  // Efeito Visual de Bipagem: Piscar Bordas da Interface
  // verde = sucesso; amarelo = duplo por si mesmo; vermelho = sem resultado; laranja = feito por outro membro
  const [scanFlashBorder, setScanFlashBorder] = useState<'green' | 'yellow' | 'red' | 'orange' | null>(null);
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerBorderFlash = useCallback((color: 'green' | 'yellow' | 'red' | 'orange') => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setScanFlashBorder(color);
    flashTimerRef.current = setTimeout(() => {
      setScanFlashBorder(null);
    }, 1000);
  }, []);

  // Alerta em Pop-up no Canto Superior Direito para Operador Offline
  const [offlineAlert, setOfflineAlert] = useState<{ name: string; timestamp: number } | null>(null);
  const offlineAlertTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerOfflineAlert = useCallback((name: string) => {
    if (offlineAlertTimerRef.current) clearTimeout(offlineAlertTimerRef.current);
    setOfflineAlert({ name, timestamp: Date.now() });
    offlineAlertTimerRef.current = setTimeout(() => {
      setOfflineAlert(null);
    }, 6000);
  }, []);

  // Notificação em Tempo Real quando outro usuário entra na sessão ativa
  const [joinAlert, setJoinAlert] = useState<{ name: string; timestamp: number } | null>(null);
  const joinAlertTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerJoinAlert = useCallback((name: string) => {
    if (joinAlertTimerRef.current) clearTimeout(joinAlertTimerRef.current);
    setJoinAlert({ name, timestamp: Date.now() });
    joinAlertTimerRef.current = setTimeout(() => {
      setJoinAlert(null);
    }, 6000);
  }, []);

  // Sub-Aba dentro da auditoria ativa (Pendentes vs Confirmados vs Rupturas)
  const [viewListTab, setViewListTab] = useState<'pendentes' | 'confirmados' | 'rupturas'>('pendentes');

  // Modal de Detalhes de Auditoria do Relatório
  const [selectedAuditForModal, setSelectedAuditForModal] = useState<AuditItem | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'bipados' | 'nao_bipados' | 'rupturas'>('bipados');
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);

  // Referências para evitar stale state durante o streaming contínuo a 30fps
  const pendentesRef = useRef<Product[]>([]);
  const confirmadosRef = useRef<ConfirmedProductItem[]>([]);
  const continuousVideoRef = useRef<HTMLVideoElement | null>(null);
  const [tapFocusPulse, setTapFocusPulse] = useState<{ x: number; y: number } | null>(null);

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

  // Produtos em ruptura no setor da sessão ativa (estoque <= mínimo ou zerado)
  const activeSessionRupturas = products.filter(
    p => p.category?.toUpperCase() === sessionSetor.toUpperCase() && (p.stock <= (p.minStock ?? 5) || p.stock === 0)
  );

  // Verifica se o operador atual é o criador da sessão ativa
  const myMatricula = operator.code || operator.matricula || '';
  const isSessionCreator = !sessionIniciadaPor || (
    sessionIniciadaPor.matricula && myMatricula
      ? sessionIniciadaPor.matricula === myMatricula
      : sessionIniciadaPor.nome.toLowerCase() === (operator.name || 'Operador').toLowerCase()
  );

  // -------------------------------------------------------------------------
  // SINCRONIZAÇÃO EM TEMPO REAL: SESSOES E BIPS MULTI-USUÁRIO
  // -------------------------------------------------------------------------
  const refreshRemoteSessions = useCallback(async () => {
    const lojaId = operator.loja_id || '';
    try {
      const sessions = await fetchActiveAuditSessions(lojaId);
      setActiveRemoteSessions(sessions);
    } catch (err) {
      console.warn('Erro ao carregar sessões ativas:', err);
    }
  }, [operator.loja_id]);

  // Sincroniza bips da sessão ativa com o banco de dados (tabela auditoria_presenca_bips)
  const syncSessionBips = useCallback(async (sessId: string) => {
    try {
      const bips = await fetchSessionBipsFromDatabase(sessId);
      if (!bips || bips.length === 0) return;

      const currentConfs = confirmadosRef.current;
      const currentPends = pendentesRef.current;
      const knownEans = new Set(currentConfs.map(c => c.ean.replace(/[^0-9A-Za-z]/g, '').trim()));

      let hasNewExternalBip = false;
      let lastOtherBipName = '';
      let lastOtherOperator = '';

      const newlyConfirmed: ConfirmedProductItem[] = [];
      const eansToRemoveFromPending = new Set<string>();

      bips.forEach(b => {
        const cleanBipEan = (b.codigo_barras || '').replace(/[^0-9A-Za-z]/g, '').trim();
        if (!knownEans.has(cleanBipEan)) {
          knownEans.add(cleanBipEan);
          const isOther = (b.operador_nome || '').toLowerCase() !== (operator.name || 'Operador').toLowerCase();
          
          if (isOther) {
            hasNewExternalBip = true;
            lastOtherBipName = b.produto_nome;
            lastOtherOperator = b.operador_nome;
          }

          newlyConfirmed.push({
            id: b.produto_id || cleanBipEan,
            name: b.produto_nome,
            ean: b.codigo_barras,
            scannedAt: new Date(b.timestamp).toLocaleTimeString('pt-BR'),
            scannedBy: b.operador_nome,
            scanMethod: 'camera',
            physicalQuantity: b.quantidade_fisica !== null && b.quantidade_fisica !== undefined ? Number(b.quantidade_fisica) : undefined,
          });

          if (b.operador_nome) {
            setSessionParticipants(prev => prev.includes(b.operador_nome) ? prev : [...prev, b.operador_nome]);
          }

          eansToRemoveFromPending.add(cleanBipEan);
        }
      });

      if (newlyConfirmed.length > 0) {
        const updatedConfirmados = [...newlyConfirmed, ...currentConfs];
        const updatedPendentes = currentPends.filter(p => {
          const cleanP = (p.ean || '').replace(/[^0-9A-Za-z]/g, '').trim();
          return !eansToRemoveFromPending.has(cleanP);
        });

        confirmadosRef.current = updatedConfirmados;
        pendentesRef.current = updatedPendentes;
        setConfirmados(updatedConfirmados);
        setPendentes(updatedPendentes);

        if (hasNewExternalBip) {
          triggerBorderFlash('orange');
          setLastBipFeedback({
            type: 'warning',
            message: `✓ Sincronizado: "${lastOtherBipName}" foi conferido em tempo real por ${lastOtherOperator}!`,
          });
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar bips remotos:', err);
    }
  }, [operator.loja_id, operator.name, triggerBorderFlash]);

  // Referência para stopScanning (usado no encerramento automático remoto)
  const stopScanningRef = useRef<() => void>(() => {});

  // Encerramento automático quando o anfitrião finaliza a sessão
  const handleRemoteSessionClosed = useCallback(
    (closedSessionId: string, closedByName?: string) => {
      if (!currentSessionIdRef.current || closedSessionId !== currentSessionIdRef.current) return;
      stopScanningRef.current();
      setPendingInventoryCountItem(null);
      setPhysicalCountInput('');
      setCurrentSessionId(null);
      currentSessionIdRef.current = null;
      setIsAuditing(false);
      setIsInventoryLocked(false);
      setShowStartSessionPopup(false);
      pendentesRef.current = [];
      confirmadosRef.current = [];
      setPendentes([]);
      setConfirmados([]);
      setSessionParticipants([]);
      refreshRemoteSessions();
      refreshAuditsFromDatabase();
      triggerScanBeep(true);
      setLastBipFeedback({
        type: 'warning',
        message: `Sessão encerrada automaticamente pelo anfitrião (${closedByName || 'Criador'}). O relatório foi consolidado.`,
      });
      setActiveInterface('relatorio');
    },
    [refreshRemoteSessions, refreshAuditsFromDatabase, setIsInventoryLocked]
  );

  // Assinatura em Tempo Real (Supabase Realtime Channel com push instantâneo)
  useEffect(() => {
    const lojaId = operator.loja_id || '';
    refreshRemoteSessions();

    const unsubscribe = subscribeToAuditRealtime(
      lojaId,
      () => {
        refreshRemoteSessions();
        if (currentSessionIdRef.current) {
          syncSessionBips(currentSessionIdRef.current);
        }
      },
      (newBip) => {
        if (!currentSessionIdRef.current || newBip.sessao_id !== currentSessionIdRef.current) return;
        
        const cleanEan = (newBip.codigo_barras || '').replace(/[^0-9A-Za-z]/g, '').trim();
        const alreadyInConfirmados = confirmadosRef.current.some(
          c => c.ean.replace(/[^0-9A-Za-z]/g, '').trim() === cleanEan
        );
        if (alreadyInConfirmados) return;

        const isOther = (newBip.operador_nome || '').toLowerCase() !== (operator.name || 'Operador').toLowerCase();
        const newConfirmedItem: ConfirmedProductItem = {
          id: newBip.produto_id || cleanEan,
          name: newBip.produto_nome,
          ean: newBip.codigo_barras,
          scannedAt: new Date(newBip.timestamp).toLocaleTimeString('pt-BR'),
          scannedBy: newBip.operador_nome,
          scanMethod: 'camera',
          physicalQuantity: newBip.quantidade_fisica !== null && newBip.quantidade_fisica !== undefined ? Number(newBip.quantidade_fisica) : undefined,
        };

        if (newBip.operador_nome) {
          setSessionParticipants(prev => prev.includes(newBip.operador_nome) ? prev : [...prev, newBip.operador_nome]);
        }

        const updatedConfirmados = [newConfirmedItem, ...confirmadosRef.current];
        const updatedPendentes = pendentesRef.current.filter(p => {
          const cleanP = (p.ean || '').replace(/[^0-9A-Za-z]/g, '').trim();
          return cleanP !== cleanEan;
        });

        confirmadosRef.current = updatedConfirmados;
        pendentesRef.current = updatedPendentes;
        setConfirmados(updatedConfirmados);
        setPendentes(updatedPendentes);

        if (isOther) {
          triggerBorderFlash('orange');
          setLastBipFeedback({
            type: 'warning',
            message: `✓ Em Tempo Real: "${newBip.produto_nome}" acabou de ser bipado por ${newBip.operador_nome}!`,
            ean: newBip.codigo_barras,
          });
        }
      },
      {
        matricula: operator.code || operator.matricula || '',
        nome: operator.name || 'Operador',
      },
      (offlineUserName) => {
        triggerOfflineAlert(offlineUserName);
      },
      (joinedUserName, sessaoId, joinedMatricula) => {
        if (!currentSessionIdRef.current || sessaoId !== currentSessionIdRef.current) return;
        const myMat = operator.code || operator.matricula || '';
        const isSelf = (joinedMatricula && myMat && joinedMatricula === myMat) ||
          joinedUserName.toLowerCase() === (operator.name || 'Operador').toLowerCase();
        if (isSelf) return;

        setSessionParticipants(prev => prev.includes(joinedUserName) ? prev : [...prev, joinedUserName]);
        triggerJoinAlert(joinedUserName);
        triggerScanBeep(true);
      },
      (closedSessionId, closedByName) => {
        handleRemoteSessionClosed(closedSessionId, closedByName);
      }
    );

    // Ouve desconexão de rede local durante a auditoria
    const handleNetworkOffline = () => {
      triggerOfflineAlert(operator.name || 'Você');
    };
    window.addEventListener('offline', handleNetworkOffline);

    // Polling de contingência a cada 3.5 segundos caso realtime webhooks oscilem
    const interval = setInterval(async () => {
      refreshRemoteSessions();
      const activeSessId = currentSessionIdRef.current;
      if (activeSessId) {
        syncSessionBips(activeSessId);
        const status = await checkAuditSessionStatus(activeSessId, lojaId);
        if (status === 'CONCLUIDA') {
          handleRemoteSessionClosed(activeSessId, sessionIniciadaPor?.nome);
        }
      }
    }, 3500);

    return () => {
      unsubscribe();
      window.removeEventListener('offline', handleNetworkOffline);
      clearInterval(interval);
    };
  }, [operator.loja_id, operator.name, operator.code, operator.matricula, sessionIniciadaPor?.nome, refreshRemoteSessions, syncSessionBips, triggerBorderFlash, triggerOfflineAlert, triggerJoinAlert, handleRemoteSessionClosed]);

  // =========================================================================
  // PROCESSAMENTO CONTÍNUO DE CÓDIGO DE BARRAS EXCLUSIVAMENTE VIA CÂMERA
  // Presença: confirma imediatamente | Inventário Cego: solicita quantidade física
  // =========================================================================
  const processContinuousBarcode = useCallback((scannedCode: string) => {
    const cleanEan = scannedCode.replace(/[^0-9A-Za-z]/g, '').trim();
    if (!cleanEan) return;

    // Se já houver modal de contagem física aberto no Inventário Cego, evita sobrescrever
    if (sessionTipoRef.current === 'INVENTARIO' && pendingInventoryCountRef.current) {
      return;
    }

    // Validação de setor do operador: Somente pessoal daquele setor participa
    const isManager = operator.role === 'gerente' || operator.role === 'saas_admin' || operator.role === 'adm';
    if (!isManager && operator.setor_restrito && operator.setor_restrito !== 'TODOS') {
      if (operator.setor_restrito.toUpperCase() !== sessionSetor.toUpperCase()) {
        triggerScanBeep(false);
        triggerBorderFlash('red');
        setLastBipFeedback({
          type: 'error',
          message: `Acesso Restrito: Somente operadores vinculados ao setor ${sessionSetor} podem bipar itens nesta sessão. Seu setor registrado é ${operator.setor_restrito}.`,
        });
        return;
      }
    }

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

      // INVENTÁRIO CEGO: solicita digitação da quantidade física encontrada antes de confirmar
      if (sessionTipoRef.current === 'INVENTARIO') {
        triggerScanBeep(true);
        triggerBorderFlash('green');
        setPhysicalCountInput('');
        setPendingInventoryCountItem({ product: foundProduct, scannedAt: nowTime });
        return;
      }

      // PRESENÇA: confirma imediatamente via leitura da câmera
      const newPendentes = [...currentPendentes];
      newPendentes.splice(pendingIndex, 1);
      pendentesRef.current = newPendentes;
      setPendentes(newPendentes);

      const operatorDisplayName = operator.name || 'Operador';
      const confirmedItem: ConfirmedProductItem = {
        id: foundProduct.id,
        name: foundProduct.name,
        ean: foundProduct.ean,
        reducedCode: foundProduct.reducedCode,
        supplierCode: foundProduct.supplierCode,
        scannedAt: nowTime,
        scannedBy: operatorDisplayName,
        scanMethod: 'camera',
      };
      setSessionParticipants(prev => prev.includes(operatorDisplayName) ? prev : [...prev, operatorDisplayName]);
      const newConfirmados = [confirmedItem, ...currentConfirmados];
      confirmadosRef.current = newConfirmados;
      setConfirmados(newConfirmados);

      if (currentSessionIdRef.current) {
        insertAuditBipInDatabase({
          id: `${currentSessionIdRef.current}_${foundProduct.id}`,
          sessao_id: currentSessionIdRef.current,
          loja_id: operator.loja_id || '',
          produto_id: foundProduct.id,
          codigo_barras: foundProduct.ean,
          produto_nome: foundProduct.name,
          setor: sessionSetor,
          operador_matricula: operator.code || operator.matricula || '',
          operador_nome: operator.name || 'Operador',
          timestamp: Date.now(),
        }).catch(err => {
          console.warn('Aviso ao registrar bip no banco:', err);
        });
      }

      triggerScanBeep(true);
      triggerBorderFlash('green');
      setLastBipFeedback({
        type: 'success',
        message: `✓ Confirmado via câmera: "${foundProduct.name}"`,
        ean: foundProduct.ean,
      });
      return;
    }

    // 2. Verifica se já foi confirmado anteriormente
    const alreadyConfirmed = currentConfirmados.find(c => {
      const cEan = (c.ean || '').replace(/[^0-9A-Za-z]/g, '').trim();
      const cRed = (c.reducedCode || '').replace(/[^0-9A-Za-z]/g, '').trim();
      return cEan === cleanEan || cEan.endsWith(cleanEan) || cleanEan.endsWith(cEan) || cRed === cleanEan;
    });

    if (alreadyConfirmed) {
      const isOtherOperator = alreadyConfirmed.scannedBy && 
        alreadyConfirmed.scannedBy.toLowerCase() !== (operator.name || 'Operador').toLowerCase();

      if (isOtherOperator) {
        triggerBorderFlash('orange');
        setLastBipFeedback({
          type: 'warning',
          message: `Item já conferido por outro membro da seção (${alreadyConfirmed.scannedBy}) às ${alreadyConfirmed.scannedAt}`,
          ean: cleanEan,
        });
      } else {
        triggerBorderFlash('yellow');
        setLastBipFeedback({
          type: 'warning',
          message: `Item já conferido por você: "${alreadyConfirmed.name}" às ${alreadyConfirmed.scannedAt}`,
          ean: cleanEan,
        });
      }
      return;
    }

    // 3. Código não encontrado entre os itens pendentes do setor: piscar VERMELHO
    triggerScanBeep(false);
    triggerBorderFlash('red');
    setLastBipFeedback({
      type: 'error',
      message: `Código ${cleanEan} não consta nos pendentes deste setor (${sessionSetor}).`,
      ean: cleanEan,
    });
  }, [operator.name, operator.loja_id, operator.code, operator.matricula, operator.role, operator.setor_restrito, sessionSetor, triggerBorderFlash]);

  // Confirma quantidade física digitada após bipagem no Inventário Cego
  const handleConfirmInventoryPhysicalCount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingInventoryCountItem) return;
    const parsedQty = Number(physicalCountInput);
    if (physicalCountInput.trim() === '' || Number.isNaN(parsedQty) || parsedQty < 0 || !Number.isInteger(parsedQty)) {
      triggerScanBeep(false);
      return;
    }

    const { product: foundProduct, scannedAt } = pendingInventoryCountItem;
    const newPendentes = pendentesRef.current.filter(p => p.id !== foundProduct.id);
    pendentesRef.current = newPendentes;
    setPendentes(newPendentes);

    const operatorDisplayName = operator.name || 'Operador';
    const confirmedItem: ConfirmedProductItem = {
      id: foundProduct.id,
      name: foundProduct.name,
      ean: foundProduct.ean,
      reducedCode: foundProduct.reducedCode,
      supplierCode: foundProduct.supplierCode,
      scannedAt,
      scannedBy: operatorDisplayName,
      scanMethod: 'camera',
      physicalQuantity: parsedQty,
    };

    setSessionParticipants(prev => prev.includes(operatorDisplayName) ? prev : [...prev, operatorDisplayName]);
    const newConfirmados = [confirmedItem, ...confirmadosRef.current.filter(c => c.id !== foundProduct.id)];
    confirmadosRef.current = newConfirmados;
    setConfirmados(newConfirmados);

    if (currentSessionIdRef.current) {
      insertAuditBipInDatabase({
        id: `${currentSessionIdRef.current}_${foundProduct.id}`,
        sessao_id: currentSessionIdRef.current,
        loja_id: operator.loja_id || '',
        produto_id: foundProduct.id,
        codigo_barras: foundProduct.ean,
        produto_nome: foundProduct.name,
        setor: sessionSetor,
        quantidade_fisica: parsedQty,
        operador_matricula: operator.code || operator.matricula || '',
        operador_nome: operatorDisplayName,
        timestamp: Date.now(),
      }).catch(err => {
        console.warn('Aviso ao registrar contagem física no banco:', err);
      });
    }

    triggerScanBeep(true);
    triggerBorderFlash('green');
    setLastBipFeedback({
      type: 'success',
      message: `✓ Contagem registrada: "${foundProduct.name}" — Qtd. Física: ${parsedQty} un`,
      ean: foundProduct.ean,
    });
    setPendingInventoryCountItem(null);
    setPhysicalCountInput('');
  };

  // Hook do Leitor com Google Barcode Service + ZXing tryHarder + Zoom & Focus
  const {
    isScanning,
    hasCameraPermission,
    cameraError,
    torchAvailable,
    torchOn,
    toggleTorch,
    startScanning,
    stopScanning,
    zoom,
    setZoom,
    zoomCapabilities,
    focusMode,
    setFocusMode,
    focusCapabilities,
    triggerAutoFocus,
  } = useBarcodeDetector((code) => processContinuousBarcode(code));

  useEffect(() => {
    stopScanningRef.current = stopScanning;
  }, [stopScanning]);

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

  // Efeito de toque na tela para focar (Tap-to-Focus)
  const handleCameraTapToFocus = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setTapFocusPulse({ x, y });
    triggerAutoFocus();
    setTimeout(() => {
      setTapFocusPulse(null);
    }, 800);
  };

  // =========================================================================
  // AÇÕES DA AUDITORIA (PRESENÇA E INVENTÁRIO CEGO) COM TEMPO REAL
  // =========================================================================
  const handleStartAuditSession = (tipo: 'PRESENCA' | 'INVENTARIO' = 'PRESENCA') => {
    const isManager = operator.role === 'gerente' || operator.role === 'saas_admin' || operator.role === 'adm';
    if (!isManager && operator.setor_restrito && operator.setor_restrito !== 'TODOS') {
      if (operator.setor_restrito.toUpperCase() !== selectedSetor.toUpperCase()) {
        triggerScanBeep(false);
        triggerBorderFlash('red');
        setLastBipFeedback({
          type: 'error',
          message: `Acesso Restrito: Somente operadores do setor ${selectedSetor} podem participar desta auditoria. Seu setor registrado é ${operator.setor_restrito}.`,
        });
        return;
      }
    }

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

    const nowMs = Date.now();
    const startTimeFormatted = new Date(nowMs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const creatorName = operator.name || 'Operador';
    setSessionTipo(tipo);
    sessionTipoRef.current = tipo;
    setSessionSetor(selectedSetor);
    pendentesRef.current = [...sectorProducts];
    confirmadosRef.current = [];
    setPendentes([...sectorProducts]);
    setConfirmados([]);
    setPendingInventoryCountItem(null);
    setPhysicalCountInput('');
    setSessionStartTime(startTimeFormatted);
    setSessionStartTimeMs(nowMs);
    setSessionIniciadaPor({
      nome: creatorName,
      matricula: operator.code || operator.matricula || '',
    });
    setSessionParticipants([creatorName]);
    setShowStartSessionPopup(true);
    setIsAuditing(true);
    setIsInventoryLocked(tipo === 'INVENTARIO');
    setIsContinuousCameraActive(true);
    setViewListTab('pendentes');
    setLastBipFeedback(null);
    triggerScanBeep(true);

    const lojaId = operator.loja_id || '';
    startAuditSessionInDatabase({
      lojaId,
      setor: selectedSetor,
      tipo,
      nome: operator.name || 'Operador',
      matricula: operator.code || operator.matricula || '',
    }).then(result => {
      if (result.session?.id) {
        setCurrentSessionId(result.session.id);
        currentSessionIdRef.current = result.session.id;
        refreshRemoteSessions();
      }
    }).catch(err => {
      console.warn('Erro ao criar sessão remota:', err);
    });
  };

  // Entrar em sessão já iniciada por outro operador do mesmo setor
  const handleJoinActiveSession = async (sess: DbActiveAuditSession) => {
    const isManager = operator.role === 'gerente' || operator.role === 'saas_admin' || operator.role === 'adm';
    if (!isManager && operator.setor_restrito && operator.setor_restrito !== 'TODOS') {
      if (operator.setor_restrito.toUpperCase() !== sess.setor.toUpperCase()) {
        triggerScanBeep(false);
        triggerBorderFlash('red');
        setLastBipFeedback({
          type: 'error',
          message: `Acesso Restrito: Somente operadores vinculados ao setor ${sess.setor} podem entrar nesta sessão. Seu setor registrado é ${operator.setor_restrito}.`,
        });
        return;
      }
    }

    const sessTipo: 'PRESENCA' | 'INVENTARIO' = sess.tipo === 'INVENTARIO' ? 'INVENTARIO' : 'PRESENCA';
    const sectorProducts = products.filter(
      p => p.category?.toUpperCase() === sess.setor.toUpperCase()
    );

    setSessionTipo(sessTipo);
    sessionTipoRef.current = sessTipo;
    setActiveInterface(sessTipo === 'INVENTARIO' ? 'inventario' : 'presenca');
    setCurrentSessionId(sess.id);
    currentSessionIdRef.current = sess.id;
    setSessionSetor(sess.setor as SetorLoja);
    setSessionStartTimeMs(sess.timestamp);
    setSessionStartTime(new Date(sess.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    setSessionIniciadaPor({
      nome: sess.iniciada_por_nome,
      matricula: sess.iniciada_por_matricula,
    });
    setPendingInventoryCountItem(null);
    setPhysicalCountInput('');

    const initialParticipants = new Set<string>([
      sess.iniciada_por_nome,
      operator.name || 'Operador',
    ].filter(Boolean));

    try {
      const bips = await fetchSessionBipsFromDatabase(sess.id);
      const bipMap = new Map<string, DbAuditBip>();
      bips.forEach(b => {
        const clean = (b.codigo_barras || '').replace(/[^0-9A-Za-z]/g, '').trim();
        bipMap.set(clean, b);
        if (b.operador_nome) initialParticipants.add(b.operador_nome);
      });

      const initConfirmed: ConfirmedProductItem[] = [];
      const initPendentes: Product[] = [];

      sectorProducts.forEach(prod => {
        const clean = (prod.ean || '').replace(/[^0-9A-Za-z]/g, '').trim();
        const foundBip = bipMap.get(clean);
        if (foundBip) {
          initConfirmed.push({
            id: prod.id,
            name: prod.name,
            ean: prod.ean,
            reducedCode: prod.reducedCode,
            supplierCode: prod.supplierCode,
            scannedAt: new Date(foundBip.timestamp).toLocaleTimeString('pt-BR'),
            scannedBy: foundBip.operador_nome,
            scanMethod: 'camera',
            physicalQuantity: foundBip.quantidade_fisica !== null && foundBip.quantidade_fisica !== undefined ? Number(foundBip.quantidade_fisica) : undefined,
          });
        } else {
          initPendentes.push(prod);
        }
      });

      confirmadosRef.current = initConfirmed;
      pendentesRef.current = initPendentes;
      setConfirmados(initConfirmed);
      setPendentes(initPendentes);
    } catch {
      confirmadosRef.current = [];
      pendentesRef.current = [...sectorProducts];
      setConfirmados([]);
      setPendentes([...sectorProducts]);
    }

    setSessionParticipants(Array.from(initialParticipants));
    setIsAuditing(true);
    setIsInventoryLocked(sessTipo === 'INVENTARIO');
    setIsContinuousCameraActive(true);
    setViewListTab('pendentes');
    triggerScanBeep(true);
    triggerBorderFlash('green');

    notifySessionJoinRealtime({
      lojaId: operator.loja_id || '',
      sessaoId: sess.id,
      nome: operator.name || 'Operador',
      matricula: operator.code || operator.matricula || '',
    }).catch(() => {});
  };

  // Dispara a câmera em tela cheia exclusivamente via leitor óptico (sem entrada manual)
  const handleTriggerGoogleBarcodeScanner = () => {
    openScanner((scannedEan) => {
      processContinuousBarcode(scannedEan);
    }, { cameraOnly: true });
  };

  // Finalizar e salvar a auditoria (apenas criador da sessão) — fecha automaticamente para todos os participantes
  const handleFinishAndSaveAudit = async (forceAutoExpire = false) => {
    if (!forceAutoExpire && !isSessionCreator) {
      triggerScanBeep(false);
      triggerBorderFlash('red');
      setLastBipFeedback({
        type: 'error',
        message: `Apenas o criador da sessão (${sessionIniciadaPor?.nome || 'Iniciador'}) pode encerrar esta auditoria.`,
      });
      return;
    }

    stopScanning();
    setPendingInventoryCountItem(null);
    setPhysicalCountInput('');

    const currentTipo = sessionTipoRef.current;
    const totalItems = confirmados.length + pendentes.length;
    const rate = totalItems > 0 ? ((confirmados.length / totalItems) * 100).toFixed(0) : '0';
    const finishedAtMs = Date.now();
    const durationLabel = formatAuditDuration(finishedAtMs - sessionStartTimeMs);

    const starterLabel = sessionIniciadaPor?.matricula
      ? `${sessionIniciadaPor.nome} (${sessionIniciadaPor.matricula})`
      : (sessionIniciadaPor?.nome || operator.name || 'Operador');

    const participantsSet = new Set<string>([
      ...sessionParticipants,
      sessionIniciadaPor?.nome || '',
      operator.name || '',
      ...confirmados.map(c => c.scannedBy || ''),
    ].filter(Boolean));
    const participantsList = Array.from(participantsSet);

    const cameraScansCount = confirmados.length;
    const manualScansCount = 0;

    const sectorProducts = products.filter(
      p => p.category?.toUpperCase() === sessionSetor.toUpperCase()
    );
    const productStockByEan = new Map<string, number>();
    sectorProducts.forEach(sp => {
      productStockByEan.set((sp.ean || '').replace(/[^0-9A-Za-z]/g, '').trim(), sp.stock ?? 0);
    });

    const ruptureItems = sectorProducts
      .filter(p => p.stock <= (p.minStock ?? 5) || p.stock === 0)
      .map(p => ({
        name: p.name,
        ean: p.ean,
        reducedCode: p.reducedCode,
        supplierCode: p.supplierCode,
        stock: p.stock,
        minStock: p.minStock ?? 5,
      }));

    const lojaId = operator.loja_id || '';
    const composite = buildAuditCompositeParts(lojaId, sessionSetor, sessionStartTimeMs);
    const sessId = currentSessionIdRef.current || `${composite.chaveAuditoria}__${currentTipo.toLowerCase()}`;

    try {
      await finalizeAuditSessionInDatabase({
        sessaoId: sessId,
        lojaId,
        setor: sessionSetor,
        tipo: currentTipo,
        iniciadaPorNome: sessionIniciadaPor?.nome || operator.name || 'Operador',
        iniciadaPorMatricula: sessionIniciadaPor?.matricula || operator.code || operator.matricula || '',
        finalizadaPorNome: operator.name || 'Operador',
        finalizadaPorMatricula: operator.code || operator.matricula || '',
        totalEsperado: totalItems,
        totalAuditado: confirmados.length,
        totalDivergentes: pendentes.length,
        iniciadaEm: sessionStartTimeMs,
        finalizadaEm: finishedAtMs,
        participants: participantsList,
        durationLabel,
        cameraScansCount,
        dataAuditoria: composite.dataAuditoria,
        horaAuditoria: composite.horaAuditoria,
        chaveAuditoria: composite.chaveAuditoria,
        confirmedItems: confirmados.map(c => {
          const cleanEan = (c.ean || '').replace(/[^0-9A-Za-z]/g, '').trim();
          return {
            name: c.name,
            ean: c.ean,
            reducedCode: c.reducedCode,
            supplierCode: c.supplierCode,
            scannedAt: c.scannedAt,
            scannedBy: c.scannedBy || operator.name || 'Operador',
            physicalQuantity: c.physicalQuantity,
            systemQuantity: productStockByEan.get(cleanEan) ?? 0,
          };
        }),
        pendingItems: pendentes.map(p => ({
          name: p.name,
          ean: p.ean,
          reducedCode: p.reducedCode,
          supplierCode: p.supplierCode,
          stock: p.stock,
          minStock: p.minStock ?? 5,
        })),
        ruptureItems,
      });
    } catch (err) {
      console.warn('Erro ao finalizar auditoria remotamente:', err);
    }

    const titlePrefix = currentTipo === 'INVENTARIO' ? 'Inventário Cego' : 'Auditoria de Presença';
    addAudit({
      lojaId,
      title: `${titlePrefix} - ${sessionSetor}`,
      dataAuditoria: composite.dataAuditoria,
      horaAuditoria: composite.horaAuditoria,
      chaveAuditoria: composite.chaveAuditoria,
      itemsCount: confirmados.length,
      status: 'Concluída',
      auditor: operator.code || operator.matricula ? `${operator.name || 'Operador'} (${operator.code || operator.matricula})` : (operator.name || 'Operador'),
      department: sessionSetor,
      type: currentTipo,
      totalItems,
      confirmedItems: confirmados.length,
      pendingItems: pendentes.length,
      presenceRate: `${rate}%`,
      startedBy: starterLabel,
      participants: participantsList,
      startedAtMs: sessionStartTimeMs,
      finishedAtMs,
      durationLabel,
      cameraScansCount,
      manualScansCount,
      confirmedList: confirmados.map(c => {
        const cleanEan = (c.ean || '').replace(/[^0-9A-Za-z]/g, '').trim();
        const sysQty = productStockByEan.get(cleanEan) ?? 0;
        const physQty = c.physicalQuantity;
        return {
          name: c.name,
          ean: c.ean,
          reducedCode: c.reducedCode,
          supplierCode: c.supplierCode,
          scannedAt: c.scannedAt,
          scannedBy: c.scannedBy || operator.name || 'Operador',
          scanMethod: 'camera',
          physicalQuantity: physQty,
          systemQuantity: sysQty,
          divergence: typeof physQty === 'number' ? physQty - sysQty : undefined,
        };
      }),
      pendingList: pendentes.map(p => ({
        name: p.name,
        ean: p.ean,
        reducedCode: p.reducedCode,
        supplierCode: p.supplierCode,
        stock: p.stock,
        minStock: p.minStock ?? 5,
        systemQuantity: p.stock,
        physicalQuantity: currentTipo === 'INVENTARIO' ? 0 : undefined,
        divergence: currentTipo === 'INVENTARIO' ? -(p.stock ?? 0) : undefined,
      })),
      ruptureList: ruptureItems,
    });

    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    setIsAuditing(false);
    setIsInventoryLocked(false);
    setShowStartSessionPopup(false);
    setPendentes([]);
    setConfirmados([]);
    setSessionParticipants([]);
    setLastBipFeedback(null);
    refreshRemoteSessions();
    refreshAuditsFromDatabase();
    setActiveInterface('relatorio');
    triggerScanBeep(true);
  };

  // Fechamento automático após 5h de queda/inatividade
  useEffect(() => {
    if (!isAuditing) return;
    const checkExpiry = () => {
      if (Date.now() - sessionStartTimeMs >= AUDIT_SESSION_MAX_INACTIVITY_MS) {
        if (isSessionCreator) {
          handleFinishAndSaveAudit(true);
        } else {
          stopScanning();
          setIsAuditing(false);
          setIsInventoryLocked(false);
          setCurrentSessionId(null);
          currentSessionIdRef.current = null;
          setLastBipFeedback({
            type: 'warning',
            message: 'Sessão encerrada automaticamente após atingir o limite máximo de 5 horas.',
          });
        }
      }
    };
    const timer = setInterval(checkExpiry, 30000);
    return () => clearInterval(timer);
  }, [isAuditing, sessionStartTimeMs, isSessionCreator]);

  // Exportar relatório em PDF (nativo, sem armazenamento local)
  const handleExportAuditPDF = (audit: AuditItem) => {
    exportAuditReportToPDF(audit, {
      storeName,
      showSystemStock: isManagerUser || audit.type !== 'INVENTARIO',
    });
  };

  // Exportar relatório em XLSX
  const handleExportAuditXLSX = (audit: AuditItem) => {
    const camCount = audit.cameraScansCount ?? (audit.confirmedList?.filter(c => (c.scanMethod ?? 'camera') === 'camera').length ?? audit.confirmedItems ?? audit.itemsCount);
    const manCount = audit.manualScansCount ?? (audit.confirmedList?.filter(c => c.scanMethod === 'manual').length ?? 0);
    const rows = [
      { Informação: 'Chave Composta', Valor: audit.chaveAuditoria || audit.id },
      { Informação: 'Título', Valor: audit.title },
      { Informação: 'Setor', Valor: audit.department || '-' },
      { Informação: 'Iniciada por', Valor: audit.startedBy || audit.auditor },
      { Informação: 'Finalizada por / Auditor', Valor: audit.auditor },
      { Informação: 'Participantes', Valor: audit.participants?.join(', ') || audit.auditor },
      { Informação: 'Duração Total', Valor: audit.durationLabel || '-' },
      { Informação: 'Data', Valor: audit.dataAuditoria || audit.date },
      { Informação: 'Hora', Valor: audit.horaAuditoria || '-' },
      { Informação: 'Status', Valor: audit.status },
      { Informação: 'Taxa de Presença', Valor: audit.presenceRate || '100%' },
      { Informação: 'Itens Confirmados', Valor: audit.confirmedItems ?? audit.itemsCount },
      { Informação: 'Bipados via Leitura (Câmera)', Valor: camCount },
      { Informação: 'Bipados via Inserção Manual', Valor: manCount },
      { Informação: 'Itens Pendentes/Ausentes', Valor: audit.pendingItems ?? 0 },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resumo');
    XLSX.writeFile(wb, `auditoria_${audit.department || 'geral'}_${audit.dataAuditoria || audit.date}.xlsx`);
  };

  // Cálculos de progresso
  const totalSessionProducts = confirmados.length + pendentes.length;
  const progressPercent = totalSessionProducts > 0
    ? Math.round((confirmados.length / totalSessionProducts) * 100)
    : 0;

  // Bipagem pós-auditoria via câmera no relatório para itens não encontrados em área
  const handleBipMissingItem = (scannedEan: string, expectedItemEan?: string) => {
    if (!selectedAuditForModal) return;
    const cleanEan = scannedEan.replace(/[^0-9A-Za-z]/g, '').trim();
    if (!cleanEan) return;

    const pendingList = selectedAuditForModal.pendingList || [];
    const itemIndex = pendingList.findIndex(p => {
      const pEan = (p.ean || '').replace(/[^0-9A-Za-z]/g, '').trim();
      const pRed = (p.reducedCode || '').replace(/[^0-9A-Za-z]/g, '').trim();
      const pSup = (p.supplierCode || '').replace(/[^0-9A-Za-z]/g, '').trim();
      const matchesScanned = pEan === cleanEan || pEan.endsWith(cleanEan) || cleanEan.endsWith(pEan) || pRed === cleanEan || pSup === cleanEan;
      if (!matchesScanned) return false;
      if (expectedItemEan) {
        const cleanExpected = expectedItemEan.replace(/[^0-9A-Za-z]/g, '').trim();
        return pEan === cleanExpected;
      }
      return true;
    });

    if (itemIndex === -1) {
      triggerScanBeep(false);
      triggerBorderFlash('red');
      setModalFeedback(
        expectedItemEan
          ? `Código lido (${cleanEan}) não corresponde ao item esperado (${expectedItemEan}).`
          : `Código ${cleanEan} não consta na lista de itens não bipados deste relatório.`
      );
      return;
    }

    const item = pendingList[itemIndex];
    const newPendingList = [...pendingList];
    newPendingList.splice(itemIndex, 1);

    const nowTime = new Date().toLocaleTimeString('pt-BR');
    const newConfirmedEntry = {
      name: item.name,
      ean: item.ean,
      reducedCode: item.reducedCode,
      supplierCode: item.supplierCode,
      scannedAt: nowTime,
      scannedBy: operator.name || 'Operador',
      scanMethod: 'camera' as const,
    };

    const newConfirmedList = [newConfirmedEntry, ...(selectedAuditForModal.confirmedList || [])];
    const newConfirmedCount = newConfirmedList.length;
    const newPendingCount = newPendingList.length;
    const total = selectedAuditForModal.totalItems ?? (newConfirmedCount + newPendingCount);
    const newRate = total > 0 ? `${Math.round((newConfirmedCount / total) * 100)}%` : '100%';
    const prevCam = selectedAuditForModal.cameraScansCount ?? (selectedAuditForModal.confirmedList?.filter(c => (c.scanMethod ?? 'camera') === 'camera').length ?? selectedAuditForModal.confirmedItems ?? 0);

    const updatedAudit: AuditItem = {
      ...selectedAuditForModal,
      confirmedItems: newConfirmedCount,
      itemsCount: newConfirmedCount,
      pendingItems: newPendingCount,
      presenceRate: newRate,
      cameraScansCount: prevCam + 1,
      confirmedList: newConfirmedList,
      pendingList: newPendingList,
    };

    updateAudit(selectedAuditForModal.id, updatedAudit);
    setSelectedAuditForModal(updatedAudit);
    confirmMissingAuditProductInDatabase({
      sessaoId: selectedAuditForModal.id,
      lojaId: operator.loja_id || selectedAuditForModal.lojaId || '',
      ean: item.ean,
      operadorNome: operator.name || 'Operador',
      operadorMatricula: operator.code || operator.matricula || '',
      newConfirmedCount,
      newPendingCount,
      newCameraScansCount: prevCam + 1,
    });
    triggerScanBeep(true);
    triggerBorderFlash('green');
    setModalFeedback(`✓ Produto "${item.name}" localizado via câmera e transferido para a lista de Bipados!`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 relative">
      
      {/* =================================================================== */}
      {/* EFEITO VISUAL DE BIPAGEM: PISCAR BORDAS DA INTERFACE                */}
      {/* Verde: Sucesso | Amarelo: Duplo | Vermelho: Sem resultado | Laranja: Outro membro */}
      {/* =================================================================== */}
      {scanFlashBorder && (
        <div
          className={`fixed inset-0 pointer-events-none z-50 transition-all duration-150 ${
            scanFlashBorder === 'green'
              ? 'ring-8 sm:ring-12 ring-inset ring-emerald-500 shadow-[inset_0_0_90px_rgba(16,185,129,0.75)]'
              : scanFlashBorder === 'yellow'
              ? 'ring-8 sm:ring-12 ring-inset ring-amber-400 shadow-[inset_0_0_90px_rgba(251,191,36,0.75)]'
              : scanFlashBorder === 'orange'
              ? 'ring-8 sm:ring-12 ring-inset ring-orange-500 shadow-[inset_0_0_90px_rgba(249,115,22,0.75)]'
              : 'ring-8 sm:ring-12 ring-inset ring-rose-500 shadow-[inset_0_0_90px_rgba(244,63,94,0.75)]'
          }`}
        />
      )}

      {/* =================================================================== */}
      {/* POP-UP NO CANTO SUPERIOR DIREITO: USUÁRIO ENTROU NA SESSÃO          */}
      {/* =================================================================== */}
      {joinAlert && (
        <div className="fixed top-32 right-4 z-50 p-4 bg-emerald-600 text-white rounded-3xl shadow-2xl flex items-center gap-3 border border-emerald-400 animate-in slide-in-from-right-4 duration-300 max-w-sm">
          <div className="p-2 rounded-2xl bg-white/20 text-white shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-xs">Novo Participante na Sessão</p>
            <p className="text-[11px] text-emerald-50 mt-0.5 leading-snug">
              <strong>{joinAlert.name}</strong> entrou na seção.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setJoinAlert(null)}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition cursor-pointer"
            title="Fechar notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* POP-UP DE INÍCIO DA SESSÃO DE AUDITORIA                             */}
      {/* =================================================================== */}
      {showStartSessionPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                <Info className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Sessão de Auditoria Iniciada
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Setor: <strong>{sessionSetor}</strong> • Criador: <strong>{sessionIniciadaPor?.nome || operator.name}</strong>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 space-y-2 leading-relaxed">
              <p>
                • <strong>Apenas o criador da sessão</strong> pode encerrar e finalizar esta auditoria.
              </p>
              <p>
                • Em caso de <strong>queda de conexão ou inatividade</strong>, a sessão permanece aberta por até <strong>5 horas</strong> antes do fechamento automático.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowStartSessionPopup(false)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                Entendi, Continuar Auditoria
              </button>
            </div>
          </div>
        </div>
      )}
      {/* =================================================================== */}
      {/* MODAL DE QUANTIDADE FÍSICA (INVENTÁRIO CEGO AO BIPAR PELA CÂMERA)   */}
      {/* =================================================================== */}
      {pendingInventoryCountItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleConfirmInventoryPhysicalCount}
            className="w-full max-w-md bg-white dark:bg-slate-900 border-2 border-amber-500/60 rounded-3xl shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                    Inventário Cego • Produto Bipado
                  </span>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white leading-snug">
                    {pendingInventoryCountItem.product.name}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    EAN: {pendingInventoryCountItem.product.ean}
                    {pendingInventoryCountItem.product.reducedCode ? ` • Red: ${pendingInventoryCountItem.product.reducedCode}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase block">
                Digite a Quantidade Física Encontrada:
              </label>
              <input
                ref={physicalCountInputRef}
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                required
                autoFocus
                placeholder="Ex: 12"
                value={physicalCountInput}
                onChange={(e) => setPhysicalCountInput(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-amber-500/50 bg-slate-50 dark:bg-slate-800 text-xl font-black text-slate-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[11px] text-slate-400 text-center">
                Contagem cega: informe exatamente a quantidade física contada na área.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPendingInventoryCountItem(null);
                  setPhysicalCountInput('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Quantidade</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {offlineAlert && (
        <div className="fixed top-16 right-4 z-50 p-4 bg-rose-600 text-white rounded-3xl shadow-2xl flex items-center gap-3 border border-rose-400 animate-in slide-in-from-right-4 duration-300 max-w-sm">
          <div className="p-2 rounded-2xl bg-white/20 text-white shrink-0">
            <WifiOff className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-xs">Atenção: Operador Offline</p>
            <p className="text-[11px] text-rose-100 mt-0.5 leading-snug">
              O colaborador <strong>{offlineAlert.name}</strong> está offline (perda de conexão).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOfflineAlert(null)}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition cursor-pointer"
            title="Fechar alerta"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--store-color, #059669)' }}
              aria-hidden="true"
            />
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
          type="button"
          disabled={isInventoryLocked}
          onClick={() => !isInventoryLocked && setActiveInterface('presenca')}
          className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition text-center ${
            isInventoryLocked ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
          } ${
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

        {/* 2. Auditoria de Inventário (Cega) */}
        <button
          type="button"
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
          <span>Inventário Cego</span>
          {isInventoryLocked && (
            <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-rose-600 text-white uppercase inline-flex items-center gap-0.5">
              <Lock className="w-2.5 h-2.5" /> Travado
            </span>
          )}
        </button>

        {/* 3. Auditoria de Validade */}
        <button
          type="button"
          disabled={isInventoryLocked}
          onClick={() => !isInventoryLocked && setActiveInterface('validade')}
          className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition text-center relative ${
            isInventoryLocked ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
          } ${
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
          type="button"
          disabled={isInventoryLocked}
          onClick={() => !isInventoryLocked && setActiveInterface('relatorio')}
          className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition text-center ${
            isInventoryLocked ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
          } ${
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
      {/* INTERFACE 1: AUDITORIA DE PRESENÇA (CONFIGURAÇÃO)                   */}
      {/* =================================================================== */}
      {activeInterface === 'presenca' && (!isAuditing || sessionTipo !== 'PRESENCA') && (
        <div className="space-y-4">
              {/* SESSÕES ATIVAS EM TEMPO REAL DE PRESENÇA */}
              {activeRemoteSessions.filter(s => (s.tipo || 'PRESENCA') === 'PRESENCA').length > 0 && (
                <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border-2 border-emerald-500/40 shadow-lg space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                          <span>Sessão de Auditoria Ativa no Setor</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-extrabold uppercase">
                            Em Tempo Real
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Outro operador da sua loja já iniciou uma conferência. Você pode entrar e auditar em equipe simultaneamente!
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {activeRemoteSessions
                      .filter(s => (s.tipo || 'PRESENCA') === 'PRESENCA')
                      .map((sess) => {
                      const canJoin =
                        operator.role === 'gerente' ||
                        operator.role === 'saas_admin' ||
                        operator.role === 'adm' ||
                        !operator.setor_restrito ||
                        operator.setor_restrito === 'TODOS' ||
                        operator.setor_restrito.toUpperCase() === sess.setor.toUpperCase();

                      return (
                        <div
                          key={sess.id}
                          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-sm hover:border-emerald-500 transition"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                                Setor {sess.setor}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {sess.hora_auditoria || new Date(sess.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300">
                              Iniciada por: <strong className="text-slate-900 dark:text-white">{sess.iniciada_por_nome}</strong>
                            </p>
                          </div>

                          {canJoin ? (
                            <button
                              type="button"
                              onClick={() => handleJoinActiveSession(sess)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 transition flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                              <Users className="w-4 h-4" />
                              <span>Entrar na Sessão</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              Restrito ao setor {sess.setor}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white">
                      Iniciar Nova Auditoria de Presença
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Selecione o setor da loja para conferir presença exclusivamente via leitura de código de barras pela câmera.
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
                    Ao iniciar, os <strong>{productsInSelectedSetor.length}</strong> produtos do setor <strong>{selectedSetor}</strong> entram em <strong>Pendentes</strong>. A confirmação é feita exclusivamente por bipagem via câmera; quando o anfitrião encerrar, todos os participantes fecham automaticamente.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartAuditSession('PRESENCA')}
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
        </div>
      )}

      {/* =================================================================== */}
      {/* INTERFACE 2: AUDITORIA DE INVENTÁRIO CEGO (CONFIGURAÇÃO)            */}
      {/* =================================================================== */}
      {activeInterface === 'inventario' && (!isAuditing || sessionTipo !== 'INVENTARIO') && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* SESSÕES ATIVAS DE INVENTÁRIO CEGO */}
          {activeRemoteSessions.filter(s => s.tipo === 'INVENTARIO').length > 0 && (
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border-2 border-amber-500/50 shadow-lg space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-amber-500 animate-pulse" />
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    <span>Sessão de Inventário Cego Ativa</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold uppercase">
                      Modo Restrito
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Entre para realizar a contagem física cega em equipe via leitura de código de barras.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {activeRemoteSessions
                  .filter(s => s.tipo === 'INVENTARIO')
                  .map((sess) => {
                    const canJoin =
                      operator.role === 'gerente' ||
                      operator.role === 'saas_admin' ||
                      operator.role === 'adm' ||
                      !operator.setor_restrito ||
                      operator.setor_restrito === 'TODOS' ||
                      operator.setor_restrito.toUpperCase() === sess.setor.toUpperCase();

                    return (
                      <div
                        key={sess.id}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/40 flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-amber-600 uppercase tracking-wide">
                              Setor {sess.setor}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {sess.hora_auditoria || new Date(sess.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">
                            Anfitrião: <strong className="text-slate-900 dark:text-white">{sess.iniciada_por_nome}</strong>
                          </p>
                        </div>

                        {canJoin ? (
                          <button
                            type="button"
                            onClick={() => handleJoinActiveSession(sess)}
                            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Users className="w-4 h-4" />
                            <span>Entrar no Inventário</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            Restrito ao setor {sess.setor}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Iniciar Auditoria de Inventário (Contagem Cega)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bipe pela câmera, digite a quantidade física encontrada e opere em Modo Restrito sem visualizar saldos de estoque.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-500" />
                  1. Selecione o Setor para Inventariar:
                </label>
                <span className="text-[11px] font-bold text-amber-600">
                  Setor Escolhido: {selectedSetor} ({productsInSelectedSetor.length} produtos)
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
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-400/40'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-500/50'
                      }`}
                    >
                      <span>{setor}</span>
                      <span className={`text-[10px] font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                        {countInSetor} {countInSetor === 1 ? 'item' : 'itens'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  Regras do Inventário Cego & Modo Restrito:
                </h4>
                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5 list-disc list-inside">
                  <li>Leitura exclusiva via código de barras na câmera; ao bipar, informe a quantidade física.</li>
                  <li>As quantidades em estoque do sistema ficam ocultas durante toda a sessão.</li>
                  <li>A interface permanece bloqueada até o anfitrião finalizar o inventário.</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => handleStartAuditSession('INVENTARIO')}
                className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Iniciar Inventário Cego</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* PAINEL DE SESSÃO ATIVA COMPARTILHADO (PRESENÇA E INVENTÁRIO CEGO)   */}
      {/* =================================================================== */}
      {isAuditing && (
        (activeInterface === 'presenca' && sessionTipo === 'PRESENCA') ||
        (activeInterface === 'inventario' && sessionTipo === 'INVENTARIO')
      ) && (
            <div className="space-y-4">
              {sessionTipo === 'INVENTARIO' && (
                <div className="p-3.5 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-between gap-2 shadow-md">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>
                      MODO RESTRITO ATIVO — Inventário Cego em andamento. Sair, fechar ou trocar de aba está bloqueado até o anfitrião encerrar.
                    </span>
                  </div>
                </div>
              )}

              {/* Barra de Status e Cabeçalho da Sessão */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full animate-ping ${sessionTipo === 'INVENTARIO' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{sessionTipo === 'INVENTARIO' ? 'Inventário Cego Ativo' : 'Auditoria Ativa'}: Setor {sessionSetor}</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                          sessionTipo === 'INVENTARIO'
                            ? 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        }`}>
                          Ao Vivo
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Início: {sessionStartTime} • Anfitrião: {sessionIniciadaPor?.nome || operator.name || 'Operador'} • Auditor: {operator.name || 'Operador'}{operator.code ? ` (${operator.code})` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Ações de Conclusão (Sem botão sair/pausar no Inventário Cego) */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {sessionTipo === 'PRESENCA' && (
                      <button
                        type="button"
                        onClick={() => setIsAuditing(false)}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        Pausar / Sair
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleFinishAndSaveAudit(false)}
                      disabled={!isSessionCreator}
                      title={!isSessionCreator ? `Apenas o anfitrião (${sessionIniciadaPor?.nome}) pode encerrar esta sessão` : 'Concluir e salvar relatório'}
                      className={`px-4 py-2 rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 ${
                        isSessionCreator
                          ? sessionTipo === 'INVENTARIO'
                            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 cursor-pointer'
                          : 'bg-slate-400 dark:bg-slate-700 text-white cursor-not-allowed opacity-70'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {isSessionCreator
                          ? sessionTipo === 'INVENTARIO'
                            ? 'Concluir e Salvar Inventário'
                            : 'Concluir e Salvar Relatório'
                          : 'Aguardando Anfitrião Encerrar'}
                      </span>
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
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">
                      {sessionTipo === 'INVENTARIO' ? 'Contados' : 'Confirmados'}
                    </span>
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
                    <span className="text-slate-500">
                      {sessionTipo === 'INVENTARIO' ? 'Progresso do Inventário' : 'Conformidade de Presença'}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400">{progressPercent}% auditado</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* ATIVIDADE EM TEMPO REAL DA EQUIPE NO SETOR */}
                {confirmados.length > 0 && (
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs animate-in fade-in">
                    <div className="flex items-center gap-2 truncate">
                      <Radio className="w-4 h-4 text-emerald-500 animate-pulse shrink-0" />
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">Última bipagem na equipe:</span>
                      <span className="font-bold text-slate-900 dark:text-white truncate">"{confirmados[0].name}"</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                      {confirmados[0].scannedBy || 'Operador'} às {confirmados[0].scannedAt}
                    </span>
                  </div>
                )}

                {/* PAINEL DE LEITURA EXCLUSIVA PELA CÂMERA */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-900/10 border border-emerald-500/30 space-y-3.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                          <span>Leitor Contínuo Exclusivo por Câmera</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500 text-white font-extrabold tracking-wide uppercase">
                            Somente Bipe Óptico
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {sessionTipo === 'INVENTARIO'
                            ? 'Aponte a câmera para o código de barras e digite a quantidade física encontrada.'
                            : 'Aponte a câmera para o código de barras na gôndola para confirmar a presença.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
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
                    <div className="space-y-2">
                      <div 
                        onClick={handleCameraTapToFocus}
                        className="relative w-full h-80 sm:h-96 md:h-[430px] bg-black rounded-3xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl flex items-center justify-center cursor-crosshair group select-none"
                        title="Toque em qualquer ponto da imagem para refocar a câmera"
                      >
                        <video
                          ref={continuousVideoRef}
                          autoPlay
                          playsInline
                          muted
                          style={{
                            transform: zoom > 1 ? `scale(${zoom})` : undefined,
                            transformOrigin: 'center center',
                            transition: 'transform 0.15s ease-out'
                          }}
                          className="w-full h-full object-cover"
                        />

                        {tapFocusPulse && (
                          <div
                            style={{ left: tapFocusPulse.x, top: tapFocusPulse.y }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
                          >
                            <span className="w-12 h-12 rounded-full border-2 border-emerald-400 block animate-ping opacity-80" />
                            <span className="w-8 h-8 rounded-full border border-white absolute inset-0 m-auto" />
                          </div>
                        )}

                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                          <div className="w-72 sm:w-96 h-40 sm:h-52 border-2 border-emerald-400/90 rounded-2xl relative shadow-[0_0_25px_rgba(16,185,129,0.35)] bg-emerald-500/5 backdrop-blur-[0.5px]">
                            <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-emerald-300" />
                            <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-emerald-300" />
                            <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-emerald-300" />
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-emerald-300" />
                            <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse top-1/2 -translate-y-1/2" />
                          </div>

                          <div className="absolute top-3 inset-x-4 flex items-center justify-between text-[11px] font-bold text-white pointer-events-none">
                            <span className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 flex items-center gap-1.5 shadow-md">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                              <span>Leitura Contínua • {zoom.toFixed(1)}x</span>
                            </span>
                            <span className="px-3 py-1 rounded-full bg-emerald-600/90 backdrop-blur-md border border-emerald-400/40 shadow-md">
                              {confirmados.length} auditados / {pendentes.length} pendentes
                            </span>
                          </div>

                          <div className="absolute bottom-3 inset-x-4 flex items-center justify-between pointer-events-none">
                            <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] text-slate-300 font-medium">
                              👆 Toque na tela para focar
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] text-emerald-300 font-mono">
                              Modo: {focusMode === 'macro' ? 'Macro (Perto)' : 'Auto Foco'}
                            </span>
                          </div>
                        </div>

                        {cameraError && (
                          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center space-y-3 z-40">
                            <AlertTriangle className="w-10 h-10 text-amber-400" />
                            <p className="text-xs text-white max-w-sm">{cameraError}</p>
                            <button
                              type="button"
                              onClick={() => {
                                if (continuousVideoRef.current) startScanning(continuousVideoRef.current);
                              }}
                              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-md"
                            >
                              Tentar Acessar Câmera Novamente
                            </button>
                          </div>
                        )}
                      </div>

                      {/* BARRA DE CONTROLE AVANÇADO DE ZOOM E FOCO */}
                      <div className="p-3 rounded-2xl bg-slate-900 text-white border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
                            <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
                            Zoom:
                          </span>
                          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                            {[1, 1.5, 2, 2.5, 3].map((level) => (
                              <button
                                key={level}
                                type="button"
                                onClick={() => setZoom(level)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition cursor-pointer ${
                                  Math.abs(zoom - level) < 0.15
                                    ? 'bg-emerald-500 text-white shadow-xs'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                              >
                                {level}x
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-44">
                          <input
                            type="range"
                            min={zoomCapabilities.min}
                            max={zoomCapabilities.max}
                            step={zoomCapabilities.step}
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            aria-label="Ajuste de Zoom da Câmera"
                          />
                          <span className="text-[10px] font-mono text-emerald-400 font-bold w-8 text-right">
                            {zoom.toFixed(1)}x
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => triggerAutoFocus()}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold transition flex items-center gap-1 border border-slate-700 cursor-pointer"
                            title="Refocar lente da câmera"
                          >
                            <Target className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Re-focar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFocusMode(focusMode === 'macro' ? 'continuous' : 'macro')}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 border cursor-pointer ${
                              focusMode === 'macro'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750'
                            }`}
                            title="Alternar entre modo Macro e Contínuo"
                          >
                            <Sliders className="w-3.5 h-3.5 text-amber-400" />
                            <span>{focusMode === 'macro' ? 'Macro' : 'Normal'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 rounded-3xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                      <CameraOff className="w-10 h-10 text-slate-400 mx-auto" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        Câmera Contínua Pausada
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Clique em "Ativar Câmera" acima para bipar os produtos exclusivamente via câmera.
                      </p>
                    </div>
                  )}

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

              {/* LISTAS: PENDENTES VS CONFIRMADOS (SEM RUPTURAS/ESTOQUE NO INVENTÁRIO CEGO) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-3">
                <div className="flex flex-wrap border-b border-slate-100 dark:border-slate-800 text-xs gap-2">
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
                    <span>{sessionTipo === 'INVENTARIO' ? `Itens Contados (${confirmados.length})` : `Lista de Confirmados (${confirmados.length})`}</span>
                  </button>
                  {sessionTipo === 'PRESENCA' && (
                    <button
                      onClick={() => setViewListTab('rupturas')}
                      className={`py-2 px-3.5 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                        viewListTab === 'rupturas'
                          ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      <span>Lista de Rupturas ({activeSessionRupturas.length})</span>
                    </button>
                  )}
                </div>

                {/* Exibição da Lista Pendentes (SEM botão conferir manual e SEM estoque no inventário cego) */}
                {viewListTab === 'pendentes' && (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {pendentes.length === 0 ? (
                      <div className="p-8 text-center rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <h4 className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                          Todos os produtos do setor foram auditados!
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Nenhum produto pendente.
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
                              Aguardando Bipe
                            </span>
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
                        Nenhum produto bipado ainda. Aponte a câmera para o código de barras do item.
                      </div>
                    ) : (
                      confirmados.map(item => {
                        const isSelf = !item.scannedBy || item.scannedBy.toLowerCase() === (operator.name || 'Operador').toLowerCase();
                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-all ${
                              isSelf 
                                ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20' 
                                : 'border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/25 shadow-xs'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <CheckCircle2 className={`w-3.5 h-3.5 ${isSelf ? 'text-emerald-500' : 'text-amber-500'}`} />
                                <span>{item.name}</span>
                              </h5>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                                <span>EAN: {item.ean}</span>
                                {item.reducedCode && <span>• Red: {item.reducedCode}</span>}
                                {sessionTipo === 'INVENTARIO' && typeof item.physicalQuantity === 'number' && (
                                  <span className="text-amber-600 font-black">• Qtd. Física: {item.physicalQuantity} un</span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0 space-y-1">
                              {isSelf ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-500" /> Você • {item.scannedAt}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40 inline-flex items-center gap-1">
                                  <Users className="w-3 h-3 text-amber-500" /> Bipado por: <strong>{item.scannedBy}</strong> • {item.scannedAt}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 block font-mono">
                                Realtime Supabase
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Exibição da Lista de Rupturas (somente Presença) */}
                {sessionTipo === 'PRESENCA' && viewListTab === 'rupturas' && (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {activeSessionRupturas.length === 0 ? (
                      <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Nenhum produto em ruptura ou estoque crítico no setor {sessionSetor}.
                      </div>
                    ) : (
                      activeSessionRupturas.map(item => (
                        <div
                          key={item.id}
                          className="p-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                              <span>{item.name}</span>
                            </h5>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                              <span>EAN: {item.ean}</span>
                              {item.reducedCode && <span>• Reduzido: {item.reducedCode}</span>}
                              {item.supplierCode && <span>• Forn: {item.supplierCode}</span>}
                            </div>
                          </div>

                          <div className="text-right shrink-0 space-y-1">
                            <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 block">
                              Saldo: {item.stock} un (Mín: {item.minStock ?? 5} un)
                            </span>
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white inline-block">
                              {item.stock <= 0 ? 'Zerado' : 'Ruptura Iminente'}
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-500" />
                Histórico & Relatórios de Auditorias
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isManagerUser
                  ? 'Visão gerencial da loja: todos os setores em ordem cronológica (sem armazenamento local).'
                  : `Exibindo relatórios do seu setor (${operator.setor_restrito || 'Geral'}) diretamente do servidor.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => refreshAuditsFromDatabase()}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:border-emerald-500 transition cursor-pointer"
                title="Atualizar relatórios do servidor"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold text-slate-400">
                {visibleAudits.length} {visibleAudits.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
          </div>

          {visibleAudits.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">Nenhum relatório disponível</h4>
              <p className="text-xs text-slate-400 mt-1">
                Inicie uma <strong>Auditoria de Presença</strong> ou <strong>Inventário Cego</strong> para gerar relatórios no servidor.
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
              {visibleAudits.map(audit => {
                const camScans = audit.cameraScansCount ?? (audit.confirmedList?.filter(c => (c.scanMethod ?? 'camera') === 'camera').length ?? audit.confirmedItems ?? audit.itemsCount);
                const participantsText = audit.participants && audit.participants.length > 0 ? audit.participants.join(', ') : audit.auditor;

                return (
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
                      {audit.type === 'INVENTARIO' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 border border-amber-500/30">
                          Inventário Cego
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {audit.dataAuditoria ? `${audit.dataAuditoria} ${audit.horaAuditoria || ''}` : audit.date}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Iniciada por: <strong>{audit.startedBy || audit.auditor}</strong> • Duração: <strong>{audit.durationLabel || '-'}</strong>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Participantes ({audit.participants?.length ?? 1}): <strong>{participantsText}</strong>
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {audit.type === 'INVENTARIO' ? 'Contados' : 'Confirmados'}: {audit.confirmedItems ?? audit.itemsCount}
                      </span>
                      {typeof audit.pendingItems === 'number' && (
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          Não Bipados: {audit.pendingItems}
                        </span>
                      )}
                      {audit.presenceRate && (
                        <span className="font-black text-slate-800 dark:text-slate-100">
                          Conformidade: {audit.presenceRate}
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                        Bipes Câmera: {camScans}
                      </span>
                    </div>
                  </div>

                  {/* Ações: Exportar PDF, XLSX e Ver Detalhes */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleExportAuditPDF(audit)}
                      className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                      title="Exportar relatório oficial em PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Exportar PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportAuditXLSX(audit)}
                      className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Exportar planilha Excel deste relatório"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">.XLSX</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setModalActiveTab('bipados');
                        setSelectedAuditForModal(audit);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Detalhes</span>
                    </button>
                  </div>
                </div>
                );
              })}
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

            {/* Metadados da Sessão no Relatório */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">
                  Iniciada por: <strong className="text-slate-800 dark:text-white">{selectedAuditForModal.startedBy || selectedAuditForModal.auditor}</strong>
                </span>
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-500" />
                  Duração: <strong className="text-slate-800 dark:text-white">{selectedAuditForModal.durationLabel || '-'}</strong>
                </span>
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Participantes ({selectedAuditForModal.participants?.length ?? 1}):{' '}
                <strong className="text-slate-800 dark:text-white">
                  {selectedAuditForModal.participants && selectedAuditForModal.participants.length > 0
                    ? selectedAuditForModal.participants.join(', ')
                    : selectedAuditForModal.auditor}
                </strong>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-0.5">
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                  <Camera className="w-3.5 h-3.5" />
                  Leitura (Câmera): {selectedAuditForModal.cameraScansCount ?? (selectedAuditForModal.confirmedList?.filter(c => (c.scanMethod ?? 'camera') === 'camera').length ?? selectedAuditForModal.confirmedItems ?? selectedAuditForModal.itemsCount)}
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                  Inserção Manual: {selectedAuditForModal.manualScansCount ?? (selectedAuditForModal.confirmedList?.filter(c => c.scanMethod === 'manual').length ?? 0)}
                </span>
              </div>
            </div>

            {/* Seletor de 3 Abas do Relatório de Auditoria */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs gap-1">
              <button
                type="button"
                onClick={() => setModalActiveTab('bipados')}
                className={`py-2 px-3 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                  modalActiveTab === 'bipados'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Itens Bipados ({selectedAuditForModal.confirmedList?.length ?? selectedAuditForModal.confirmedItems ?? 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveTab('nao_bipados')}
                className={`py-2 px-3 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                  modalActiveTab === 'nao_bipados'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Não Bipados ({selectedAuditForModal.pendingList?.length ?? selectedAuditForModal.pendingItems ?? 0})</span>
              </button>

              {(selectedAuditForModal.type !== 'INVENTARIO' || isManagerUser) && (
                <button
                  type="button"
                  onClick={() => setModalActiveTab('rupturas')}
                  className={`py-2 px-3 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                    modalActiveTab === 'rupturas'
                      ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-rose-500" />
                  <span>Rupturas Iminentes ({selectedAuditForModal.ruptureList?.length ?? 0})</span>
                </button>
              )}
            </div>

            {/* Feedback de Bipagem Pós-Auditoria */}
            {modalFeedback && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                <span>{modalFeedback}</span>
                <button
                  type="button"
                  onClick={() => setModalFeedback(null)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Conteúdo das 3 Abas */}
            <div className="space-y-3 overflow-y-auto flex-1 text-xs">
              
              {/* ABA 1: ITENS BIPADOS */}
              {modalActiveTab === 'bipados' && (
                <div className="space-y-2">
                  {!selectedAuditForModal.confirmedList || selectedAuditForModal.confirmedList.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      Nenhum item foi bipado nesta auditoria.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      {selectedAuditForModal.confirmedList.map((item, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>{item.name}</span>
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono flex-wrap">
                              <span>EAN: {item.ean}</span>
                              {item.reducedCode && <span>• Reduzido: {item.reducedCode}</span>}
                              {item.supplierCode && <span>• Forn: {item.supplierCode}</span>}
                              {selectedAuditForModal.type === 'INVENTARIO' && typeof item.physicalQuantity === 'number' && (
                                <span className="text-amber-600 font-black">• Qtd. Física: {item.physicalQuantity} un</span>
                              )}
                              {selectedAuditForModal.type === 'INVENTARIO' && isManagerUser && typeof item.systemQuantity === 'number' && (
                                <span className="text-slate-600 font-bold">
                                  • Sistema: {item.systemQuantity} un (Div: {(item.physicalQuantity ?? 0) - item.systemQuantity})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 block">
                              Bipado às {item.scannedAt}
                            </span>
                            {item.scannedBy && (
                              <span className="text-[9px] text-slate-400 mt-0.5 block">
                                por {item.scannedBy}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: ITENS NÃO BIPADOS (COM BOTÃO DE BIPAGEM PÓS-AUDITORIA) */}
              {modalActiveTab === 'nao_bipados' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2">
                    <span>
                      Estes itens não foram encontrados na área durante a contagem. Procure-os nas gôndolas e use o botão <strong>Bipar</strong> para transferi-los para os bipados.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        openScanner((scannedEan) => {
                          handleBipMissingItem(scannedEan);
                        }, { cameraOnly: selectedAuditForModal.status === 'Concluída' });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shadow-xs flex items-center gap-1 shrink-0 cursor-pointer hover:bg-amber-400 transition"
                      title="Abrir câmera para procurar e bipar itens não encontrados"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Bipar Câmera</span>
                    </button>
                  </div>

                  {!selectedAuditForModal.pendingList || selectedAuditForModal.pendingList.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                      <p className="font-bold text-emerald-800 dark:text-emerald-300">
                        Todos os itens da lista foram localizados e bipados!
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Não restam itens pendentes nesta auditoria.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedAuditForModal.pendingList.map((item, idx) => (
                        <div 
                          key={idx}
                          className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{item.name}</span>
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                              <span>EAN: {item.ean}</span>
                              {item.reducedCode && <span>• Reduzido: {item.reducedCode}</span>}
                              {item.supplierCode && <span>• Forn: {item.supplierCode}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              Não Localizado
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                openScanner((scannedEan) => {
                                  handleBipMissingItem(scannedEan, item.ean);
                                }, { cameraOnly: true });
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                              title="Abrir câmera para confirmar exclusivamente via código de barras"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Ler Câmera</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: RUPTURAS IMINENTES DO SETOR AUDITADO */}
              {modalActiveTab === 'rupturas' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2">
                    <Tag className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>
                      Itens do setor <strong>{selectedAuditForModal.department || 'auditado'}</strong> com estoque crítico ou zerado (risco iminente de desabastecimento na gôndola).
                    </span>
                  </div>

                  {!selectedAuditForModal.ruptureList || selectedAuditForModal.ruptureList.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                      Nenhum item em ruptura iminente registrado para este setor.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedAuditForModal.ruptureList.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                              <span>{item.name}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              EAN: {item.ean}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 block">
                              Saldo: {item.stock} un (Mín: {item.minStock} un)
                            </span>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-rose-500 text-white mt-0.5 inline-block">
                              Ruptura Iminente
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportAuditPDF(selectedAuditForModal)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Exportar PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAuditForModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Fechar Relatório
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
