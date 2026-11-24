import { hash, verify } from '@node-rs/argon2';

/**
 * Algorithm.Argon2id is declared as a `const enum` in @node-rs/argon2, which
 * cannot be imported as a value under `isolatedModules`, so the documented
 * numeric value is used instead.
 */
const ARGON2ID = 2;

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * A real Argon2id hash of an arbitrary value, used to keep login timing
 * comparable when no account exists for the supplied email address.
 */
export const TIMING_EQUALISATION_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$oMWzoxe1SJ9wB1LKBViARg$ECEMFjM59iX8bTpBSiSzpfHXvBDkPt0fKAFAR7ZXS7U';
