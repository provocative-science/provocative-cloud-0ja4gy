import EventEmitter from 'events';
import WebSocket from 'ws';
import { wsConfig } from '../config/api';
import { MetricsWebSocketMessage } from '../types/metrics';

/**
 * WebSocket client configuration options
 */
interface WebSocketOptions {
  autoReconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  pingInterval: number;
  enableMetricsLogging: boolean;
  connectionTimeout: number;
  useSSL: boolean;
  headers?: Record<string, string>;
}

/**
 * Structure for WebSocket messages
 */
interface WebSocketMessage {
  type: string;
  payload: any;
  id: string;
  timestamp: number;
  version: string;
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced WebSocket client implementation with robust error handling and reconnection logic
 * @version 1.0.0
 */
export class WebSocketClient {
  private socket: WebSocket | null = null;
  private readonly eventEmitter: EventEmitter;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private readonly subscriptions: Map<string, Function>;
  private readonly options: WebSocketOptions;
  private readonly url: string;
  private connectionMetrics: {
    lastConnected: number;
    disconnections: number;
    messageCount: number;
    errors: number;
  };

  constructor(url: string = wsConfig.url, options: Partial<WebSocketOptions> = {}) {
    this.url = url;
    this.options = {
      autoReconnect: true,
      reconnectInterval: wsConfig.reconnectInterval,
      maxReconnectAttempts: wsConfig.maxReconnectAttempts,
      pingInterval: 30000,
      enableMetricsLogging: true,
      connectionTimeout: wsConfig.timeout,
      useSSL: url.startsWith('wss://'),
      ...options
    };

    this.eventEmitter = new EventEmitter();
    this.subscriptions = new Map();
    this.connectionMetrics = {
      lastConnected: 0,
      disconnections: 0,
      messageCount: 0,
      errors: 0
    };
  }

  /**
   * Establishes WebSocket connection with enhanced error handling
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url, {
          headers: this.options.headers,
          timeout: this.options.connectionTimeout,
          rejectUnauthorized: this.options.useSSL
        });

        const connectionTimeout = setTimeout(() => {
          if (!this.isConnected) {
            this.socket?.close();
            reject(new Error('Connection timeout'));
          }
        }, this.options.connectionTimeout);

        this.socket.on('open', () => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.connectionMetrics.lastConnected = Date.now();
          this.reconnectAttempts = 0;
          this.setupPingInterval();
          resolve();
        });

        this.socket.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.socket.on('close', () => {
          this.handleDisconnection();
        });

        this.socket.on('error', (error: Error) => {
          this.handleError(error);
          reject(error);
        });

      } catch (error) {
        this.handleError(error as Error);
        reject(error);
      }
    });
  }

  /**
   * Subscribes to specific GPU and environmental metrics
   */
  public async subscribe(gpuId: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    const subscriptionMessage: WebSocketMessage = {
      type: 'subscribe',
      payload: { gpuId },
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      version: '1.0',
      metadata: { source: 'web-client' }
    };

    this.send(subscriptionMessage);
  }

  /**
   * Unsubscribes from GPU metrics
   */
  public async unsubscribe(gpuId: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    const unsubscribeMessage: WebSocketMessage = {
      type: 'unsubscribe',
      payload: { gpuId },
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      version: '1.0'
    };

    this.send(unsubscribeMessage);
    this.subscriptions.delete(gpuId);
  }

  /**
   * Sends message through WebSocket connection
   */
  public send(message: WebSocketMessage): void {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    this.socket.send(JSON.stringify(message));
  }

  /**
   * Closes WebSocket connection
   */
  public close(): void {
    this.options.autoReconnect = false;
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.socket?.close();
  }

  /**
   * Returns connection metrics
   */
  public getConnectionMetrics() {
    return { ...this.connectionMetrics };
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString()) as MetricsWebSocketMessage;
      this.connectionMetrics.messageCount++;
      this.eventEmitter.emit('message', message);

      if (message.type === 'pong') {
        this.eventEmitter.emit('pong');
        return;
      }

      this.eventEmitter.emit(message.type, message.payload);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  private handleDisconnection(): void {
    this.isConnected = false;
    this.connectionMetrics.disconnections++;
    this.eventEmitter.emit('disconnect');

    if (this.options.autoReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        this.connect().catch(this.handleError.bind(this));
      }, this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts));
    }
  }

  private handleError(error: Error): void {
    this.connectionMetrics.errors++;
    this.eventEmitter.emit('error', error);
  }

  private setupPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }

    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: 'ping',
          payload: null,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          version: '1.0'
        });
      }
    }, this.options.pingInterval);
  }
}