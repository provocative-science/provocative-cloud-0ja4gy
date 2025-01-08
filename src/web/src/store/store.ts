/**
 * Redux store configuration for Provocative Cloud platform
 * Implements global state management with TypeScript support and real-time updates
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit'; // ^1.9.5
import thunk from 'redux-thunk'; // ^2.4.2
import rootReducer from './reducers';

/**
 * Configure Redux store with middleware and development tools
 * Implements type-safe state management with real-time update capabilities
 */
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable values in specific paths
        ignoredActions: ['metrics/websocketUpdate'],
        ignoredPaths: ['optimisticUpdates']
      },
      thunk: {
        extraArgument: undefined
      }
    }).concat(thunk),
  devTools: process.env.NODE_ENV !== 'production',
  preloadedState: undefined,
  enhancers: []
});

// Infer the `RootState` type from the store itself
export type RootState = ReturnType<typeof store.getState>;

// Infer the type of store.dispatch
export type AppDispatch = typeof store.dispatch;

/**
 * Type-safe hooks for use throughout the application
 * Provides proper typing for state and dispatch
 */
export type AppThunk<ReturnType = void> = (
  dispatch: AppDispatch,
  getState: () => RootState
) => ReturnType;

/**
 * Hot module replacement configuration for development
 * Enables state preservation during development
 */
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./reducers', () => {
    const newRootReducer = require('./reducers').default;
    store.replaceReducer(newRootReducer);
  });
}

/**
 * Store subscription for handling WebSocket reconnection
 * Ensures real-time updates persist across state changes
 */
store.subscribe(() => {
  const state = store.getState();
  
  // Monitor WebSocket connection status
  if (state.reservation.webSocketStatus === 'disconnected') {
    // Attempt reconnection after delay
    setTimeout(() => {
      store.dispatch({ type: 'websocket/reconnect' });
    }, 5000);
  }
});

export default store;

/**
 * Type-safe selector creator for use with reselect
 * Ensures proper typing when creating selectors
 */
export type Selector<TSelected> = (state: RootState) => TSelected;

/**
 * Type-safe action creator helper
 * Ensures proper typing for all dispatched actions
 */
export type ActionCreator<TPayload> = (payload: TPayload) => {
  type: string;
  payload: TPayload;
};

/**
 * Export store instance and types for use throughout the application
 */
export {
  store,
  type RootState,
  type AppDispatch,
  type AppThunk,
  type Selector,
  type ActionCreator
};