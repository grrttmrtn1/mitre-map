const PRIVATE_HOST = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
];

export function validateBaseUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Integration URL must use HTTPS');
  }
  if (PRIVATE_HOST.some(p => p.test(parsed.hostname))) {
    throw new Error('Integration URL must not point to a private or loopback address');
  }
}

export function validateGitRepoUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid repository URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Repository URL must use HTTPS');
  }
  if (PRIVATE_HOST.some(p => p.test(parsed.hostname))) {
    throw new Error('Repository URL must not point to a private or loopback address');
  }
}
