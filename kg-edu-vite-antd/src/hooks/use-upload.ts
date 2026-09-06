import { useState, useCallback, useRef } from "react";
import {
  uploadFile,
  uploadMultipleFiles,
  validateFile,
  generateSafeFileName,
} from "src/lib/oss-upload";
import type { UploadProgress } from "src/lib/oss-upload";

export interface UploadState {
  uploading: boolean;
  progress: number;
  error: string | null;
  result: { url: string; name: string } | null;
}

export interface UseUploadOptions {
  validate?: {
    maxSize?: number;
    allowedTypes?: string[];
  };
  onSuccess?: (result: { url: string; name: string }) => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

export function useUpload(options: UseUploadOptions = {}) {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: null,
    result: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const upload = useCallback(
    async (file: File) => {
      // Reset state
      setState({
        uploading: true,
        progress: 0,
        error: null,
        result: null,
      });

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        // Validate file
        if (options.validate) {
          const validation = validateFile(file, options.validate);
          if (!validation.valid) {
            throw new Error(validation.error);
          }
        }

        // Generate safe filename
        const safeFile = new File([file], generateSafeFileName(file.name), {
          type: file.type,
          lastModified: file.lastModified,
        });

        // Upload file
        const result = await uploadFile(safeFile, {
          onProgress: (progress) => {
            setState((prev) => ({ ...prev, progress: progress.percent }));
            options.onProgress?.(progress.percent);
          },
          signal: abortControllerRef.current?.signal,
        });

        // Update state
        setState({
          uploading: false,
          progress: 100,
          error: null,
          result,
        });

        options.onSuccess?.(result);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";

        setState({
          uploading: false,
          progress: 0,
          error: errorMessage,
          result: null,
        });

        options.onError?.(errorMessage);
        throw error;
      }
    },
    [options],
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState((prev) => ({
      ...prev,
      uploading: false,
      error: "Upload cancelled",
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      uploading: false,
      progress: 0,
      error: null,
      result: null,
    });
  }, []);

  return {
    ...state,
    upload,
    cancel,
    reset,
  };
}

export interface MultipleUploadState {
  uploading: boolean;
  totalFiles: number;
  completedFiles: number;
  currentFile: string | null;
  progress: number;
  error: string | null;
  results: { url: string; name: string }[];
}

export interface UseMultipleUploadOptions {
  validate?: {
    maxSize?: number;
    allowedTypes?: string[];
  };
  onSuccess?: (results: { url: string; name: string }[]) => void;
  onError?: (error: string) => void;
  onFileProgress?: (fileIndex: number, progress: number) => void;
  onFileComplete?: (
    fileIndex: number,
    result: { url: string; name: string },
  ) => void;
  maxConcurrent?: number;
}

export function useMultipleUpload(options: UseMultipleUploadOptions = {}) {
  const [state, setState] = useState<MultipleUploadState>({
    uploading: false,
    totalFiles: 0,
    completedFiles: 0,
    currentFile: null,
    progress: 0,
    error: null,
    results: [],
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return [];

      // Reset state
      setState({
        uploading: true,
        totalFiles: files.length,
        completedFiles: 0,
        currentFile: files[0].name,
        progress: 0,
        error: null,
        results: [],
      });

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        // Validate files
        if (options.validate) {
          for (const file of files) {
            const validation = validateFile(file, options.validate);
            if (!validation.valid) {
              throw new Error(`${file.name}: ${validation.error}`);
            }
          }
        }

        // Generate safe filenames
        const safeFiles = files.map(
          (file) =>
            new File([file], generateSafeFileName(file.name), {
              type: file.type,
              lastModified: file.lastModified,
            }),
        );

        // Upload files
        const results = await uploadMultipleFiles(safeFiles, {
          onProgress: (fileIndex, progress) => {
            setState((prev) => ({
              ...prev,
              currentFile: safeFiles[fileIndex].name,
              progress: progress.percent,
              completedFiles: fileIndex,
            }));
            options.onFileProgress?.(fileIndex, progress.percent);
          },
          onFileComplete: (fileIndex, result) => {
            setState((prev) => ({
              ...prev,
              completedFiles: fileIndex + 1,
              results: [...prev.results, result],
            }));
            options.onFileComplete?.(fileIndex, result);
          },
          maxConcurrent: options.maxConcurrent,
        });

        // Update final state
        setState({
          uploading: false,
          totalFiles: files.length,
          completedFiles: files.length,
          currentFile: null,
          progress: 100,
          error: null,
          results,
        });

        options.onSuccess?.(results);
        return results;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";

        setState({
          uploading: false,
          totalFiles: files.length,
          completedFiles: state.completedFiles,
          currentFile: null,
          progress: 0,
          error: errorMessage,
          results: state.results,
        });

        options.onError?.(errorMessage);
        throw error;
      }
    },
    [options, state.completedFiles, state.results],
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState((prev) => ({
      ...prev,
      uploading: false,
      error: "Upload cancelled",
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      uploading: false,
      totalFiles: 0,
      completedFiles: 0,
      currentFile: null,
      progress: 0,
      error: null,
      results: [],
    });
  }, []);

  return {
    ...state,
    upload,
    cancel,
    reset,
  };
}
