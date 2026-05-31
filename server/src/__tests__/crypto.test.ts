import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, encryptJson, decryptJson } from '../integrations/crypto';

describe('encrypt/decrypt', () => {
  it('round-trips a string', () => {
    const payload = encrypt('hello world');
    expect(decrypt(payload)).toBe('hello world');
  });

  it('produces different ciphertexts for the same input (random IV)', () => {
    const p1 = encrypt('same');
    const p2 = encrypt('same');
    expect(p1.data).not.toBe(p2.data);
  });
});

describe('encryptJson/decryptJson', () => {
  it('round-trips a JSON object', () => {
    const obj = { token: 'secret-token', user: 'admin' };
    const enc = encryptJson(obj);
    expect(decryptJson(enc)).toEqual(obj);
  });
});
