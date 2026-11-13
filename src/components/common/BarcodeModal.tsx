import React, { useState, useEffect, useRef } from 'react';
import { 
  Barcode, 
  Camera, 
  X, 
  Check, 
  Search, 
  AlertCircle, 
  Sparkles, 
  Flashlight, 
  RefreshCw, 
  Zap,
  Cpu,
  ZoomIn,
  Target,
  Sliders
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { triggerScanBeep } from '../../utils/haptics';
import { useBarcodeDetector } from '../../hooks/useBarcodeDetector';

export const BarcodeModal: React.FC = () => {
  const { isScannerOpen, closeScanner, scannerCallback, scannerCameraOnly, products, setActiveTab } = useApp();
  const [manualCode, setManualCode] = useState('');
  const [matchedProduct, setMatchedProduct] = useState<(typeof products)[0] | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [tapFocusPulse, setTapFocusPulse] = useState<{ x: number; y: number } | null>(null);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const cameraAutoConfirmedRef = useRef(false);

  // Hook nativo da Barcode Detector API (Google Play Services / Chromium) + ZXing tryHarder + Zoom & Focus
  const {
    isSupported: isBarcodeDetectorSupported,
    isScanning,
    cameraError,
    torchAvailable,
    torchOn,
    toggleTorch,
    startScanning,
    stopScanning,
    lastScannedCode,
    zoom,
    setZoom,
    zoomCapabilities,
    focusMode,
    setFocusMode,
    triggerAutoFocus,
  } = useBarcodeDetector((code, format) => {
    handleBarcodeRead(code, format);
  });

  const handleBarcodeRead = (code: string, format?: string) => {
    if (scannerCameraOnly) {
      if (cameraAutoConfirmedRef.current) return;
      cameraAutoConfirmedRef.current = true;
      handleConfirmSelection(code);
      return;
    }
    setManualCode(code);
    const found = products.find(p => p.ean.includes(code.trim()) || code.trim().includes(p.ean));
    setMatchedProduct(found || null);
    setScanNotice(`Código ${code} detectado (${format || 'EAN-13'})!`);
  };

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

  // Iniciar ou parar a câmera ao abrir/fechar modal
  useEffect(() => {
    if (isScannerOpen) {
      cameraAutoConfirmedRef.current = false;
      setManualCode('');
      setMatchedProduct(null);
      setScanNotice(null);

      // Auto-iniciar a câmera se o elemento de vídeo estiver montado
      const timer = setTimeout(() => {
        if (videoElementRef.current) {
          startScanning(videoElementRef.current);
        }
      }, 150);
      return () => clearTimeout(timer);
    } else {
      stopScanning();
    }
  }, [isScannerOpen, startScanning, stopScanning]);

  // Lookup as user types manually
  useEffect(() => {
    if (manualCode.trim().length >= 3) {
      const found = products.find(
        p => p.ean.includes(manualCode.trim()) || p.name.toLowerCase().includes(manualCode.toLowerCase())
      );
      setMatchedProduct(found || null);
    } else {
      setMatchedProduct(null);
    }
  }, [manualCode, products]);

  const handleConfirmSelection = (codeToConfirm: string) => {
    triggerScanBeep(true);
    stopScanning();
    if (scannerCallback) {
      scannerCallback(codeToConfirm);
    } else {
      setActiveTab('estoque');
    }
    closeScanner();
  };

  if (!isScannerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg sm:max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">Leitor de Código de Barras</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Cpu className="w-3 h-3" />
                  Full HD • Zoom {zoom.toFixed(1)}x
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Área ampliada com foco contínuo e zoom digital otimizado para estoque</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanning();
              closeScanner();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport da Câmera com Área Ampliada */}
        <div 
          onClick={handleCameraTapToFocus}
          className="relative bg-slate-950 min-h-[300px] h-72 sm:h-96 md:h-[400px] flex items-center justify-center overflow-hidden cursor-crosshair select-none"
          title="Toque na tela para refocar"
        >
          {/* Elemento de Vídeo Real da Câmera com Zoom Óptico/Digital */}
          <video
            ref={videoElementRef}
            className={`w-full h-full object-cover transition-all duration-150 ${
              isScanning ? 'opacity-100' : 'opacity-0 absolute'
            }`}
            style={{
              transform: zoom > 1 ? `scale(${zoom})` : undefined,
              transformOrigin: 'center center',
            }}
            autoPlay
            playsInline
            muted
          />

          {/* Animação de Tap-to-Focus */}
          {tapFocusPulse && (
            <div
              style={{ left: tapFocusPulse.x, top: tapFocusPulse.y }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
            >
              <span className="w-12 h-12 rounded-full border-2 border-emerald-400 block animate-ping opacity-80" />
              <span className="w-8 h-8 rounded-full border border-white absolute inset-0 m-auto" />
            </div>
          )}

          {/* Placeholder / Botão Iniciar se a câmera não tiver sido ativada */}
          {!isScanning && (
            <div className="text-center p-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                <Camera className="w-7 h-7" />
              </div>
              <p className="text-sm text-slate-200 font-semibold">Câmera em Standby</p>
              <p className="text-xs text-slate-400 max-w-xs mt-0.5 mb-3">
                Aponte para o código de barras impresso na embalagem ou gôndola.
              </p>
              <button
                onClick={() => videoElementRef.current && startScanning(videoElementRef.current)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" /> Ativar Leitor Óptico
              </button>
            </div>
          )}

          {/* Mira Laser & Retículo Expandido */}
          {isScanning && (
            <>
              {/* Moldura de Foco Ampliada */}
              <div className="absolute w-72 sm:w-96 h-36 sm:h-48 pointer-events-none border-2 border-emerald-400/70 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.35)] bg-emerald-500/5 backdrop-blur-[0.5px]">
                {/* Cantos destacados */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-emerald-300"></div>
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-emerald-300"></div>
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-emerald-300"></div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-emerald-300"></div>
              </div>

              {/* Linha Laser Animada */}
              <div className="absolute inset-x-12 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-[0_0_15px_#ef4444] animate-pulse"></div>

              {/* Dica de Toque Superior */}
              <div className="absolute top-3 inset-x-4 flex justify-between items-center z-10 pointer-events-none">
                <span className="text-[10px] font-semibold bg-black/70 text-emerald-300 px-2.5 py-1 rounded-lg backdrop-blur-md flex items-center gap-1 border border-white/10">
                  <Zap className="w-3 h-3 text-emerald-400 animate-pulse" /> Scanner Ativo • {zoom.toFixed(1)}x
                </span>
                <span className="text-[10px] bg-black/70 text-slate-300 px-2 py-0.5 rounded-md backdrop-blur-md border border-white/10">
                  👆 Toque para focar
                </span>
              </div>
            </>
          )}
        </div>

        {/* Barra de Controle de Zoom e Foco Rápido */}
        {isScanning && (
          <div className="p-2.5 bg-slate-900 border-b border-slate-800 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Atalhos Rápidos de Zoom */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                <ZoomIn className="w-3 h-3 text-emerald-400" /> Zoom:
              </span>
              {[1, 1.5, 2, 2.5, 3].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoom(lvl);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                    Math.abs(zoom - lvl) < 0.15
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {lvl}x
                </button>
              ))}
            </div>

            {/* Ações de Foco e Lanterna */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerAutoFocus();
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-[11px] font-medium flex items-center gap-1 border border-slate-700 cursor-pointer"
                title="Refocar câmera"
              >
                <Target className="w-3 h-3 text-emerald-400" />
                <span>Focar</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusMode(focusMode === 'macro' ? 'continuous' : 'macro');
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border cursor-pointer ${
                  focusMode === 'macro'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
                title="Alternar modo Macro (para códigos muito próximos)"
              >
                <Sliders className="w-3 h-3 text-amber-400" />
                <span>{focusMode === 'macro' ? 'Macro' : 'Auto'}</span>
              </button>

              {torchAvailable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTorch();
                  }}
                  className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                    torchOn ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                  title="Lanterna"
                >
                  <Flashlight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notificações / Erros da Câmera */}
        {cameraError && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}

        {scanNotice && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 font-medium animate-in fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{scanNotice}</span>
          </div>
        )}

        {/* Entrada Manual & Atalhos (oculta em modo exclusivo por câmera) */}
        {scannerCameraOnly ? (
          <div className="px-4 py-3 bg-emerald-500/10 border-t border-emerald-500/20 text-center text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
            Modo exclusivo de leitura: aponte a câmera para o código de barras para confirmar o item.
          </div>
        ) : (
        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* Matched Preview */}
          {matchedProduct ? (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                  Item Localizado
                </span>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">{matchedProduct.name}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Estoque: <strong>{matchedProduct.stock} un</strong> • {matchedProduct.location}
                </p>
              </div>
              <button
                onClick={() => handleConfirmSelection(matchedProduct.ean)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md flex items-center gap-1 transition"
              >
                <Check className="w-3.5 h-3.5" /> Selecionar
              </button>
            </div>
          ) : null}

          {/* Digitação Manual */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
              DIGITAÇÃO MANUAL DE CÓDIGO EAN-13
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ex: 7891000100011 ou nome do item"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
              <button
                onClick={() => manualCode && handleConfirmSelection(manualCode)}
                disabled={!manualCode}
                className="px-4 py-2 rounded-xl bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold shadow-xs hover:bg-emerald-700 transition"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
