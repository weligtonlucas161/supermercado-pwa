import React, { useState, useEffect, useRef } from 'react';
import { Barcode, Camera, X, Check, Search, AlertCircle, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { triggerScanBeep } from '../../utils/haptics';

export const BarcodeModal: React.FC = () => {
  const { isScannerOpen, closeScanner, scannerCallback, products, setActiveTab } = useApp();
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<(typeof products)[0] | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Reset states when opening
  useEffect(() => {
    if (isScannerOpen) {
      setManualCode('');
      setMatchedProduct(null);
      setCameraError(null);
    } else {
      stopCamera();
    }
  }, [isScannerOpen]);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.warn('Camera error:', err);
      setCameraError('Câmera indisponível ou permissão negada. Use a simulação rápida abaixo.');
      setCameraActive(false);
    }
  };

  // Lookup as user types or picks
  useEffect(() => {
    if (manualCode.trim().length >= 4) {
      const found = products.find(
        p => p.ean.includes(manualCode.trim()) || p.name.toLowerCase().includes(manualCode.toLowerCase())
      );
      setMatchedProduct(found || null);
    } else {
      setMatchedProduct(null);
    }
  }, [manualCode, products]);

  const handleConfirmScan = (barcode: string) => {
    triggerScanBeep(true);
    if (scannerCallback) {
      scannerCallback(barcode);
    } else {
      // Default: navigate to inventory and search
      setActiveTab('estoque');
    }
    closeScanner();
  };

  if (!isScannerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">Leitor de Código de Barras</h3>
              <p className="text-[11px] text-slate-400">Scanner óptico e consulta EAN-13</p>
            </div>
          </div>
          <button
            onClick={closeScanner}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner Viewport / Camera Simulator */}
        <div className="relative bg-slate-950 min-h-[200px] flex items-center justify-center overflow-hidden">
          {cameraActive ? (
            <video ref={videoRef} className="w-full h-48 object-cover" autoPlay playsInline muted />
          ) : (
            <div className="py-6 text-center px-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                <Camera className="w-7 h-7" />
              </div>
              <p className="text-xs text-slate-300 font-medium">Mira Laser Pronta</p>
              <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                Aponte para o código EAN impresso na gôndola ou na embalagem.
              </p>
              <button
                onClick={startCamera}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
              >
                <Camera className="w-3.5 h-3.5" /> Ativar Câmera do Dispositivo
              </button>
            </div>
          )}

          {/* Laser Animated Line Overlay */}
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-[0_0_12px_#ef4444] animate-pulse"></div>
          
          {/* Target Corners */}
          <div className="absolute inset-6 pointer-events-none border-2 border-emerald-400/40 rounded-xl"></div>
        </div>

        {cameraError && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Input & Quick Simulation */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Direct Input */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              DIGITAÇÃO MANUAL DE EAN / CÓDIGO
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ex: 7891000100011 ou Leite"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={() => manualCode && handleConfirmScan(manualCode)}
                disabled={!manualCode}
                className="px-4 py-2 rounded-xl bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 transition"
              >
                Confirmar
              </button>
            </div>
          </div>

          {/* Matched Preview */}
          {matchedProduct && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                  Produto Identificado
                </span>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">{matchedProduct.name}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Estoque: {matchedProduct.stock} un • {matchedProduct.location}
                </p>
              </div>
              <button
                onClick={() => handleConfirmScan(matchedProduct.ean)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 transition flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Selecionar
              </button>
            </div>
          )}

          {/* Simulated Scanner Buttons (Fast testing in preview) */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>TESTE RÁPIDO DO LEITOR (PRODUTOS CADASTRADOS)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {products.slice(0, 4).map(product => (
                <button
                  key={product.id}
                  onClick={() => handleConfirmScan(product.ean)}
                  className="p-2.5 rounded-xl text-left border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:border-emerald-500 dark:hover:border-emerald-500 transition group"
                >
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                    {product.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">EAN: {product.ean.slice(-6)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
