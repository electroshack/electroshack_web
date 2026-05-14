import React, { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode";

const REGION_ID = "es-barcode-scanner-viewport";

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
];

const HINT = "Align the code inside the frame; hold steady and avoid glare.";

const NATIVE_FORMATS = ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_e", "upc_a", "itf"];

async function stopScannerSafely(instance) {
  if (!instance) return;
  const state = instance.getState();
  if (state !== Html5QrcodeScannerState.SCANNING && state !== Html5QrcodeScannerState.PAUSED) {
    try {
      instance.clear();
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await instance.stop();
  } catch {
    /* ignore */
  }
  try {
    instance.clear();
  } catch {
    /* ignore */
  }
}

function hasNativeDetector() {
  return typeof window !== "undefined" && typeof window.BarcodeDetector === "function";
}

export default function BarcodeScannerModal({ open, onClose, onDetected }) {
  const [manual, setManual] = useState("");
  const [err, setErr] = useState(null);
  const [scanning, setScanning] = useState(false);
  const handlerRef = useRef(onDetected);
  const scannerRef = useRef(null);
  const nativeCleanupRef = useRef(null);
  const stoppedRef = useRef(false);
  handlerRef.current = onDetected;

  const finish = useCallback(
    (code) => {
      const c = String(code || "").trim();
      if (!c) return;
      handlerRef.current(c);
      onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) {
      setManual("");
      setErr(null);
      return undefined;
    }

    stoppedRef.current = false;

    (async () => {
      setErr(null);
      setScanning(true);

      await new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60)));
      });

      const mount = document.getElementById(REGION_ID);
      if (mount) mount.innerHTML = "";

      const runWasm = async () => {
        const html5 = new Html5Qrcode(REGION_ID, { verbose: false });
        scannerRef.current = html5;
        const scanConfig = {
          fps: 12,
          formatsToSupport: BARCODE_FORMATS,
          // html5-qrcode requires each qrbox dimension ≥ 50px
          qrbox: (w, h) => {
            const rw = Math.max(50, Math.min(320, Math.floor(w * 0.88)));
            const rh = Math.max(50, Math.min(200, Math.floor(h * 0.42)));
            return { width: rw, height: rh };
          },
          aspectRatio: 1.78,
          disableFlip: false,
        };
        const onDecode = (decodedText) => {
          if (stoppedRef.current || !decodedText?.trim()) return;
          stoppedRef.current = true;
          const t = decodedText.trim();
          void stopScannerSafely(html5).finally(() => {
            scannerRef.current = null;
            setScanning(false);
            finish(t);
          });
        };
        const tryClear = () => {
          try {
            html5.clear();
          } catch {
            /* ignore */
          }
        };
        try {
          await html5.start({ facingMode: "environment" }, scanConfig, onDecode, () => {});
        } catch {
          tryClear();
          try {
            await html5.start({ facingMode: { ideal: "environment" } }, scanConfig, onDecode, () => {});
          } catch {
            tryClear();
            const cams = await Html5Qrcode.getCameras();
            if (cams?.length) {
              await html5.start(cams[cams.length - 1].id, scanConfig, onDecode, () => {});
            } else {
              throw new Error("No camera found.");
            }
          }
        }
      };

      if (hasNativeDetector() && mount) {
        try {
          const video = document.createElement("video");
          video.setAttribute("playsinline", "true");
          video.muted = true;
          video.className = "w-full h-full min-h-[40vh] sm:min-h-[260px] object-cover bg-black";
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS });
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
            audio: false,
          });
          video.srcObject = stream;
          mount.appendChild(video);
          await video.play();

          let timer;
          const loop = async () => {
            if (stoppedRef.current) return;
            if (!video.videoWidth) {
              timer = setTimeout(loop, 150);
              return;
            }
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            try {
              const codes = await detector.detect(canvas);
              const vals = [...new Set((codes || []).map((c) => String(c?.rawValue || "").trim()).filter(Boolean))];
              if (vals.length) {
                stoppedRef.current = true;
                stream.getTracks().forEach((t) => t.stop());
                video.remove();
                setScanning(false);
                finish(vals.join("\n"));
                return;
              }
            } catch {
              /* miss */
            }
            timer = setTimeout(loop, 140);
          };
          loop();

          nativeCleanupRef.current = () => {
            if (timer) clearTimeout(timer);
            stoppedRef.current = true;
            stream.getTracks().forEach((t) => t.stop());
            try {
              video.remove();
            } catch {
              /* ignore */
            }
          };
          return;
        } catch {
          if (mount) mount.innerHTML = "";
        }
      }

      try {
        await runWasm();
      } catch (e) {
        if (!stoppedRef.current) {
          setErr(
            e?.message?.includes("Permission") || e?.name === "NotAllowedError"
              ? "Camera blocked — allow camera for this site, then try again."
              : e?.message || "Camera unavailable. Type the code below."
          );
          setScanning(false);
        }
      }
    })();

    return () => {
      stoppedRef.current = true;
      if (nativeCleanupRef.current) {
        nativeCleanupRef.current();
        nativeCleanupRef.current = null;
      }
      const instance = scannerRef.current;
      scannerRef.current = null;
      void stopScannerSafely(instance);
    };
  }, [open, onClose, finish]);

  const submitManual = () => {
    const c = manual.trim();
    if (!c) return;
    stoppedRef.current = true;
    if (nativeCleanupRef.current) {
      nativeCleanupRef.current();
      nativeCleanupRef.current = null;
    }
    void stopScannerSafely(scannerRef.current);
    scannerRef.current = null;
    setScanning(false);
    finish(c);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/55" role="dialog" aria-modal="true">
      <div className="bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[94vh] overflow-hidden flex flex-col border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="font-semibold text-dark-900 text-sm sm:text-base">Scan</h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:text-dark-900 rounded-lg" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
          <p className="text-xs text-gray-600">{HINT}</p>
          <div className="relative w-full rounded-lg overflow-hidden bg-black border border-gray-800/30">
            <div id={REGION_ID} className="w-full min-h-[40vh] sm:min-h-[280px] relative" />
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 py-2 px-3 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-center text-[11px] text-white/90">{scanning ? "Ready to scan" : ""}</p>
            </div>
          </div>
          {err && <p className="text-xs text-amber-900 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">{err}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Or type code…"
              className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-dark-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onKeyDown={(e) => e.key === "Enter" && submitManual()}
            />
            <button type="button" onClick={submitManual} className="px-4 py-2.5 bg-dark-900 text-white text-sm font-medium rounded-lg hover:bg-dark-800 shrink-0">
              Use
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
