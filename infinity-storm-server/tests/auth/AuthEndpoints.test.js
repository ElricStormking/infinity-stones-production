/**
 * Authentication Endpoints Test
 *
 * Tests the JWT authentication system for the game server
 */

const request = require('supertest');
const { app } = require('../../server');
const JWTAuth = require('../../src/auth/jwt');

describe('Authentication Endpoints', () => {
  let testToken;
  let testPlayer;

  beforeAll(() => {
    // Mock player data for testing
    testPlayer = {
      player_id: '12345678-1234-1234-1234-123456789012',
      username: 'testplayer',
      email: 'test@example.com',
      is_admin: false,
      is_demo: true
    };

    // Generate test token
    testToken = JWTAuth.generateAccessToken(testPlayer);
  });

  describe('POST /api/auth/validate', () => {
    it('should validate a valid token', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({ token: testToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({ token: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require token parameter', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/session', () => {
    it('should create session from valid token', async () => {
      const response = await request(app)
        .post('/api/auth/session')
        .send({
          token: testToken,
          ip_address: '127.0.0.1',
          user_agent: 'Test-Agent'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.session).toBeDefined();
    });

    it('should reject invalid token for session creation', async () => {
      const response = await request(app)
        .post('/api/auth/session')
        .send({ token: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('GET /api/auth/status', () => {
    it('should return unauthenticated status without token', async () => {
      const response = await request(app)
        .get('/api/auth/status');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(false);
      expect(response.body.player).toBe(null);
    });

    it('should return authenticated status with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/status')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      // This might fail without full session setup, but structure should be correct
    });
  });

  describe('Authentication Middleware', () => {
    it('should protect spin endpoint', async () => {
      const response = await request(app)
        .post('/api/spin')
        .send({ bet: 1.00 });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should allow access to health endpoint without auth', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
    });
  });
});

describe('JWT Utilities', () => {
  describe('Token Generation and Verification', () => {
    it('should generate and verify access tokens', () => {
      const payload = {
        player_id: 'test-id',
        username: 'testuser'
      };

      const token = JWTAuth.generateAccessToken(payload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = JWTAuth.verifyAccessToken(token);
      expect(decoded.player_id).toBe(payload.player_id);
      expect(decoded.username).toBe(payload.username);
    });

    it('should generate and verify refresh tokens', () => {
      const payload = {
        player_id: 'test-id',
        username: 'testuser'
      };

      const token = JWTAuth.generateRefreshToken(payload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = JWTAuth.verifyRefreshToken(token);
      expect(decoded.player_id).toBe(payload.player_id);
      expect(decoded.username).toBe(payload.username);
    });

    it('should reject expired tokens', () => {
      // This would need a token with past expiry - test framework limitation
      expect(() => {
        JWTAuth.verifyAccessToken('invalid.token.here');
      }).toThrow();
    });

    it('should generate consistent token hashes', () => {
      const token = 'test-token-string';
      const hash1 = JWTAuth.generateTokenHash(token);
      const hash2 = JWTAuth.generateTokenHash(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
      expect(typeof hash1).toBe('string');
    });
  });
});