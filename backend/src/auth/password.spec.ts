import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('produces an Argon2id hash that verifies', async () => {
    const hash = await hashPassword('CorrectHorseBattery');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'CorrectHorseBattery')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('CorrectHorseBattery');
    expect(await verifyPassword(hash, 'correcthorsebattery')).toBe(false);
  });

  it('salts each hash', async () => {
    const first = await hashPassword('SamePassword123');
    const second = await hashPassword('SamePassword123');
    expect(first).not.toBe(second);
    expect(await verifyPassword(first, 'SamePassword123')).toBe(true);
    expect(await verifyPassword(second, 'SamePassword123')).toBe(true);
  });

  it('treats a malformed hash as a failed verification', async () => {
    expect(await verifyPassword('not-a-hash', 'whatever')).toBe(false);
  });
});
