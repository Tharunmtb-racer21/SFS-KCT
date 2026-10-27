/**
 * imageUtils.ts
 * Client-side avatar resizing, center-cropping, compression, and strict upload validation.
 */

export interface ProcessedPhotoResult {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  size: number;
}

export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_BYTES = 500 * 1024; // 500 KB

export const ALLOWED_DOC_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
];
export const MAX_DOC_BYTES = 2 * 1024 * 1024; // 2 MB

const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.vbs', '.js', '.jsx', '.ts', '.tsx',
  '.php', '.py', '.rb', '.jar', '.msi', '.bin', '.com', '.scr', '.pif', '.hta'
];

/**
 * Validates a profile photo before processing.
 */
export function validatePhotoFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  // Check dangerous extensions
  const lowerName = file.name.toLowerCase();
  for (const ext of DANGEROUS_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      return { valid: false, error: 'Executable and script files are strictly prohibited.' };
    }
  }

  // Check MIME type
  const isAllowedType = ALLOWED_PHOTO_TYPES.includes(file.type.toLowerCase()) ||
    /\.(jpg|jpeg|png|webp)$/i.test(lowerName);

  if (!isAllowedType) {
    return {
      valid: false,
      error: 'Invalid file format. Please upload JPG, JPEG, PNG, or WebP only.'
    };
  }

  return { valid: true };
}

/**
 * Validates document and attachment files (certificates, proofs, daily/weekly attachments).
 */
export function validateAttachmentFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  const lowerName = file.name.toLowerCase();
  for (const ext of DANGEROUS_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      return { valid: false, error: 'Executable and script files are strictly prohibited.' };
    }
  }

  const isAllowedType = ALLOWED_DOC_TYPES.includes(file.type.toLowerCase()) ||
    /\.(jpg|jpeg|png|webp|pdf)$/i.test(lowerName);

  if (!isAllowedType) {
    return {
      valid: false,
      error: 'Invalid file format. Allowed formats: JPG, PNG, WebP, and PDF only.'
    };
  }

  if (file.size > MAX_DOC_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeInMB} MB) exceeds the 2 MB maximum limit.`
    };
  }

  return { valid: true };
}

/**
 * Resizes and center-crops an avatar to ~400x400 and compresses it under 500 KB.
 */
export async function resizeAndCompressAvatar(
  file: File,
  targetDimension = 400,
  maxBytes = MAX_PHOTO_BYTES
): Promise<ProcessedPhotoResult> {
  const validation = validatePhotoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid photo file.');
  }

  // Load the image into an HTMLImageElement
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  // Compute square center crop
  const minDim = Math.min(img.width, img.height);
  const cropX = Math.floor((img.width - minDim) / 2);
  const cropY = Math.floor((img.height - minDim) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = targetDimension;
  canvas.height = targetDimension;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not initialize canvas context for image processing.');
  }

  // Draw with smoothing for high quality avatar
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, cropX, cropY, minDim, minDim, 0, 0, targetDimension, targetDimension);

  // Try WebP first, fallback to JPEG if browser doesn't support WebP export
  let mimeType = 'image/webp';
  let quality = 0.85;

  let blob = await canvasToBlob(canvas, mimeType, quality);
  if (!blob || blob.type !== 'image/webp') {
    mimeType = 'image/jpeg';
    blob = await canvasToBlob(canvas, mimeType, quality);
  }

  // Iteratively reduce quality if still over maxBytes limit
  while (blob && blob.size > maxBytes && quality > 0.4) {
    quality -= 0.15;
    blob = await canvasToBlob(canvas, mimeType, quality);
  }

  if (!blob) {
    throw new Error('Image compression failed during processing.');
  }

  if (blob.size > maxBytes) {
    throw new Error(
      `Optimized image (${Math.round(blob.size / 1024)} KB) still exceeds the 500 KB limit. Please choose a simpler photo.`
    );
  }

  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const compressedFile = new File([blob], `avatar-${Date.now()}.${ext}`, {
    type: mimeType,
    lastModified: Date.now()
  });

  const finalPreview = URL.createObjectURL(blob);

  return {
    file: compressedFile,
    dataUrl: finalPreview,
    width: targetDimension,
    height: targetDimension,
    size: blob.size
  };
}

// Helpers
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for processing.'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}
