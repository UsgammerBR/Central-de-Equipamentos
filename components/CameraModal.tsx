
import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { IconX, IconCamera, IconCameraLens } from './icons';

interface CameraModalProps {
  target: any;
  onClose: () => void;
  onCapture: (data: string, type: 'qr' | 'photo') => void;
}

export const CameraModal = ({ target, onClose, onCapture }: CameraModalProps) => {
  const [mode, setMode] = useState<'qr' | 'photo'>('qr');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (mode === 'qr') {
      startQrScanner();
    } else {
      stopQrScanner();
      startPhotoCamera();
    }
    return () => {
      stopQrScanner();
      stopPhotoCamera();
    };
  }, [mode]);

  const startQrScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      qrRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onCapture(decodedText, 'qr');
          onClose();
        },
        () => {} // ignore errors
      );
    } catch (err) {
      console.error("Error starting QR scanner:", err);
    }
  };

  const stopQrScanner = async () => {
    if (qrRef.current && qrRef.current.isScanning) {
      await qrRef.current.stop();
      qrRef.current = null;
    }
  };

  const startPhotoCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error("Error starting photo camera:", err);
    }
  };

  const stopPhotoCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        onCapture(dataUrl, 'photo');
        // If it's a profile photo, we close. If it's equipment, we might want to take more?
        // For now, let's close to keep it simple as per original flow
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col">
      <div className="flex justify-between items-center p-6">
        <div className="flex gap-4">
          <button 
            onClick={() => setMode('qr')}
            className={`px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${mode === 'qr' ? 'bg-cyan-600 text-white' : 'bg-white/10 text-white/50'}`}
          >
            QR Code
          </button>
          <button 
            onClick={() => setMode('photo')}
            className={`px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${mode === 'photo' ? 'bg-cyan-600 text-white' : 'bg-white/10 text-white/50'}`}
          >
            Foto
          </button>
        </div>
        <button onClick={onClose} className="p-3 bg-white/10 rounded-full text-white active:scale-95 transition-all">
          <IconX className="w-6 h-6"/>
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {mode === 'qr' ? (
          <div className="relative w-full max-w-sm aspect-square">
            <div id="qr-reader" className="w-full h-full border-2 border-cyan-500/30 rounded-3xl overflow-hidden"></div>
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)] animate-[scan_2s_linear_infinite]"></div>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                <div className="w-full h-full border-2 border-white/20 rounded-3xl"></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-10 flex justify-center">
        {mode === 'photo' && isCameraActive && (
          <button 
            onClick={takePhoto}
            className="w-20 h-20 rounded-full bg-white border-8 border-white/20 flex items-center justify-center active:scale-95 transition-all shadow-2xl"
          >
            <div className="w-12 h-12 rounded-full bg-cyan-600 flex items-center justify-center">
                <IconCamera className="w-6 h-6 text-white"/>
            </div>
          </button>
        )}
        {mode === 'qr' && (
           <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[4px] animate-pulse">
             Aponte para o QR Code
           </p>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
