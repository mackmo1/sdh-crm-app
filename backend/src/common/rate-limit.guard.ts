import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { config } from '../config.js';

/**
 * Minimal fixed-window limiter for the authentication endpoints. It is
 * intentionally in-process: the CRM runs as a single API instance, and this
 * avoids adding a dependency for two endpoints. Swap for a shared store if the
 * API is ever scaled horizontally.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = `${this.clientKey(request)}:${request.path}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const recent = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      throw new HttpException(
        'Too many attempts. Please wait a few minutes and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.hits.set(key, recent);

    // Keep the map from growing without bound.
    if (this.hits.size > 5000) {
      for (const [entryKey, timestamps] of this.hits) {
        if (timestamps.every((timestamp) => timestamp <= windowStart)) this.hits.delete(entryKey);
      }
    }

    return true;
  }

  private clientKey(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return request.ip ?? 'unknown';
  }
}

export function rateLimit(limit: number, windowMs: number): RateLimitGuard {
  return new RateLimitGuard(limit, windowMs);
}

/** No-op used by the automated tests and by explicit configuration. */
@Injectable()
export class NoopRateLimitGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

export function guardedRateLimit(limit: number, windowMs: number): CanActivate {
  return config.rateLimitEnabled ? new RateLimitGuard(limit, windowMs) : new NoopRateLimitGuard();
}
