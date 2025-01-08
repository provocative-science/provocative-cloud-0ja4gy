/**
 * TypeScript type definitions and interfaces for authentication and authorization
 * in the Provocative Cloud frontend. Includes types for JWT tokens, Google OAuth flow,
 * user roles, and authentication state management.
 * @version 1.0.0
 */

import { UUID, Timestamp, ApiResponse } from './common';

/**
 * Enum defining available user roles in the system
 */
export enum UserRole {
  USER = 'USER',
  HOST = 'HOST',
  ADMIN = 'ADMIN'
}

/**
 * Enum defining possible authentication states
 */
export enum AuthState {
  AUTHENTICATED = 'AUTHENTICATED',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  LOADING = 'LOADING'
}

/**
 * Interface for JWT token response from the API
 */
export interface TokenResponse {
  readonly access_token: string;
  readonly token_type: string;
  readonly expires_at: Timestamp;
}

/**
 * Interface for Google OAuth authentication request parameters
 */
export interface GoogleAuthRequest {
  readonly code: string;
  readonly redirect_uri: string;
}

/**
 * Interface for Google OAuth authentication response
 */
export interface GoogleAuthResponse {
  readonly id_token: string;
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_at: Timestamp;
}

/**
 * Interface defining the structure of JWT token payload
 */
export interface JWTPayload {
  readonly sub: UUID;
  readonly email: string;
  readonly roles: readonly UserRole[];
  readonly exp: Timestamp;
}

/**
 * Interface for authenticated user data
 */
export interface AuthUser {
  readonly id: UUID;
  readonly email: string;
  readonly roles: readonly UserRole[];
  readonly created_at: Timestamp;
}

/**
 * Interface for authentication context state
 */
export interface AuthContextState {
  readonly state: AuthState;
  readonly user: AuthUser | null;
  readonly token: string | null;
}

/**
 * Key used for storing authentication token in local storage
 */
export const TOKEN_STORAGE_KEY = 'auth_token';

/**
 * Prefix used in Authorization header for API requests
 */
export const AUTH_HEADER_PREFIX = 'Bearer';

/**
 * Type for API responses containing authentication data
 */
export type AuthApiResponse<T> = ApiResponse<T>;