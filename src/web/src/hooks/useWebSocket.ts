import { useEffect, useCallback, useState } from 'react'; // ^18.0.0
import { WebSocketClient, wsConfig } from '../api/websocket';
import { MetricsResponse } from '../types/metrics';

/**
 * Configuration options for the useWebSocket hook
 */
interface UseWebSocketOptions {
  autoConnect?: boolean;
  autoReconnect?: boolean;
  maxRetries?: number;
  reconnectInterval?: number;
  onMessage?: (message: MetricsResponse) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onReconnect?: (attempt: number) => void;
}

/**
 * Return type for the useWebSocket hook
 */
interface UseWebSocketReturn {
  isConnected: boolean;
  error: Error | null;
  retryCount: number;
  isReconnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (gpuId: string) => Promise<void>;
  unsubscribe: (gpuId: string) => Promise<void>;
  resetConnection: () => void;
}

/**
 * Custom hook for managing WebSocket connections with real-time GPU and environmental metrics
 * Provides robust connection management, automatic reconnection, and subscription handling
 * @version 1.0.0
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    autoConnect = true,
    autoReconnect = true,
    maxRetries = wsConfig.maxReconnectAttempts,
    reconnectInterval = wsConfig.reconnectInterval,
    onMessage,
    onError,
    onClose,
    onReconnect
  } = options;

  // WebSocket client instance
  const [client] = useState(() => new WebSocketClient(wsConfig.url, {
    autoReconnect,
    reconnectInterval,
    maxReconnectAttempts: maxRetries,
    enableMetricsLogging: true
  }));

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  /**
   * Memoized connect handler with retry logic
   */
  const connect = useCallback(async () => {
    try {
      setError(null);
      await client.connect();
      setIsConnected(true);
      setRetryCount(0);
      setIsReconnecting(false);
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      
      if (autoReconnect && retryCount < maxRetries) {
        setIsReconnecting(true);
        onReconnect?.(retryCount + 1);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          connect();
        }, reconnectInterval * Math.pow(2, retryCount));
      }
    }
  }, [client, retryCount, maxRetries, reconnectInterval, autoReconnect, onError, onReconnect]);

  /**
   * Memoized disconnect handler with cleanup
   */
  const disconnect = useCallback(() => {
    client.close();
    setIsConnected(false);
    setIsReconnecting(false);
    setRetryCount(0);
    onClose?.();
  }, [client, onClose]);

  /**
   * Memoized subscription handler for GPU metrics
   */
  const subscribe = useCallback(async (gpuId: string) => {
    if (!isConnected) {
      throw new Error('WebSocket not connected');
    }
    await client.subscribe(gpuId);
  }, [client, isConnected]);

  /**
   * Memoized unsubscribe handler
   */
  const unsubscribe = useCallback(async (gpuId: string) => {
    if (!isConnected) {
      throw new Error('WebSocket not connected');
    }
    await client.unsubscribe(gpuId);
  }, [client, isConnected]);

  /**
   * Memoized connection reset handler
   */
  const resetConnection = useCallback(() => {
    disconnect();
    setError(null);
    setRetryCount(0);
    connect();
  }, [disconnect, connect]);

  /**
   * Effect for handling initial connection
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  /**
   * Effect for handling message events
   */
  useEffect(() => {
    const handleMessage = (message: MetricsResponse) => {
      onMessage?.(message);
    };

    client.eventEmitter.on('message', handleMessage);
    return () => {
      client.eventEmitter.off('message', handleMessage);
    };
  }, [client, onMessage]);

  /**
   * Effect for handling error events
   */
  useEffect(() => {
    const handleError = (error: Error) => {
      setError(error);
      onError?.(error);
    };

    client.eventEmitter.on('error', handleError);
    return () => {
      client.eventEmitter.off('error', handleError);
    };
  }, [client, onError]);

  return {
    isConnected,
    error,
    retryCount,
    isReconnecting,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    resetConnection
  };
}