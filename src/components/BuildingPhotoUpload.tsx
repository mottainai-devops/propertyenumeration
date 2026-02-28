import { useState, useRef } from 'react';
import { buildingApi } from '../api/client';
import type { Building } from '../api/client';

interface BuildingPhotoUploadProps {
  building: Building;
  onUpdated: (updated: Building) => void;
  onClose: () => void;
}

const MAX_PHOTOS = 4;
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Compress an image File to a JPEG Blob at reduced quality */
async function compressImage(file: File, maxDimension = 1280, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function BuildingPhotoUpload({ building, onUpdated, onClose }: BuildingPhotoUploadProps) {
  const existingCount = building.photos.length;
  const slotsAvailable = MAX_PHOTOS - existingCount;

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setError('');
    const allowed = files.slice(0, slotsAvailable - selectedFiles.length);
    if (files.length > allowed.length) {
      setError(`You can only add ${slotsAvailable} more photo${slotsAvailable !== 1 ? 's' : ''} (max ${MAX_PHOTOS} per building).`);
    }

    const oversized = allowed.filter(f => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length) {
      setError(`${oversized.length} file(s) exceed ${MAX_FILE_SIZE_MB} MB and will be compressed.`);
    }

    setProgress('Preparing photos…');
    const compressed = await Promise.all(allowed.map(f => compressImage(f)));
    setProgress('');

    const newPreviews = compressed.map(f => URL.createObjectURL(f));
    setSelectedFiles(prev => [...prev, ...compressed]);
    setPreviews(prev => [...prev, ...newPreviews]);

    // Reset input so the same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeSelected = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) return;
    setUploading(true);
    setError('');
    setProgress(`Uploading ${selectedFiles.length} photo${selectedFiles.length !== 1 ? 's' : ''}…`);
    try {
      const updated = await buildingApi.addPhotos(building._id, selectedFiles);
      previews.forEach(p => URL.revokeObjectURL(p));
      onUpdated(updated);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Upload failed. Please try again.';
      setError(msg);
    } finally {
      setUploading(false);
      setProgress('');
    }
  };

  const totalAfterUpload = existingCount + selectedFiles.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end">
      <div className="bg-white rounded-t-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add Photos</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {existingCount} existing · {slotsAvailable} slot{slotsAvailable !== 1 ? 's' : ''} remaining
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-blue-700">{progress}</p>
            </div>
          )}

          {/* Existing photos */}
          {existingCount > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Existing Photos ({existingCount})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {building.photos.map((url, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New photos to upload */}
          {selectedFiles.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                New Photos ({selectedFiles.length})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img src={src} alt={`New photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeSelected(i)}
                      disabled={uploading}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow disabled:opacity-50"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add more button */}
          {totalAfterUpload < MAX_PHOTOS && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-500 hover:border-blue-400 hover:text-blue-500 transition disabled:opacity-50"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium">
                Tap to add photo{slotsAvailable - selectedFiles.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs">
                {slotsAvailable - selectedFiles.length} slot{slotsAvailable - selectedFiles.length !== 1 ? 's' : ''} remaining · max {MAX_FILE_SIZE_MB} MB each
              </span>
            </button>
          )}

          {totalAfterUpload >= MAX_PHOTOS && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 text-center">
              Maximum of {MAX_PHOTOS} photos reached for this building.
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 bg-white border-2 border-gray-300 text-gray-700 font-semibold py-3.5 rounded-xl transition hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload {selectedFiles.length} Photo{selectedFiles.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
