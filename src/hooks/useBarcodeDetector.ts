import { useState, useEffect, useRef, useCallback } from 'react';
import { triggerScanBeep } from '../utils/haptics';

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

// Extensão de tipos para BarcodeDetector API (W3C Community Group / Google Play Services)
interface NativeBarcodeDetector {
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
  getSupportedFormats?(): Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): NativeBarcodeDetector;
      getSupportedFormats?(): Promise<string[]>;
    };
  }
}

export function useBarcodeDetector(onDetected?: (code: string, format: string) => void) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const detectorRef = useRef<NativeBarcodeDetector | null>(null);
  const scanLockRef = useRef<boolean>(false);

  // 1. Detectar suporte nativo à Barcode Detector API
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window && window.BarcodeDetector) {
      try {
        detectorRef.current = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a', 'upc_e'],
        });
        setIsSupported(true);
      } catch (e) {
        console.warn('BarcodeDetector instantiation failed:', e);
        setIsSupported(false);
      }
    } else {
      setIsSupported(false);
    }
  }, []);

  // 2. Parar câmera e limpar stream
  const stopScanning = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  // 3. Alternar Lanterna (Torch)
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as unknown as MediaTrackConstraintSet],
        });
        setTorchOn(nextState);
      } catch (e) {
        console.warn('Não foi possível ativar a lanterna:', e);
      }
    }
  }, [torchOn]);

  // 4. Loop contínuo de detecção de frames
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !isScanning) return;

    const video = videoRef.current;
    if (video.readyState >= 2 && video.videoWidth > 0 && !scanLockRef.current) {
      if (detectorRef.current) {
        detectorRef.current
          .detect(video)
          .then(barcodes => {
            if (barcodes && barcodes.length > 0) {
              const detected = barcodes[0];
              const code = detected.rawValue;
              if (code && code !== lastScannedCode) {
                scanLockRef.current = true;
                setLastScannedCode(code);
                triggerScanBeep(true);

                if (onDetected) {
                  onDetected(code, detected.format);
                }

                // Desbloqueia após 1.5s para evitar leituras repetidas em loop
                setTimeout(() => {
                  scanLockRef.current = false;
                }, 1500);
              }
            }
          })
          .catch(err => {
            // Frame skip normal durante movimento
            console.debug('Detector frame skip:', err);
          });
      }
    }

    if (isScanning) {
      animationFrameId.current = requestAnimationFrame(scanFrame);
    }
  }, [isScanning, lastScannedCode, onDetected]);

  // 5. Iniciar Câmera e Scanner
  const startScanning = useCallback(
    async (videoElement: HTMLVideoElement) => {
      setCameraError(null);
      scanLockRef.current = false;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Acesso à câmera não é suportado pelo seu navegador.');
        return;
      }

      try {
        // Solicita câmera traseira (environment) em alta resolução para leitura de EAN
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;
        videoRef.current = videoElement;
        videoElement.srcObject = stream;
        videoElement.setAttribute('playsinline', 'true');
        await videoElement.play();

        // Verificar suporte a lanterna
        const track = stream.getVideoTracks()[0];
        if (track && 'getCapabilities' in track) {
          const capabilities = (track as unknown as { getCapabilities: () => { torch?: boolean } }).getCapabilities();
          if (capabilities && capabilities.torch) {
            setTorchAvailable(true);
          }
        }

        setHasCameraPermission(true);
        setIsScanning(true);
      } catch (err: unknown) {
        console.warn('Erro ao acessar câmera:', err);
        setHasCameraPermission(false);
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setCameraError('Permissão para usar a câmera foi negada. Habilite a permissão nas configurações do navegador.');
        } else {
          setCameraError('Câmera indisponível no momento. Use o leitor manual ou atalhos abaixo.');
        }
      }
    },
    []
  );

  useEffect(() => {
    if (isScanning) {
      animationFrameId.current = requestAnimationFrame(scanFrame);
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isScanning, scanFrame]);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return {
    isSupported,
    isScanning,
    hasCameraPermission,
    cameraError,
    torchAvailable,
    torchOn,
    toggleTorch,
    startScanning,
    stopScanning,
    lastScannedCode,
  };
}
