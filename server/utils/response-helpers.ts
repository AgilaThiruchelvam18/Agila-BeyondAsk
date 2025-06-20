/**
 * Response Helper Functions
 * Standardized API response utilities
 */

import { Response } from 'express';
import { getErrorMessage } from './type-guards';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Send success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
}

/**
 * Send error response
 */
export function sendError(
  res: Response,
  error: unknown,
  statusCode: number = 500,
  message?: string
): Response {
  const errorMessage = getErrorMessage(error);
  const response: ApiResponse = {
    success: false,
    error: errorMessage,
    message: message || 'An error occurred',
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
}

/**
 * Send paginated response
 */
export function sendPaginatedSuccess<T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  message?: string
): Response {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  
  const response: PaginatedResponse<T[]> = {
    success: true,
    data,
    message,
    pagination: {
      ...pagination,
      totalPages,
    },
    timestamp: new Date().toISOString(),
  };
  
  return res.status(200).json(response);
}

/**
 * Send validation error response
 */
export function sendValidationError(
  res: Response,
  errors: Record<string, string[]>
): Response {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    details: errors,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send not found response
 */
export function sendNotFound(
  res: Response,
  resource: string = 'Resource'
): Response {
  return res.status(404).json({
    success: false,
    error: `${resource} not found`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send unauthorized response
 */
export function sendUnauthorized(
  res: Response,
  message: string = 'Unauthorized'
): Response {
  return res.status(401).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send forbidden response
 */
export function sendForbidden(
  res: Response,
  message: string = 'Access forbidden'
): Response {
  return res.status(403).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  });
}