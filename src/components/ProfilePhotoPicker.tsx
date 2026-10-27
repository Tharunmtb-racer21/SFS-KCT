import React, { useState, useRef } from 'react';
import { Camera, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { resizeAndCompressAvatar, validatePhotoFile, MAX_PHOTO_BYTES } from '../utils/imageUtils';

interface ProfilePhotoPickerProps {
  currentPhotoUrl?: string;
  fallbackInitials?: string;
  onPhotoSelected: (processedFile: File | null, previewUrl: string | null) => void;
  onError?: (errorMessage: string) => void;
  label?: string;
  className?: string;
}

export const ProfilePhotoPicker: React.FC<ProfilePhotoPickerProps> = ({
  currentPhotoUrl,
  fallbackInitials = 'U',
  onPhotoSelected,
  onError,
  label = 'Profile Photo',
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [optimizedInfo, setOptimizedInfo] = useState<{ sizeKB: number } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingError(null);

    // 1. Initial Validation
    const validation = validatePhotoFile(file);
    if (!validation.valid) {
      const err = validation.error || 'Invalid photo format.';
      setProcessingError(err);
      if (onError) onError(err);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Client-side Resize, Center Crop, and Compression
    setIsProcessing(true);
    try {
      const result = await resizeAndCompressAvatar(file, 400, MAX_PHOTO_BYTES);
      setPreviewUrl(result.dataUrl);
      setOptimizedInfo({ sizeKB: Math.round(result.size / 1024) });
      onPhotoSelected(result.file, result.dataUrl);
    } catch (err: any) {
      const msg = err.message || 'Failed to process photo.';
      setProcessingError(msg);
      if (onError) onError(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    setOptimizedInfo(null);
    setProcessingError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onPhotoSelected(null, null);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-700">{label}</label>
          <span className="text-[10px] text-slate-400 font-medium">Max 500 KB • JPG, PNG, WebP</span>
        </div>
      )}

      <div className="flex items-center gap-4 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
        {/* Avatar Preview Box */}
        <div className="relative w-20 h-20 shrink-0">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Profile Preview"
              className="w-20 h-20 rounded-full object-cover border-2 border-teal-500/40 shadow-xs"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-navy-900 text-teal-400 font-bold text-xl flex items-center justify-center border-2 border-slate-200 shadow-xs">
              {fallbackInitials.slice(0, 2).toUpperCase()}
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-slate-900/60 rounded-full flex flex-col items-center justify-center text-white text-[10px]">
              <Loader2 className="w-5 h-5 animate-spin text-teal-400 mb-0.5" />
              <span>400×400</span>
            </div>
          )}
        </div>

        {/* Action Controls & Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-teal-600" />
              {previewUrl ? 'Change Photo' : 'Upload Photo'}
            </button>

            {previewUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isProcessing}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 flex items-center gap-1 transition-colors cursor-pointer"
                title="Remove photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Micro Helper & Validation status */}
          <div className="mt-1.5">
            {processingError ? (
              <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {processingError}
              </p>
            ) : optimizedInfo ? (
              <p className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                Optimized to 400×400 ({optimizedInfo.sizeKB} KB)
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                Square center-crop & compression applied automatically.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
