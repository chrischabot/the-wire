import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createUserData, createValidPassword, UserWithToken } from '../setup/test-factories';
import {
  assertSuccess,
  assertBadRequest,
  assertUnauthorized,
} from '../setup/assertions';

describe('Password Reset Endpoints', () => {
  let client: ApiClient;
  let testUser: UserWithToken;
  let testUserPassword: string;

  beforeAll(async () => {
    client = createApiClient();
    await client.resetDatabase();

    const userData = createUserData();
    testUserPassword = userData.password;
    const response = await client.post('/api/auth/signup', userData);
    const data = response.body.data as { user: { id: string; email: string; handle: string }; token: string };
    testUser = {
      id: data.user.id,
      email: userData.email,
      handle: userData.handle,
      token: data.token,
    };
  });

  beforeEach(() => {
    client.clearToken();
  });

  describe('POST /api/auth/reset/request', () => {
    describe('Happy Path', () => {
      it('should return success for valid handle and email', async () => {
        const response = await client.post('/api/auth/reset/request', {
          handle: testUser.handle,
          email: testUser.email,
        });

        const data = assertSuccess(response, 200);
        expect(data.message).toBeDefined();
        expect(data.resetToken).toBeDefined();
        expect(data.expiresAt).toBeDefined();
        expect(data.expiresAt).toBeGreaterThan(Date.now());
      });

      it('should return reset token that can be used', async () => {
        const response = await client.post('/api/auth/reset/request', {
          handle: testUser.handle,
          email: testUser.email,
        });

        const data = assertSuccess(response, 200);
        expect(typeof data.resetToken).toBe('string');
        expect(data.resetToken.length).toBeGreaterThan(0);
      });
    });

    describe('Security - Non-Revealing Responses', () => {
      it('should return success for non-existent handle (no user enumeration)', async () => {
        const response = await client.post('/api/auth/reset/request', {
          handle: 'nonexistentuser',
          email: 'nonexistent@example.com',
        });

        // Should still return 200 to prevent user enumeration
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return success for wrong email with valid handle', async () => {
        const response = await client.post('/api/auth/reset/request', {
          handle: testUser.handle,
          email: 'wrong@example.com',
        });

        // Should still return 200 to prevent user enumeration
        expect(response.status).toBe(200);
      });

      it('should return success for valid email with wrong handle', async () => {
        const response = await client.post('/api/auth/reset/request', {
          handle: 'wronghandle',
          email: testUser.email,
        });

        // Should still return 200 to prevent user enumeration
        expect(response.status).toBe(200);
      });
    });

    describe('Validation', () => {
      it('should handle missing handle', async () => {
        const response = await client.post('/api/auth/reset/request', {
          email: testUser.email,
        });

        // May return 200 (for security) or 400
        expect([200, 400]).toContain(response.status);
      });

      it('should handle missing email', async () => {
        const response = await client.post('/api/auth/reset/request', {
          handle: testUser.handle,
        });

        // May return 200 (for security) or 400
        expect([200, 400]).toContain(response.status);
      });

      it('should handle empty request body', async () => {
        const response = await client.post('/api/auth/reset/request', {});

        expect([200, 400]).toContain(response.status);
      });
    });
  });

  describe('POST /api/auth/reset/confirm', () => {
    let validResetToken: string;

    beforeEach(async () => {
      // Get a fresh reset token for each test
      const response = await client.post('/api/auth/reset/request', {
        handle: testUser.handle,
        email: testUser.email,
      });
      if (response.body.success && response.body.data?.resetToken) {
        validResetToken = response.body.data.resetToken;
      }
    });

    describe('Happy Path', () => {
      it('should reset password with valid token and new password', async () => {
        const newPassword = 'NewSecurePass123!';
        const response = await client.post('/api/auth/reset/confirm', {
          resetToken: validResetToken,
          newPassword: newPassword,
        });

        const data = assertSuccess(response, 200);
        expect(data.message).toContain('reset');
      });

      it('should allow login with new password after reset', async () => {
        const newPassword = 'NewSecurePass456!';

        // Reset password
        await client.post('/api/auth/reset/confirm', {
          resetToken: validResetToken,
          newPassword: newPassword,
        });

        // Try logging in with new password
        const loginResponse = await client.post('/api/auth/login', {
          email: testUser.email,
          password: newPassword,
        });

        assertSuccess(loginResponse, 200);
      });

      it('should reject login with old password after reset', async () => {
        const newPassword = 'NewSecurePass789!';

        // Reset password
        await client.post('/api/auth/reset/confirm', {
          resetToken: validResetToken,
          newPassword: newPassword,
        });

        // Try logging in with old password
        const loginResponse = await client.post('/api/auth/login', {
          email: testUser.email,
          password: testUserPassword,
        });

        assertUnauthorized(loginResponse);
      });
    });

    describe('Token Validation', () => {
      it('should reject invalid reset token', async () => {
        const response = await client.post('/api/auth/reset/confirm', {
          resetToken: 'invalid-reset-token',
          newPassword: 'NewPassword123!',
        });

        assertUnauthorized(response);
      });

      it('should reject empty reset token', async () => {
        const response = await client.post('/api/auth/reset/confirm', {
          resetToken: '',
          newPassword: 'NewPassword123!',
        });

        expect([400, 401]).toContain(response.status);
      });

      it('should reject reuse of reset token', async () => {
        const newPassword = 'FirstReset123!';

        // First use
        const response1 = await client.post('/api/auth/reset/confirm', {
          resetToken: validResetToken,
          newPassword: newPassword,
        });
        assertSuccess(response1, 200);

        // Second use with same token
        const response2 = await client.post('/api/auth/reset/confirm', {
          resetToken: validResetToken,
          newPassword: 'SecondReset123!',
        });

        assertUnauthorized(response2);
      });
    });

    describe('Password Validation', () => {
      it('should reject weak password - too short', async () => {
        const response = await client.post('/api/auth/reset/confirm', {
          resetToken: validResetToken,
          newPassword: 'Short1',
        });

        assertBadRequest(response);
      });

      it('should reject weak password - no uppercase', async () => {
        const response = await client.post('/api/auth/reset/confirm', {
          resetToken: validResetToken,
          newPassword: 'alllowercase123',
        });

        assertBadRequest(response);
      });

      it('should reject weak password - no lowercase', async () => {
        const response = await client.post('/api/auth/reset/confirm', {
          resetToken: validResetToken,
          newPassword: 'ALLUPPERCASE123',
        });

        assertBadRequest(response);
      });

      it('should reject weak password - no number', async () => {
        const response = await client.post('/api/auth/reset/confirm', {
          resetToken: validResetToken,
          newPassword: 'NoNumbersHere',
        });

        assertBadRequest(response);
      });

      it('should reject empty password', async () => {
        const response = await client.post('/api/auth/reset/confirm', {
          resetToken: validResetToken,
          newPassword: '',
        });

        assertBadRequest(response);
      });

      it('should reject missing password', async () => {
        const response = await client.post('/api/auth/reset/confirm', {
          resetToken: validResetToken,
        });

        assertBadRequest(response);
      });
    });

    describe('Edge Cases', () => {
      it('should handle missing resetToken field', async () => {
        const response = await client.post('/api/auth/reset/confirm', {
          newPassword: 'NewPassword123!',
        });

        expect([400, 401]).toContain(response.status);
      });

      it('should handle empty request body', async () => {
        const response = await client.post('/api/auth/reset/confirm', {});

        expect([400, 401]).toContain(response.status);
      });

      it('should handle null values', async () => {
        const response = await client.post('/api/auth/reset/confirm', {
          resetToken: null,
          newPassword: null,
        });

        expect([400, 401]).toContain(response.status);
      });
    });
  });

  describe('Password Reset Flow Integration', () => {
    it('should complete full password reset flow', async () => {
      // Create a fresh user for this test
      const freshUserData = createUserData();
      await client.post('/api/auth/signup', freshUserData);

      // 1. Request reset
      const requestResponse = await client.post('/api/auth/reset/request', {
        handle: freshUserData.handle,
        email: freshUserData.email,
      });
      const requestData = assertSuccess(requestResponse, 200);

      // 2. Confirm reset with new password
      const newPassword = 'BrandNewPass123!';
      const confirmResponse = await client.post('/api/auth/reset/confirm', {
        resetToken: requestData.resetToken,
        newPassword: newPassword,
      });
      assertSuccess(confirmResponse, 200);

      // 3. Verify old password doesn't work
      const oldLoginResponse = await client.post('/api/auth/login', {
        email: freshUserData.email,
        password: freshUserData.password,
      });
      assertUnauthorized(oldLoginResponse);

      // 4. Verify new password works
      const newLoginResponse = await client.post('/api/auth/login', {
        email: freshUserData.email,
        password: newPassword,
      });
      assertSuccess(newLoginResponse, 200);
    });
  });
});
