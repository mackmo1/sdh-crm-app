import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard.js';

function contextFor(ip: string, path = '/api/auth/login'): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip, path, headers: {} }),
    }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  it('allows requests up to the limit', () => {
    const guard = new RateLimitGuard(3, 60_000);
    expect(guard.canActivate(contextFor('10.0.0.1'))).toBe(true);
    expect(guard.canActivate(contextFor('10.0.0.1'))).toBe(true);
    expect(guard.canActivate(contextFor('10.0.0.1'))).toBe(true);
  });

  it('rejects the request after the limit is reached', () => {
    const guard = new RateLimitGuard(2, 60_000);
    guard.canActivate(contextFor('10.0.0.2'));
    guard.canActivate(contextFor('10.0.0.2'));
    expect(() => guard.canActivate(contextFor('10.0.0.2'))).toThrow(HttpException);
  });

  it('tracks clients independently', () => {
    const guard = new RateLimitGuard(1, 60_000);
    guard.canActivate(contextFor('10.0.0.3'));
    expect(guard.canActivate(contextFor('10.0.0.4'))).toBe(true);
  });

  it('tracks endpoints independently', () => {
    const guard = new RateLimitGuard(1, 60_000);
    guard.canActivate(contextFor('10.0.0.5', '/api/auth/login'));
    expect(guard.canActivate(contextFor('10.0.0.5', '/api/auth/forgot-password'))).toBe(true);
  });
});
