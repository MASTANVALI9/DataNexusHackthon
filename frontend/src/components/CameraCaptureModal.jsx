import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, AlertCircle, Image as ImageIcon, Loader2, Upload, FileText } from 'lucide-react';

export default function CameraCaptureModal({ isOpen, onClose, onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  const [capturedImage, setCapturedImage] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Perform OCR text extraction using Tesseract.js if available
  const processOcr = async (imageDataUrl) => {
    setIsScanningOcr(true);
    setExtractedText('');

    try {
      if (window.Tesseract && typeof window.Tesseract.recognize === 'function') {
        const result = await window.Tesseract.recognize(imageDataUrl, 'eng');
        const text = result?.data?.text?.trim() || '';
        setExtractedText(text);
      } else {
        console.warn('Tesseract OCR engine not available, relying on manual text entry.');
      }
    } catch (err) {
      console.error('OCR processing error:', err);
    } finally {
      setIsScanningOcr(false);
    }
  };

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    setIsInitializing(true);
    setCapturedImage(null);
    setExtractedText('');

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsInitializing(false);
    } catch (err) {
      setIsInitializing(false);
      console.error('[Camera] Permission or access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please grant camera permissions or upload an image file below.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No active camera device detected. You can select an image file to upload.');
      } else {
        setCameraError('Unable to access camera. You can select an image file below.');
      }
    }
  };

  // Stop Camera Tracks
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
      setExtractedText('');
      setCameraError(null);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Capture current frame from video to canvas
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);

    // Pause video & perform OCR
    stopCamera();
    processOcr(dataUrl);
  };

  // File Upload Handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl) {
        setCapturedImage(dataUrl);
        stopCamera();
        processOcr(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    setExtractedText('');
    startCamera();
  };

  // Confirm image selection
  const handleConfirm = () => {
    if (capturedImage && onCapture) {
      onCapture(capturedImage, extractedText);
      stopCamera();
      onClose();
    }
  };

  const handleCloseModal = () => {
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5 text-[#1E3A8A] font-extrabold text-base">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span>Camera & Image Input</span>
              <p className="text-[11px] text-slate-500 font-normal">Capture or upload news image for OCR verification</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close camera modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Error Alert */}
        {cameraError && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Camera Info</span>
            </div>
            <p className="leading-relaxed font-medium">{cameraError}</p>
          </div>
        )}

        {/* Live Camera Feed or Captured Image Preview */}
        <div className="relative aspect-video rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-300 shadow-inner">
          {isInitializing && !cameraError && (
            <div className="text-center space-y-2 text-white">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400" />
              <p className="text-xs font-mono">Initializing camera feed...</p>
            </div>
          )}

          {/* Live Video View */}
          {!capturedImage && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isInitializing ? 'hidden' : 'block'}`}
            />
          )}

          {/* Captured Image View */}
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured claim"
              className="w-full h-full object-contain"
            />
          )}

          {/* Scanning OCR Overlay */}
          {isScanningOcr && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
              <p className="text-xs font-semibold text-teal-300">Scanning text from image (OCR)...</p>
            </div>
          )}

          {/* Hidden Canvas for Frame Capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Extracted OCR Text Box Preview */}
        {extractedText && (
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              <span>Extracted Image Text (OCR Detected):</span>
            </div>
            <p className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-teal-100 italic line-clamp-3 font-medium">
              "{extractedText}"
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              title="Upload image file from device"
            >
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>Upload Image File</span>
            </button>
          </div>

          {!capturedImage ? (
            <button
              type="button"
              onClick={handleCapture}
              disabled={isInitializing}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl btn-primary font-bold text-xs disabled:opacity-50 cursor-pointer shadow-md"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Photo</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isScanningOcr}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-md disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Use Image</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
