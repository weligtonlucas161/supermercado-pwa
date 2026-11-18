import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MultiFormatReader, 
  BarcodeFormat, 
  DecodeHintType, 
  RGBLuminanceSource, 
  HybridBinarizer, 
  BinaryBitmap,
  NotFoundException,
  ChecksumException,
  FormatException
} from '@zxing/library';
import { triggerScanBeep } from '../utils/haptics';

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

// Extensão de tipos para BarcodeDetector nativo (Google Play Services / W3C Community)
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
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // Controles de Zoom e Foco para Leitura de Precisão
  const [zoom, setZoomState] = useState<number>(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number; max: number; step: number; supported: boolean }>({
    min: 1,
    max: 3,
    step: 0.1,
    supported: false,
  });
  const [focusMode, setFocusModeState] = useState<string>('continuous');
  const [focusCapabilities, setFocusCapabilities] = useState<string[]>([]);
  const zoomRef = useRef<number>(1);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const nativeDetectorRef = useRef<NativeBarcodeDetector | null>(null);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);
  const scanLockRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationIndexRef = useRef<number>(0);

  // 1. Inicializar Leitores: Google BarcodeDetector API + ZXing com tryHarder: true
  useEffect(() => {
    // 1.1 Tentativa de Leitor Nativo (Google Play Services / Chromium)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window && window.BarcodeDetector) {
      try {
        nativeDetectorRef.current = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'itf'],
        });
      } catch (e) {
        console.warn('Native BarcodeDetector indisponível:', e);
      }
    }

    // 1.2 Leitor Avançado ZXing com Captura Agressiva (tryHarder: true)
    try {
      const hints = new Map<DecodeHintType, unknown>();
      const formats: BarcodeFormat[] = [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
        BarcodeFormat.CODE_39,
      ];
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
      // Forçar algoritmo em modo avançado para ler códigos borrados, tortos ou distantes
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new MultiFormatReader();
      reader.setHints(hints);
      zxingReaderRef.current = reader;
      setIsSupported(true);
    } catch (e) {
      console.warn('Erro ao inicializar motor ZXing:', e);
    }

    // Canvas reutilizável em memória para filtros e rotação
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      canvasRef.current = canvas;
    }

    return () => {
      if (zxingReaderRef.current) {
        try {
          zxingReaderRef.current.reset();
        } catch {
          // ignore
        }
        zxingReaderRef.current = null;
      }
      canvasRef.current = null;
    };
  }, []);

  // 2. Desligamento do Hardware e Limpeza Completa da Memória
  const stopScanning = useCallback(() => {
    // Cancela o loop de animação
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    // Desliga fisicamente os trilhos de vídeo da câmera para economizar bateria
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

    // Desconecta o stream do elemento de vídeo
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {
        // ignore
      }
    }

    // Reseta o leitor na memória
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch {
        // ignore
      }
    }

    scanLockRef.current = false;
    isProcessingRef.current = false;
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

  // 3.1 Controles de Zoom de Precisão (Hardware + Digital Óptico)
  const setZoom = useCallback(async (newZoom: number) => {
    setZoomState(newZoom);
    zoomRef.current = newZoom;
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({
          advanced: [{ zoom: newZoom } as unknown as MediaTrackConstraintSet],
        });
      } catch (e) {
        console.warn('Hardware zoom não suportado, aplicando recorte digital óptico:', e);
      }
    }
  }, []);

  // 3.2 Controles de Modo de Foco (Priorizar Leitura Contínua / Macro)
  const setFocusMode = useCallback(async (mode: string) => {
    setFocusModeState(mode);
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: mode } as unknown as MediaTrackConstraintSet],
        });
      } catch (e) {
        console.warn('Alteração de modo de foco não aceita pelo hardware:', e);
      }
    }
  }, []);

  // 3.3 Tap-to-focus / Re-foco instantâneo
  const triggerAutoFocus = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
        });
      } catch {
        // ignore
      }
    }
  }, []);

  // 4. Validação Rigorosa: Trava de Leitura por Tamanho Mínimo
  // Descarta leituras cortadas, incompletas ou adivinhações parciais do leitor
  const processAndValidateCode = useCallback((rawCode: string, format = 'EAN-13') => {
    const cleanCode = rawCode.replace(/[^0-9A-Za-z]/g, '').trim();

    // Regra: Bloquear leituras incompletas.
    // Produtos comerciais padrão (EAN-13) exigem 13 dígitos.
    // Exceções aceitas: EAN-8 (8 dígitos), UPC-A (12 dígitos), ITF-14 (14 dígitos), Boletos (44 dígitos).
    const isExactValidLength = 
      cleanCode.length === 13 || 
      cleanCode.length === 8 || 
      cleanCode.length === 12 || 
      cleanCode.length === 14 || 
      cleanCode.length === 44;

    if (!isExactValidLength || cleanCode.length < 8) {
      // Ignora silenciosamente e continua a amostragem contínua
      return false;
    }

    if (scanLockRef.current) return false;
    scanLockRef.current = true;
    setLastScannedCode(cleanCode);
    triggerScanBeep(true);

    if (onDetected) {
      onDetected(cleanCode, format);
    }

    // Libera a trava após 1.5s para evitar leituras repetidas em loop
    setTimeout(() => {
      scanLockRef.current = false;
    }, 1500);

    return true;
  }, [onDetected]);

  const isProcessingRef = useRef<boolean>(false);
  const lastScanTimeRef = useRef<number>(0);

  // 5. Motor de Decodificação Otimizado via ZXing (HybridBinarizer com amostragem inteligente)
  const decodeWithFiltersAndRotation = useCallback((video: HTMLVideoElement): boolean => {
    const reader = zxingReaderRef.current;
    if (!reader) return false;

    const canvas = canvasRef.current || document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    // Resolução otimizada para códigos de barra (384px) - rápida e leve para CPU
    const targetW = 384;
    const targetH = Math.round((targetW * video.videoHeight) / (video.videoWidth || 1)) || 288;

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    // Alterna rotação digital leve: 0° e 90° a cada amostragem
    const rotations = [0, 90];
    const currentAngle = rotations[rotationIndexRef.current % rotations.length];
    rotationIndexRef.current = (rotationIndexRef.current + 1) % rotations.length;

    // Aplicar zoom digital óptico no frame decodificado
    const currentZoom = Math.max(1, zoomRef.current || 1);
    const vw = video.videoWidth || targetW;
    const vh = video.videoHeight || targetH;
    const cropW = vw / currentZoom;
    const cropH = vh / currentZoom;
    const cropX = (vw - cropW) / 2;
    const cropY = (vh - cropH) / 2;

    ctx.save();
    try {
      if (currentAngle !== 0) {
        ctx.translate(targetW / 2, targetH / 2);
        ctx.rotate((currentAngle * Math.PI) / 180);
        ctx.drawImage(video, cropX, cropY, cropW, cropH, -targetW / 2, -targetH / 2, targetW, targetH);
      } else {
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
      }
    } finally {
      ctx.restore();
    }

    try {
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const luminanceSource = new RGBLuminanceSource(imgData.data, targetW, targetH);
      const binarizer = new HybridBinarizer(luminanceSource);
      const bitmap = new BinaryBitmap(binarizer);
      const result = reader.decode(bitmap);

      if (result && result.getText()) {
        const fmtName = result.getBarcodeFormat ? String(result.getBarcodeFormat()) : 'EAN-13';
        return processAndValidateCode(result.getText(), fmtName);
      }
    } catch (e: unknown) {
      // Ignora silenciosamente NotFoundException, ChecksumException, FormatException normais em frames sem código
      if (!(e instanceof NotFoundException) && !(e instanceof ChecksumException) && !(e instanceof FormatException)) {
        // descarte seguro
      }
    }

    return false;
  }, [processAndValidateCode]);

  // 6. Laço de Amostragem Contínua de Alta Performance (com FPS Throttling e Single-Flight)
  const scanFrame = useCallback(async () => {
    if (!isScanning) return;

    const now = performance.now();
    const elapsed = now - lastScanTimeRef.current;
    const SCAN_INTERVAL_MS = 120; // ~8 amostragens por segundo (fluido, instantâneo e com CPU < 5%)

    if (scanLockRef.current || isProcessingRef.current || elapsed < SCAN_INTERVAL_MS) {
      if (isScanning) {
        animationFrameId.current = requestAnimationFrame(scanFrame);
      }
      return;
    }

    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      if (isScanning) {
        animationFrameId.current = requestAnimationFrame(scanFrame);
      }
      return;
    }

    isProcessingRef.current = true;
    lastScanTimeRef.current = now;

    try {
      let detectedInThisFrame = false;

      // 6.1 Primeiro tenta Leitor Nativo (Google Service / GPU / C++ assíncrono)
      if (nativeDetectorRef.current) {
        try {
          const barcodes = await nativeDetectorRef.current.detect(video);
          if (barcodes && barcodes.length > 0) {
            const first = barcodes[0];
            if (first?.rawValue) {
              detectedInThisFrame = processAndValidateCode(first.rawValue, first.format);
            }
          }
        } catch {
          // Frame skip normal em movimento
        }
      }

      // 6.2 Se o nativo não encontrou, executa ZXing Otimizado
      if (!detectedInThisFrame && !scanLockRef.current) {
        try {
          decodeWithFiltersAndRotation(video);
        } catch {
          // Descarte silencioso de erro de frame
        }
      }
    } finally {
      isProcessingRef.current = false;
      if (isScanning) {
        animationFrameId.current = requestAnimationFrame(scanFrame);
      }
    }
  }, [isScanning, processAndValidateCode, decodeWithFiltersAndRotation]);

  // 7. Iniciar Câmera e Scanner com Resolução Apropriada
  const startScanning = useCallback(
    async (videoElement: HTMLVideoElement) => {
      setCameraError(null);
      scanLockRef.current = false;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Acesso à câmera não é suportado pelo seu navegador.');
        return;
      }

      try {
        // Solicita câmera traseira (environment) em resolução Full HD para leitura veloz em gôndolas
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false,
        });

        streamRef.current = stream;
        videoRef.current = videoElement;
        videoElement.srcObject = stream;
        videoElement.setAttribute('playsinline', 'true');
        videoElement.muted = true;
        await videoElement.play();

        // Verificar suporte a lanterna física, zoom e foco por hardware
        const track = stream.getVideoTracks()[0];
        if (track && 'getCapabilities' in track) {
          try {
            const capabilities = (track as unknown as { 
              getCapabilities: () => { 
                torch?: boolean;
                zoom?: { min: number; max: number; step: number };
                focusMode?: string[];
              } 
            }).getCapabilities();

            if (capabilities && capabilities.torch) {
              setTorchAvailable(true);
            }
            if (capabilities && capabilities.zoom) {
              setZoomCapabilities({
                min: capabilities.zoom.min ?? 1,
                max: capabilities.zoom.max ?? 4,
                step: capabilities.zoom.step ?? 0.1,
                supported: true,
              });
            }
            if (capabilities && capabilities.focusMode) {
              setFocusCapabilities(capabilities.focusMode);
              // Tentar forçar modo contínuo por padrão para melhor leitura
              if (capabilities.focusMode.includes('continuous')) {
                track.applyConstraints({
                  advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
                }).catch(() => {});
              }
            }
          } catch (e) {
            console.warn('Erro ao ler capacidades da câmera:', e);
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
          setCameraError('Câmera indisponível no momento. Use o leitor manual ou produtos pré-carregados.');
        }
      }
    },
    []
  );

  // Efeito do Laço de Animação
  useEffect(() => {
    if (isScanning) {
      animationFrameId.current = requestAnimationFrame(scanFrame);
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [isScanning, scanFrame]);

  // Efeito de Limpeza estrito ao Desmontar (Liberação Física do Hardware)
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
    zoom,
    setZoom,
    zoomCapabilities,
    focusMode,
    setFocusMode,
    focusCapabilities,
    triggerAutoFocus,
  };
}
