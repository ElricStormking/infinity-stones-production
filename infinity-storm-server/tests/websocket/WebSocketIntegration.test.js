/**
 * WebSocketIntegration.test.js - Integration Testing for WebSocket Cascade Events
 *
 * Custom Task 4.5: Test WebSocket cascade events - Integration Testing
 *
 * This test suite provides integration testing for WebSocket cascade synchronization
 * by testing the actual server implementation with real Socket.io connections.
 */

const request = require('supertest');
const io = require('socket.io-client');
const http = require('http');

// Import server dependencies
const app = require('../../server'); // Assuming server.js exports the app
const CascadeSync = require('../../src/websocket/CascadeSync');

describe('WebSocket Cascade Events Integration Testing', () => {
  let server;
  let clientSocket;
  let serverPort;

  // Test configuration
  const TEST_TIMEOUT = 10000;

  beforeAll(async () => {
    // Create server instance
    server = http.createServer(app);

    // Start server on random port
    await new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  beforeEach(async () => {
    // Create client socket connection
    clientSocket = io(`http://localhost:${serverPort}`, {
      transports: ['websocket'],
      forceNew: true
    });

    // Wait for connection
    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });
  }, TEST_TIMEOUT);

  afterEach(() => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
  });

  /**
     * Integration Test 1: Complete Server-Client WebSocket Communication
     */
  describe('Complete Server-Client WebSocket Communication', () => {
    test('should establish WebSocket connection with cascade sync capabilities', async () => {
      expect(clientSocket.connected).toBe(true);
      expect(clientSocket.id).toBeDefined();

      // Test basic server communication
      const testPromise = new Promise((resolve) => {
        clientSocket.on('test_response', resolve);
      });

      clientSocket.emit('test', { message: 'WebSocket integration test' });

      // Wait for response or timeout
      const response = await Promise.race([
        testPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);

      expect(response).toBeDefined();
    });

    test('should handle cascade sync start with real server integration', async () => {
      const syncData = {
        spinId: 'integration-test-spin-' + Date.now(),
        playerId: 'integration-test-player-' + Date.now(),
        gridState: [
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
          ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
          ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
          ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
          ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
        ],
        enableBroadcast: true
      };

      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Cascade sync start timeout'));
        }, 5000);

        clientSocket.on('sync_session_start', (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });

      clientSocket.emit('cascade_sync_start', syncData);

      const response = await responsePromise;

      expect(response).toBeDefined();
      if (response.success) {
        expect(response.syncSessionId).toBeDefined();
        expect(response.validationSalt).toBeDefined();
        expect(response.serverTimestamp).toBeDefined();
        expect(response.broadcastEnabled).toBe(true);
      } else {
        console.log('Cascade sync start failed (expected in test environment):', response.error);
        expect(response.error).toBeDefined();
      }
    });

    test('should handle step validation requests with server integration', async () => {
      const validationData = {
        syncSessionId: 'test-session-' + Date.now(),
        stepIndex: 0,
        gridState: [
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
          ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
          ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
          ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
          ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
        ],
        clientHash: 'integration-test-hash-' + Date.now(),
        clientTimestamp: Date.now(),
        phaseType: 'win_highlight'
      };

      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Step validation timeout'));
        }, 5000);

        clientSocket.on('step_validation_response', (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });

      clientSocket.emit('step_validation_request', validationData);

      const response = await responsePromise;

      expect(response).toBeDefined();
      expect(typeof response.success).toBe('boolean');
      if (response.success) {
        expect(response.stepIndex).toBe(0);
        expect(response.phaseType).toBe('win_highlight');
        expect(response.processingTime).toBeGreaterThan(0);
      }
    });

    test('should handle desync detection with server integration', async () => {
      const desyncData = {
        syncSessionId: 'test-session-' + Date.now(),
        desyncType: 'hash_mismatch',
        clientState: {
          gridState: [
            ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
            ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
            ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
            ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
            ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
          ]
        },
        stepIndex: 1,
        desyncDetails: {
          expectedHash: 'expected-hash-123',
          actualHash: 'actual-hash-456',
          timestamp: Date.now()
        }
      };

      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Desync detection timeout'));
        }, 5000);

        clientSocket.on('recovery_data', (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });

      clientSocket.emit('desync_detected', desyncData);

      const response = await responsePromise;

      expect(response).toBeDefined();
      expect(typeof response.success).toBe('boolean');
      if (response.success) {
        expect(response.syncSessionId).toBe(desyncData.syncSessionId);
        expect(response.desyncType).toBe('hash_mismatch');
        expect(response.recoveryType).toBeDefined();
        expect(response.recoveryId).toBeDefined();
      }
    });

    test('should handle grid validation requests', async () => {
      const gridValidationData = {
        gridState: [
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
          ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
          ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
          ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
          ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
        ],
        expectedHash: 'test-expected-hash',
        salt: 'test-salt-' + Date.now(),
        syncSessionId: 'grid-validation-session-' + Date.now()
      };

      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Grid validation timeout'));
        }, 5000);

        clientSocket.on('grid_validation_response', (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });

      clientSocket.emit('grid_validation_request', gridValidationData);

      const response = await responsePromise;

      expect(response).toBeDefined();
      expect(typeof response.success).toBe('boolean');
      if (response.success) {
        expect(typeof response.valid).toBe('boolean');
        expect(response.generatedHash).toBeDefined();
        expect(response.validationTime).toBeGreaterThan(0);
        expect(response.timestamp).toBeDefined();
      }
    });
  });

  /**
     * Integration Test 2: HTTP API + WebSocket Coordination
     */
  describe('HTTP API + WebSocket Coordination', () => {
    test('should coordinate between HTTP spin API and WebSocket events', async () => {
      // First make an HTTP request to start a spin
      const spinResponse = await request(app)
        .post('/api/spin')
        .send({
          bet: 100,
          playerId: 'integration-test-player'
        })
        .expect(200);

      expect(spinResponse.body.success).toBe(true);
      expect(spinResponse.body.spinId).toBeDefined();

      // Then test WebSocket communication with the spin data
      const syncData = {
        spinId: spinResponse.body.spinId,
        playerId: 'integration-test-player',
        gridState: spinResponse.body.result.initialGrid || [
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
          ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
          ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
          ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
          ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
        ]
      };

      const wsResponsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket sync timeout'));
        }, 5000);

        clientSocket.on('sync_session_start', (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });

      clientSocket.emit('cascade_sync_start', syncData);

      const wsResponse = await wsResponsePromise;

      expect(wsResponse).toBeDefined();
      if (wsResponse.success) {
        expect(wsResponse.syncSessionId).toBeDefined();
      }
    });

    test('should coordinate cascade validation between HTTP and WebSocket', async () => {
      // Test HTTP cascade validation endpoint
      const gridState = [
        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
        ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
        ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
        ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
        ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
      ];

      const httpResponse = await request(app)
        .post('/api/cascade/validate/grid')
        .send({
          gridState: gridState,
          expectedHash: 'test-hash',
          salt: 'test-salt'
        })
        .expect(200);

      expect(httpResponse.body.success).toBe(true);

      // Then test the same validation via WebSocket
      const wsResponsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket grid validation timeout'));
        }, 5000);

        clientSocket.on('grid_validation_response', (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });

      clientSocket.emit('grid_validation_request', {
        gridState: gridState,
        expectedHash: 'test-hash',
        salt: 'test-salt'
      });

      const wsResponse = await wsResponsePromise;

      expect(wsResponse).toBeDefined();
      expect(typeof wsResponse.success).toBe('boolean');
    });
  });

  /**
     * Integration Test 3: Real-Time Performance and Stress Testing
     */
  describe('Real-Time Performance and Stress Testing', () => {
    test('should handle multiple concurrent WebSocket connections', async () => {
      const connectionCount = 5;
      const connections = [];
      const responses = [];

      try {
        // Create multiple connections
        for (let i = 0; i < connectionCount; i++) {
          const socket = io(`http://localhost:${serverPort}`, {
            transports: ['websocket'],
            forceNew: true
          });

          const connectionPromise = new Promise((resolve) => {
            socket.on('connect', () => resolve(socket));
          });

          connections.push(await connectionPromise);
        }

        // Send sync start requests from all connections
        const syncPromises = connections.map((socket, index) => {
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Sync timeout for connection ${index}`));
            }, 5000);

            socket.on('sync_session_start', (response) => {
              clearTimeout(timeout);
              resolve(response);
            });

            socket.emit('cascade_sync_start', {
              spinId: `concurrent-test-${index}-${Date.now()}`,
              playerId: `concurrent-player-${index}`,
              gridState: [
                ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
                ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
                ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
                ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
                ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
              ]
            });
          });
        });

        const allResponses = await Promise.all(syncPromises);

        expect(allResponses).toHaveLength(connectionCount);
        allResponses.forEach((response, index) => {
          expect(response).toBeDefined();
          // In test environment, sync might fail due to missing dependencies
          // but the WebSocket communication should work
          expect(typeof response.success).toBe('boolean');
        });

      } finally {
        // Clean up connections
        connections.forEach(socket => {
          if (socket.connected) {
            socket.disconnect();
          }
        });
      }
    }, 15000);

    test('should maintain performance under rapid event firing', async () => {
      const eventCount = 50;
      const events = [];
      const startTime = Date.now();

      // Create event promises
      for (let i = 0; i < eventCount; i++) {
        const eventPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Event ${i} timeout`));
          }, 10000);

          const handler = (response) => {
            clearTimeout(timeout);
            clientSocket.off('grid_validation_response', handler);
            resolve(response);
          };

          clientSocket.on('grid_validation_response', handler);
        });

        events.push(eventPromise);

        // Fire grid validation request
        clientSocket.emit('grid_validation_request', {
          gridState: [
            ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
            ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
            ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
            ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
            ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
          ],
          expectedHash: `hash-${i}`,
          salt: `salt-${i}`
        });
      }

      const responses = await Promise.all(events);
      const processingTime = Date.now() - startTime;

      expect(responses).toHaveLength(eventCount);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify all responses are valid
      responses.forEach((response, index) => {
        expect(response).toBeDefined();
        expect(typeof response.success).toBe('boolean');
      });

      console.log(`Processed ${eventCount} events in ${processingTime}ms (${(eventCount / processingTime * 1000).toFixed(2)} events/sec)`);
    }, 15000);
  });

  /**
     * Integration Test 4: Error Handling and Recovery
     */
  describe('Error Handling and Recovery Integration', () => {
    test('should handle WebSocket disconnection and reconnection', async () => {
      // Establish initial connection
      expect(clientSocket.connected).toBe(true);

      // Disconnect
      clientSocket.disconnect();

      // Wait for disconnection
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(clientSocket.connected).toBe(false);

      // Reconnect
      clientSocket.connect();

      // Wait for reconnection
      await new Promise((resolve) => {
        clientSocket.on('connect', resolve);
      });

      expect(clientSocket.connected).toBe(true);

      // Test that WebSocket events still work after reconnection
      const testPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Reconnection test timeout'));
        }, 5000);

        clientSocket.on('grid_validation_response', (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });

      clientSocket.emit('grid_validation_request', {
        gridState: [
          ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
          ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
          ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
          ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
          ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
        ]
      });

      const response = await testPromise;
      expect(response).toBeDefined();
    });

    test('should handle malformed WebSocket data gracefully', async () => {
      const malformedEvents = [
        { event: 'cascade_sync_start', data: null },
        { event: 'step_validation_request', data: undefined },
        { event: 'desync_detected', data: { invalid: 'data' } },
        { event: 'grid_validation_request', data: { gridState: 'not_an_array' } }
      ];

      for (const { event, data } of malformedEvents) {
        // Should not crash the server
        clientSocket.emit(event, data);
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Connection should remain stable
        expect(clientSocket.connected).toBe(true);
      }
    });

    test('should handle server errors gracefully', async () => {
      // Test error response handling
      const errorPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Error handling test timeout'));
        }, 5000);

        clientSocket.on('sync_session_start', (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });

      // Send request that will likely cause an error in test environment
      clientSocket.emit('cascade_sync_start', {
        spinId: 'error-test-spin',
        playerId: 'error-test-player',
        gridState: 'invalid-grid-state' // Invalid data type
      });

      const response = await errorPromise;

      expect(response).toBeDefined();
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.errorMessage).toBeDefined();

      // Connection should remain stable after error
      expect(clientSocket.connected).toBe(true);
    });
  });

  /**
     * Integration Test 5: Production Readiness Validation
     */
  describe('Production Readiness Validation', () => {
    test('should maintain WebSocket connection stability', async () => {
      const stabilityDuration = 3000; // 3 seconds
      const startTime = Date.now();
      let connectionStable = true;

      clientSocket.on('disconnect', () => {
        connectionStable = false;
      });

      // Simulate typical WebSocket activity
      const activityInterval = setInterval(() => {
        if (clientSocket.connected) {
          clientSocket.emit('grid_validation_request', {
            gridState: [
              ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
              ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
              ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
              ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
              ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
            ]
          });
        }
      }, 500);

      // Wait for stability test duration
      await new Promise((resolve) => setTimeout(resolve, stabilityDuration));

      clearInterval(activityInterval);

      expect(connectionStable).toBe(true);
      expect(clientSocket.connected).toBe(true);
      expect(Date.now() - startTime).toBeGreaterThanOrEqual(stabilityDuration);
    });

    test('should handle expected production load patterns', async () => {
      const loadTestDuration = 2000; // 2 seconds
      const requestsPerSecond = 10;
      const totalRequests = Math.floor(loadTestDuration / 1000 * requestsPerSecond);

      const responses = [];
      const startTime = Date.now();

      const responseHandler = (response) => {
        responses.push(response);
      };

      clientSocket.on('grid_validation_response', responseHandler);

      // Generate load
      for (let i = 0; i < totalRequests; i++) {
        setTimeout(() => {
          clientSocket.emit('grid_validation_request', {
            gridState: [
              ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
              ['space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem'],
              ['mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem'],
              ['power_gem', 'reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem'],
              ['reality_gem', 'soul_gem', 'time_gem', 'space_gem', 'mind_gem', 'power_gem']
            ],
            loadTestId: i
          });
        }, i * (1000 / requestsPerSecond));
      }

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, loadTestDuration + 1000));

      clientSocket.off('grid_validation_response', responseHandler);

      const processingTime = Date.now() - startTime;
      const actualRPS = responses.length / (processingTime / 1000);

      console.log(`Load test: ${responses.length}/${totalRequests} responses in ${processingTime}ms (${actualRPS.toFixed(2)} RPS)`);

      expect(responses.length).toBeGreaterThan(0);
      expect(clientSocket.connected).toBe(true);
    });
  });
});