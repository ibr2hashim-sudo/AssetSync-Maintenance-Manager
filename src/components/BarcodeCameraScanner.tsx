import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import { Camera, X, RefreshCw, Zap, ZapOff, CheckCircle2, AlertTriangle, Sparkles, Volume2, VolumeX } from 'lucide-react';

interface BarcodeCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedText: string) => void;
  title?: string;
  continuous?: boolean;
}

export const BarcodeCameraScanner: React.FC<BarcodeCameraScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'مسح كود الجهاز / الرقم التسلسلي بالكاميرا',
  continuous = false,
}) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'interactive-barcode-scanner-region';
  const lastScanTimeRef = useRef<number>(0);

  // Play subtle feedback beep
  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Audio context might be restricted before user gesture
    }

    if (navigator.vibrate) {
      try {
        navigator.vibrate(100);
      } catch {
        // ignore
      }
    }
  }, [soundEnabled]);

  // Clean and start scanning
  const startCamera = async (cameraId?: string) => {
    try {
      setError(null);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } else {
        scannerRef.current = new Html5Qrcode(scannerContainerId, {
          verbose: false,
        });
      }

      const config: Html5QrcodeCameraScanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.75);
          return {
            width: Math.max(200, Math.min(qrboxSize, 340)),
            height: Math.max(160, Math.min(Math.floor(qrboxSize * 0.7), 260)),
          };
        },
        aspectRatio: 1.0,
      };

      const cameraParam = cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' };

      await scannerRef.current.start(
        cameraParam,
        config,
        (decodedText) => {
          const now = Date.now();
          // 1.5s cooldown for continuous scans
          if (now - lastScanTimeRef.current < 1500 && lastScanned === decodedText) {
            return;
          }

          lastScanTimeRef.current = now;
          setLastScanned(decodedText);
          playBeep();

          onScan(decodedText);

          if (!continuous) {
            handleClose();
          }
        },
        () => {
          // Frame errors (silent)
        }
      );

      setIsScanning(true);

      // Check for torch capability
      try {
        const capabilities = scannerRef.current.getRunningTrackCapabilities();
        if ((capabilities as any)?.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      setError(
        err?.message ||
          'تعذر تشغيل الكاميرا. يرجى التأكد من منح الإذن لاستخدام الكاميرا والتأكد من عدم استخدامها من تطبيق آخر.'
      );
      setIsScanning(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      setIsScanning(false);
    }
  };

  const handleClose = async () => {
    await stopCamera();
    onClose();
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }] as any,
      });
      setTorchOn(nextState);
    } catch (err) {
      console.error('Torch toggle failed:', err);
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCam = cameras[nextIndex];
    setSelectedCameraId(nextCam.id);
    await stopCamera();
    await startCamera(nextCam.id);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let isMounted = true;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          const formatted = devices.map((d) => ({ id: d.id, label: d.label || `كاميرا ${d.id.substring(0, 5)}` }));
          setCameras(formatted);
          // Prefer back camera if available
          const backCam = formatted.find(
            (c) =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('rear') ||
              c.label.toLowerCase().includes('خلف') ||
              c.label.toLowerCase().includes('environment')
          );
          const initialId = backCam ? backCam.id : formatted[0].id;
          setSelectedCameraId(initialId);
          startCamera(initialId);
        } else {
          startCamera(); // Fallback to environment facingMode
        }
      })
      .catch((err) => {
        console.warn('getCameras error, fallback to facingMode:', err);
        if (isMounted) {
          startCamera();
        }
      });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    playBeep();
    onScan(manualInput.trim());
    setManualInput('');
    if (!continuous) {
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-800 space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">
                وجّه الكاميرا نحو باركود أو QR Code الخاص بالجهاز أو اكتبه يدوياً
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport Container */}
        <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-slate-700 min-h-[260px] flex items-center justify-center">
          <div id={scannerContainerId} className="w-full h-full" />

          {/* Laser Scanner Visual Overlay */}
          {isScanning && !error && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-64 h-44 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />

                {/* Animated Scan Line */}
                <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse absolute top-1/2 -translate-y-1/2" />
              </div>
              <span className="text-[11px] font-bold text-emerald-300 bg-slate-950/80 px-3 py-1 rounded-full mt-3 border border-emerald-500/30">
                جارِ قراءة الباركود / السيريال...
              </span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 text-center space-y-3 bg-red-950/90 border border-red-800 rounded-xl m-4 z-10">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-xs text-red-200 font-medium leading-relaxed">{error}</p>
              <button
                onClick={() => startCamera(selectedCameraId)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                إعادة المحاولة
              </button>
            </div>
          )}
        </div>

        {/* Camera Quick Controls */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors font-medium text-[11px]"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                تبديل الكاميرا ({cameras.length})
              </button>
            )}

            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors font-medium text-[11px] ${
                  torchOn
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {torchOn ? <ZapOff className="w-3.5 h-3.5 text-amber-400" /> : <Zap className="w-3.5 h-3.5 text-slate-400" />}
                {torchOn ? 'إيقاف الفلاش' : 'تشغيل الفلاش'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title={soundEnabled ? 'كتم صوت الصافرة' : 'تفعيل صوت الصافرة'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>

        {/* Last Scanned Feedback Banner */}
        {lastScanned && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>آخر كود تم مسحه: <strong className="font-mono text-white">{lastScanned}</strong></span>
            </div>
            <span className="text-[10px] text-emerald-400/80">تم الرصد بنجاح</span>
          </div>
        )}

        {/* Fallback: Quick Manual Input Inside Modal */}
        <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="أو اكتب الكود / السيريال يدوياً هنا..."
            className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!manualInput.trim()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors whitespace-nowrap"
          >
            إدخال ⏎
          </button>
        </form>
      </div>
    </div>
  );
};
