import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// File size constants - use server defaults unless overridden
export const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB in bytes (default server limit)
export const MAX_FILE_SIZE_FORMATTED = '200MB';
export const MAX_FILES_PER_UPLOAD = 10; // Default server limit
