/// <reference types="vite/client" />

/**
 * Type declarations for Vite environment variables used in Provocative Cloud frontend
 * @version 4.4.0
 */

/**
 * Environment variable interface for Provocative Cloud application
 * Defines strongly-typed environment variables for core platform functionality
 */
interface ImportMetaEnv {
  /** Base URL for the Provocative Cloud API */
  readonly VITE_API_URL: string;

  /** WebSocket endpoint for real-time GPU metrics and updates */
  readonly VITE_WEBSOCKET_URL: string;

  /** Google OAuth 2.0 client ID for authentication */
  readonly VITE_GOOGLE_CLIENT_ID: string;

  /** Stripe publishable key for payment processing */
  readonly VITE_STRIPE_PUBLIC_KEY: string;
}

/**
 * Augments the ImportMeta interface to include strongly-typed environment variables
 * This ensures type safety when accessing import.meta.env throughout the application
 */
interface ImportMeta {
  /** Strongly-typed environment variables */
  readonly env: ImportMetaEnv;
}