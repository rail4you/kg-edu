import OSS from 'ali-oss';

export interface STSResponse {
  success: boolean;
  credentials: {
    accessKeyId: string;
    accessKeySecret: string;
    securityToken: string;
    expiration: string;
  };
  uploadConfig: {
    region: string;
    bucket: string;
    endpoint: string;
    uploadPath: string;
    fileName: string;
    fileSize?: number;
    fileType?: string;
  };
  error?: string;
  details?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadOptions {
  file: File;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Get STS token from server
 */
export async function getSTSToken(
  fileName: string,
  fileSize?: number,
  fileType?: string
): Promise<STSResponse> {
  try {
    const response = await fetch(`/api/sts-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        fileSize,
        fileType,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || data.details || 'Failed to get STS token');
    }

    return data;
  } catch (error) {
    console.error('Error getting STS token:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to get STS token');
  }
}

/**
 * Upload file directly to Aliyun OSS using STS token
 */
export async function uploadFileToOSS(
  stsResponse: STSResponse,
  options: UploadOptions
): Promise<{ url: string; name: string }> {
  const { file, onProgress, signal } = options;
  const { credentials, uploadConfig } = stsResponse;

  console.log('Starting OSS upload:', {
    uploadPath: uploadConfig.uploadPath,
    fileName: uploadConfig.fileName,
    fileSize: uploadConfig.fileSize,
    fileType: uploadConfig.fileType,
    region: uploadConfig.region,
    bucket: uploadConfig.bucket,
    endpoint: uploadConfig.endpoint,
  });

  // Create OSS client with STS credentials
  const client = new OSS({
    region: uploadConfig.region,
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    stsToken: credentials.securityToken,
    bucket: uploadConfig.bucket,
    endpoint: uploadConfig.endpoint,
  });

  try {
    // Upload file with progress tracking
    const result = await client.multipartUpload(uploadConfig.uploadPath, file, {
      progress: onProgress
        ? (p: number, checkpoint: any, res: any) => {
            console.log(`Upload progress: ${Math.round(p * 100)}%`);
            onProgress({
              loaded: Math.round(p * file.size),
              total: file.size,
              percent: Math.round(p * 100),
            });
          }
        : undefined,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'Cache-Control': 'max-age=31536000', // 1 year cache
      },
      // Abort upload if signal is provided
      abort: signal
        ? () => {
            throw new DOMException('Upload aborted', 'AbortError');
          }
        : undefined,
    });

    if (!result || !result.name) {
      throw new Error('Upload failed: No valid response from OSS');
    }

    // Return the public URL
    const url = `https://${uploadConfig.bucket}.oss-${uploadConfig.region}.aliyuncs.com/${result.name}`;

    return {
      url,
      name: result.name,
    };
  } catch (error) {
    console.error('OSS upload error:', error);

    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('timeout')) {
        throw new Error('Network error during upload. Please check your connection and try again.');
      } else if (error.message.includes('InvalidAccessKeyId')) {
        throw new Error('Upload credentials expired. Please try uploading again.');
      } else if (error.message.includes('AbortError')) {
        throw new Error('Upload was cancelled');
      }
    }

    throw new Error(error instanceof Error ? error.message : 'Upload failed');
  }
}

/**
 * Complete upload flow: get STS token and upload file
 */
export async function uploadFile(
  file: File,
  options?: {
    onProgress?: (progress: UploadProgress) => void;
    signal?: AbortSignal;
    preferDirectUpload?: boolean;
  }
): Promise<{ url: string; name: string; originalName?: string; size?: number }> {
  // Try direct STS upload first (if preferred), otherwise use server upload
  if (options?.preferDirectUpload) {
    try {
      const stsResponse = await getSTSToken(file.name, file.size, file.type);

      // Upload file using STS credentials
      const result = await uploadFileToOSS(stsResponse, {
        file,
        onProgress: options?.onProgress,
        signal: options?.signal,
      });
      return {
        ...result,
        originalName: file.name,
        size: file.size,
      };
    } catch (error) {
      console.warn(
        'Direct OSS upload failed (CORS likely not configured), falling back to server upload:',
        error
      );

      // Fall back to server upload
      return await uploadFileViaServer(file, options);
    }
  }

  // Default: Use server upload (more reliable)
  return await uploadFileViaServer(file, options);
}

/**
 * Upload file via server (reliable fallback method)
 */
export async function uploadFileViaServer(
  file: File,
  options?: {
    onProgress?: (progress: UploadProgress) => void;
    signal?: AbortSignal;
  }
): Promise<{ url: string; name: string; originalName?: string; size?: number }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/upload`, {
    method: 'POST',
    body: formData,
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Server upload failed: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Server upload failed');
  }

  return {
    url: result.url,
    name: result.originalName || result.filename,
    originalName: result.originalName,
    size: result.size,
  };
}

/**
 * Upload multiple files in parallel
 */
export async function uploadMultipleFiles(
  files: File[],
  options?: {
    onProgress?: (fileIndex: number, progress: UploadProgress) => void;
    onFileComplete?: (fileIndex: number, result: { url: string; name: string }) => void;
    maxConcurrent?: number;
  }
): Promise<{ url: string; name: string }[]> {
  const { maxConcurrent = 3 } = options || {};
  const results: { url: string; name: string }[] = [];

  // Process files in batches
  for (let i = 0; i < files.length; i += maxConcurrent) {
    const batch = files.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(async (file, batchIndex) => {
      const fileIndex = i + batchIndex;

      try {
        const result = await uploadFile(file, {
          onProgress: options?.onProgress
            ? (progress) => {
                options.onProgress!(fileIndex, progress);
              }
            : undefined,
        });

        if (options?.onFileComplete) {
          options.onFileComplete(fileIndex, result);
        }

        return result;
      } catch (error) {
        console.error(`Failed to upload file ${file.name}:`, error);
        throw error;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Generate a safe filename with timestamp
 */
export function generateSafeFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.includes('.') ? '.' + originalName.split('.').pop() : '';
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');

  // Sanitize filename: remove special characters, replace spaces with underscores
  const sanitizedName = nameWithoutExt
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 50); // Limit length

  return `${sanitizedName}_${timestamp}_${random}${extension}`;
}

/**
 * Validate file before upload
 */
export function validateFile(
  file: File,
  options?: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
  }
): { valid: boolean; error?: string } {
  const { maxSize = 500 * 1024 * 1024, allowedTypes = [] } = options || {};

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum allowed size of ${(maxSize / 1024 / 1024).toFixed(1)}MB`,
    };
  }

  // Check file type if restrictions provided
  if (allowedTypes.length > 0 && !allowedTypes.some((type) => file.type.startsWith(type))) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Extract video duration from a video file
 * Uses HTML5 video element to load video metadata and get duration
 */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    console.log(
      'getVideoDuration called for file:',
      file.name,
      'type:',
      file.type,
      'size:',
      file.size
    );

    const video = document.createElement('video');
    video.preload = 'metadata';

    let resolved = false;

    video.onloadedmetadata = () => {
      if (resolved) return;
      resolved = true;

      console.log('Video metadata loaded, duration:', video.duration);

      // Clean up
      URL.revokeObjectURL(video.src);

      if (video.duration && video.duration > 0 && isFinite(video.duration)) {
        resolve(video.duration);
      } else {
        reject(new Error(`Invalid duration value: ${video.duration}`));
      }
    };

    video.onerror = (error) => {
      if (resolved) return;
      resolved = true;

      console.error('Video error event:', error);
      // Clean up
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video metadata - onerror triggered'));
    };

    // Create object URL for the video file
    const objectUrl = URL.createObjectURL(file);
    console.log('Created object URL:', objectUrl);
    video.src = objectUrl;

    // Set a timeout in case the video never loads
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.warn('Video duration extraction timed out');
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Video metadata load timeout'));
    }, 10000); // 10 second timeout
  });
}

/**
 * Format duration in seconds to human-readable format (MM:SS or HH:MM:SS)
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
