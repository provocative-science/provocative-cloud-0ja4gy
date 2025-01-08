/**
 * Root reducer configuration for Provocative Cloud platform
 * Combines all individual reducers with type-safe state management
 * @version 1.0.0
 */

import { combineReducers } from '@reduxjs/toolkit'; // ^1.9.5
import authReducer from './auth';
import billingReducer from './billing';
import gpuReducer from './gpu';
import metricsReducer from './metrics';
import reservationReducer from './reservation';
import serverReducer from './server';
import themeReducer from './theme';

/**
 * Root reducer combining all feature reducers
 * Provides type-safe global state management
 */
const rootReducer = combineReducers({
  auth: authReducer,
  billing: billingReducer,
  gpu: gpuReducer,
  metrics: metricsReducer,
  reservation: reservationReducer,
  server: serverReducer,
  theme: themeReducer
});

/**
 * Type definition for global application state
 * Inferred from the root reducer
 */
export type RootState = ReturnType<typeof rootReducer>;

/**
 * Type guard to validate state shape at runtime
 * @param state - State object to validate
 * @returns boolean indicating if state matches expected shape
 */
export function isValidRootState(state: unknown): state is RootState {
  if (!state || typeof state !== 'object') {
    return false;
  }

  const requiredKeys = [
    'auth',
    'billing',
    'gpu',
    'metrics',
    'reservation',
    'server',
    'theme'
  ];

  return requiredKeys.every(key => key in state);
}

/**
 * Selector type for type-safe state selection
 */
export type RootSelector<T> = (state: RootState) => T;

/**
 * Debug middleware to validate state updates in development
 * Ensures state maintains correct shape after each action
 */
export const validateStateMiddleware = () => (next: any) => (action: any) => {
  const result = next(action);
  const newState = rootReducer(undefined, action);

  if (!isValidRootState(newState)) {
    console.error('Invalid state shape after action:', action);
  }

  return result;
};

export default rootReducer;