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
  Cpu
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { triggerScanBeep } from '../../utils/haptics';
import { useBarcodeDetector } from '../../hooks/useBarcodeDetector';

export const BarcodeModal: React.FC = () => {
  const { isScannerOpen, closeScanner, scannerCallback, products, setActiveTab } = useApp();
  const [manualCode, setManualCode] = useState('');
  const [matchedProduct, setMatchedProduct] = useState<(typeof products)[0] | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Hook nativo da Barcode Detector API (Google Play Services / Chromium)
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
  } = useBarcodeDetector((code, format) => {
    handleBarcodeRead(code, format);
  });

  const handleBarcodeRead = (code: string, format?: string) => {
    setManualCode(code);
    const found = products.find(p => p.ean.includes(code.trim()) || code.trim().includes(p.ean));
    setMatchedProduct(found || null);
    setScanNotice(`Código ${code} detectado (${format || 'EAN-13'})!`);
  };

  // Iniciar ou parar a câmera ao abrir/fechar modal
  useEffect(() => {
    if (isScannerOpen) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">Leitor de Código de Barras</h3>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                  isBarcodeDetectorSupported 
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                }`}>
                  <Cpu className="w-3 h-3" />
                  {isBarcodeDetectorSupported ? 'Google Barcode API' : 'Scanner Web'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Leitura contínua com mira laser e detecção óptica</p>
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

        {/* Viewport da Câmera com Barcode Detector API */}
        <div className="relative bg-slate-950 min-h-[220px] h-60 flex items-center justify-center overflow-hidden">
          {/* Elemento de Vídeo Real da Câmera */}
          <video
            ref={videoElementRef}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isScanning ? 'opacity-100' : 'opacity-0 absolute'
            }`}
            autoPlay
            playsInline
            muted
          />

          {/* Placeholder / Botão Iniciar se a câmera não tiver sido ativada */}
          {!isScanning && (
            <div className="text-center p-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-200 font-semibold">Câmera em Standby</p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-0.5 mb-3">
                Aponte para o código de barras impresso na embalagem ou gôndola.
              </p>
              <button
                onClick={() => videoElementRef.current && startScanning(videoElementRef.current)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition"
              >
                <Camera className="w-3.5 h-3.5" /> Ativar Leitor Óptico
              </button>
            </div>
          )}

          {/* Mira Laser & Retículo */}
          {isScanning && (
            <>
              {/* Moldura de Foco */}
              <div className="absolute inset-8 pointer-events-none border-2 border-emerald-400/60 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                {/* Cantos destacados */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-emerald-400"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-emerald-400"></div>
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-emerald-400"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-emerald-400"></div>
              </div>

              {/* Linha Laser Animada */}
              <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-[0_0_15px_#ef4444] animate-pulse"></div>

              {/* Controles Flutuantes da Câmera (Lanterna / Restart) */}
              <div className="absolute bottom-3 inset-x-4 flex justify-between items-center z-10">
                <span className="text-[10px] font-semibold bg-black/60 text-emerald-300 px-2.5 py-1 rounded-lg backdrop-blur-xs flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400 animate-pulse" /> Scanner Ativo
                </span>

                <div className="flex gap-2">
                  {torchAvailable && (
                    <button
                      onClick={toggleTorch}
                      className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1 backdrop-blur-xs shadow-md ${
                        torchOn ? 'bg-amber-500 text-white' : 'bg-black/60 text-slate-200 hover:bg-black/80'
                      }`}
                      title="Ligar/Desligar Lanterna"
                    >
                      <Flashlight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      stopScanning();
                      if (videoElementRef.current) startScanning(videoElementRef.current);
                    }}
                    className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-medium backdrop-blur-xs"
                    title="Reiniciar Câmera"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

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

        {/* Entrada Manual & Atalhos */}
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

          {/* Atalhos Rápidos (Para testes imediatos no navegador) */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>PRODUTOS CADASTRADOS (SIMULAÇÃO RÁPIDA)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {products.slice(0, 4).map(product => (
                <button
                  key={product.id}
                  onClick={() => {
                    handleBarcodeRead(product.ean);
                    handleConfirmSelection(product.ean);
                  }}
                  className="p-2.5 rounded-xl text-left border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:border-emerald-500 transition group"
                >
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                    {product.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">EAN: {product.ean}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
