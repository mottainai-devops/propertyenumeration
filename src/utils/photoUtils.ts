/**
 * Photo Utilities
 * Handles photo validation, compression, and size checking
 */

export interface PhotoValidationResult {
  valid: boolean;
  error?: string;
}

export interface PhotoCompressionOptions {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  quality: number;
}

/**
 * Validate photo file size
 * @param file - File to validate
 * @param maxSizeMB - Maximum size in megabytes (default: 5MB)
 * @returns Validation result
 */
export function validatePhotoSize(file: File, maxSizeMB: number = 5): PhotoValidationResult {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `Photo size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${maxSizeMB}MB`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate photo file type
 * @param file - File to validate
 * @returns Validation result
 */
export function validatePhotoType(file: File): PhotoValidationResult {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Only JPEG, PNG, and WebP images are allowed.`,
    };
  }
  
  return { valid: true };
}

/**
 * Compress photo file
 * @param file - File to compress
 * @param options - Compression options
 * @returns Compressed file
 */
export async function compressPhoto(
  file: File,
  options: PhotoCompressionOptions = {
    maxSizeMB: 5,
    maxWidthOrHeight: 1920,
    quality: 0.8,
  }
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Calculate new dimensions
        if (width > height) {
          if (width > options.maxWidthOrHeight) {
            height = (height * options.maxWidthOrHeight) / width;
            width = options.maxWidthOrHeight;
          }
        } else {
          if (height > options.maxWidthOrHeight) {
            width = (width * options.maxWidthOrHeight) / height;
            height = options.maxWidthOrHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            resolve(compressedFile);
          },
          'image/jpeg',
          options.quality
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Format file size for display
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate and prepare photo for upload
 * @param file - File to validate and prepare
 * @param options - Compression options
 * @returns Validated and compressed file, or error
 */
export async function validateAndPreparePhoto(
  file: File,
  options?: PhotoCompressionOptions
): Promise<{ file: File; error?: string }> {
  // Validate file type
  const typeValidation = validatePhotoType(file);
  if (!typeValidation.valid) {
    return { file, error: typeValidation.error };
  }
  
  // Validate file size
  const sizeValidation = validatePhotoSize(file, options?.maxSizeMB || 5);
  
  // If file is too large, try to compress it
  if (!sizeValidation.valid) {
    try {
      const compressedFile = await compressPhoto(file, options);
      
      // Validate compressed file size
      const compressedSizeValidation = validatePhotoSize(compressedFile, options?.maxSizeMB || 5);
      
      if (!compressedSizeValidation.valid) {
        return { file, error: 'Photo is too large even after compression. Please use a smaller photo.' };
      }
      
      return { file: compressedFile };
    } catch (error) {
      return { file, error: 'Failed to compress photo. Please try a different photo.' };
    }
  }
  
  return { file };
}
