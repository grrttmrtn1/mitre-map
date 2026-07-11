import { decryptJson, encryptJson } from './integrations/crypto';

const TEST_JWT_SECRET = 'mitremap-dev-secret-change-in-production';
const TEST_ENCRYPTION_SECRET = 'mitremap-test-encryption-secret';

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return TEST_JWT_SECRET;
  throw new Error('JWT_SECRET environment variable is required');
}

export function requireEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET ?? process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return TEST_ENCRYPTION_SECRET;
  throw new Error('ENCRYPTION_SECRET or JWT_SECRET environment variable is required');
}

export function encryptSecretValue(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return encryptJson({ value });
}

export function decryptSecretValue(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const decoded = decryptJson(value);
    return decoded.value ?? null;
  } catch {
    return value;
  }
}

export function encryptSecretObject(obj: Record<string, string>): string | null {
  return Object.keys(obj).length ? encryptJson(obj) : null;
}

export function decryptSecretObject(value: string | null | undefined): Record<string, string> {
  if (!value) return {};
  try {
    return decryptJson(value);
  } catch {
    return {};
  }
}
