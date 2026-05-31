import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto';

function deriveKey(): Buffer {
  const secret = process.env.JWT_SECRET ?? 'dev-insecure-key-change-me';
  return scryptSync(secret, 'mitremap-siem-credentials', 32);
}

export interface EncryptedPayload {
  iv: string;
  tag: string;
  data: string;
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: encrypted.toString('hex'),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = deriveKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const data = Buffer.from(payload.data, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function encryptJson(obj: Record<string, string>): string {
  return JSON.stringify(encrypt(JSON.stringify(obj)));
}

export function decryptJson(encStr: string): Record<string, string> {
  const payload: EncryptedPayload = JSON.parse(encStr);
  return JSON.parse(decrypt(payload));
}
