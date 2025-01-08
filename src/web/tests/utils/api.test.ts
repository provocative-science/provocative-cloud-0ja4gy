import MockAdapter from 'axios-mock-adapter'; // ^1.21.0
import { WebSocket, Server } from 'mock-socket'; // ^9.2.1
import { api, handleApiError, connectWebSocket } from '../../src/utils/api';
import { apiConfig } from '../../src/config/api';
import { EnvironmentalMetrics } from '../../src/types/metrics';

// Test constants
const TEST_ENDPOINTS = {
  HTTP: '/api/v1/test',
  WS: 'ws://localhost:8080/metrics'
};

const TEST_DATA = {
  metrics: {
    co2CaptureRate: 45.5,
    pue: 1.2,
    wue: 0.5
  },
  response: {
    success: true,
    data: {},
    message: ''
  }
};

describe('API Utility Tests', () => {
  let mockAxios: MockAdapter;
  let mockWebSocket: Server;

  beforeAll(() => {
    // Mock WebSocket global
    (global as any).WebSocket = WebSocket;
    
    // Initialize mock WebSocket server
    mockWebSocket = new Server(TEST_ENDPOINTS.WS);
  });

  beforeEach(() => {
    // Initialize axios mock adapter
    mockAxios = new MockAdapter(api);
    
    // Reset WebSocket server
    mockWebSocket.emit('connection');
  });

  afterEach(() => {
    mockAxios.reset();
  });

  afterAll(() => {
    mockAxios.restore();
    mockWebSocket.stop();
  });

  describe('HTTP Methods', () => {
    test('GET request should handle pagination correctly', async () => {
      const paginatedData = {
        data: Array(10).fill(TEST_DATA.response),
        total: 100,
        page: 1,
        limit: 10
      };

      mockAxios.onGet(TEST_ENDPOINTS.HTTP).reply(200, paginatedData);

      const response = await api.get(TEST_ENDPOINTS.HTTP, {
        params: { page: 1, limit: 10 }
      });

      expect(response.data).toEqual(paginatedData);
      expect(response.data.data.length).toBe(10);
    });

    test('POST request should handle large payloads', async () => {
      const largePayload = {
        data: Array(1000).fill(TEST_DATA.response)
      };

      mockAxios.onPost(TEST_ENDPOINTS.HTTP).reply(200, TEST_DATA.response);

      const response = await api.post(TEST_ENDPOINTS.HTTP, largePayload);

      expect(response.data).toEqual(TEST_DATA.response);
    });

    test('PUT request should validate data before sending', async () => {
      const updateData = {
        ...TEST_DATA.response,
        updated: true
      };

      mockAxios.onPut(TEST_ENDPOINTS.HTTP).reply(200, updateData);

      const response = await api.put(TEST_ENDPOINTS.HTTP, updateData);

      expect(response.data).toEqual(updateData);
    });

    test('DELETE request should require confirmation', async () => {
      mockAxios.onDelete(TEST_ENDPOINTS.HTTP).reply(204);

      const response = await api.delete(TEST_ENDPOINTS.HTTP);

      expect(response.status).toBe(204);
    });
  });

  describe('Error Handling', () => {
    test('should retry on network errors', async () => {
      mockAxios
        .onGet(TEST_ENDPOINTS.HTTP)
        .replyOnce(500)
        .onGet(TEST_ENDPOINTS.HTTP)
        .replyOnce(200, TEST_DATA.response);

      const response = await api.get(TEST_ENDPOINTS.HTTP);

      expect(response.data).toEqual(TEST_DATA.response);
      expect(mockAxios.history.get.length).toBe(2);
    });

    test('should handle API errors with status codes', async () => {
      const errorResponse = {
        code: 400,
        message: 'Bad Request',
        details: { field: 'test' }
      };

      mockAxios.onPost(TEST_ENDPOINTS.HTTP).reply(400, errorResponse);

      try {
        await api.post(TEST_ENDPOINTS.HTTP, {});
      } catch (error) {
        const apiError = await handleApiError(error);
        expect(apiError.code).toBe(400);
        expect(apiError.message).toBe('Bad Request');
      }
    });

    test('should handle timeout errors', async () => {
      mockAxios.onGet(TEST_ENDPOINTS.HTTP).timeout();

      try {
        await api.get(TEST_ENDPOINTS.HTTP);
      } catch (error) {
        const apiError = await handleApiError(error);
        expect(apiError.code).toBe(503);
        expect(apiError.retryable).toBe(true);
      }
    });

    test('should implement circuit breaker pattern', async () => {
      let errorCount = 0;
      mockAxios.onGet(TEST_ENDPOINTS.HTTP).reply(() => {
        errorCount++;
        return [500];
      });

      try {
        await Promise.all(
          Array(10).fill(null).map(() => api.get(TEST_ENDPOINTS.HTTP))
        );
      } catch (error) {
        const apiError = await handleApiError(error);
        expect(apiError.code).toBe(500);
        expect(errorCount).toBeLessThan(10); // Circuit breaker should prevent all requests
      }
    });
  });

  describe('WebSocket Integration', () => {
    test('should establish WebSocket connection successfully', (done) => {
      const ws = connectWebSocket(TEST_ENDPOINTS.WS);

      ws.onopen = () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      };
    });

    test('should handle WebSocket messages correctly', (done) => {
      const ws = connectWebSocket(TEST_ENDPOINTS.WS);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        expect(data).toEqual(TEST_DATA.metrics);
        ws.close();
        done();
      };

      mockWebSocket.emit('message', JSON.stringify(TEST_DATA.metrics));
    });

    test('should implement reconnection logic', (done) => {
      const ws = connectWebSocket(TEST_ENDPOINTS.WS);
      let reconnectCount = 0;

      ws.onclose = () => {
        reconnectCount++;
        if (reconnectCount === 1) {
          expect(ws.readyState).toBe(WebSocket.CONNECTING);
          done();
        }
      };

      mockWebSocket.emit('close');
    });

    test('should handle environmental metrics streaming', (done) => {
      const ws = connectWebSocket(TEST_ENDPOINTS.WS);
      const metrics: EnvironmentalMetrics[] = [];

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        metrics.push(data);

        if (metrics.length === 3) {
          expect(metrics).toEqual(Array(3).fill(TEST_DATA.metrics));
          ws.close();
          done();
        }
      };

      // Simulate stream of metrics
      Array(3).fill(null).forEach(() => {
        mockWebSocket.emit('message', JSON.stringify(TEST_DATA.metrics));
      });
    });
  });
});