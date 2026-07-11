import { promises as dnsPromises } from 'dns';
import net from 'net';
import https from 'https';

// RFC1918/loopback/link-local/reserved IPv4 ranges as [network, mask] pairs
const PRIVATE_V4: Array<[number, number]> = [
  [0x00000000, 0xFF000000], // 0.0.0.0/8
  [0x0A000000, 0xFF000000], // 10.0.0.0/8
  [0x64400000, 0xFFC00000], // 100.64.0.0/10 shared address space
  [0x7F000000, 0xFF000000], // 127.0.0.0/8 loopback
  [0xA9FE0000, 0xFFFF0000], // 169.254.0.0/16 link-local / metadata
  [0xAC100000, 0xFFF00000], // 172.16.0.0/12
  [0xC0000000, 0xFFFFFF00], // 192.0.0.0/24 IANA special
  [0xC0A80000, 0xFFFF0000], // 192.168.0.0/16
  [0xC6120000, 0xFFFE0000], // 198.18.0.0/15 benchmarking
  [0xE0000000, 0xF0000000], // 224.0.0.0/4 multicast
  [0xF0000000, 0xF0000000], // 240.0.0.0/4 reserved
  [0xFFFFFFFF, 0xFFFFFFFF], // 255.255.255.255 broadcast
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return PRIVATE_V4.some(([network, mask]) => (n & mask) === network);
}

function isPrivateIPv6(ip: string): boolean {
  const h = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '::1') return true;
  // IPv4-mapped ::ffff:w.x.y.z — check the embedded v4 address
  const v4mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4mapped) return isPrivateIPv4(v4mapped[1]);
  // fc00::/7 unique-local (fc00:: and fd00::)
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true;
  // fe80::/10 link-local
  if (/^fe[89ab][0-9a-f]:/i.test(h)) return true;
  return false;
}

async function resolveAndCheck(hostname: string): Promise<boolean> {
  // Normalize: lowercase, strip trailing dot
  const norm = hostname.toLowerCase().replace(/\.$/, '');

  // Reject well-known special-case names before DNS
  if (['localhost', 'ip6-localhost', 'ip6-loopback'].includes(norm)) return true;

  // If already a numeric IP, check directly (no DNS)
  if (net.isIPv4(norm)) return isPrivateIPv4(norm);
  if (net.isIPv6(norm)) return isPrivateIPv6(norm);

  // Resolve the hostname; ALL returned addresses must be public
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dnsPromises.lookup(norm, { all: true });
  } catch {
    throw new Error('Hostname could not be resolved');
  }
  if (addresses.length === 0) throw new Error('Hostname resolved to no addresses');

  return addresses.some(a =>
    a.family === 4 ? isPrivateIPv4(a.address) : isPrivateIPv6(a.address),
  );
}

async function check(rawUrl: string, kind: 'Integration' | 'Repository'): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid ${kind.toLowerCase()} URL`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${kind} URL must use HTTPS`);
  }
  if (await resolveAndCheck(parsed.hostname)) {
    throw new Error(`${kind} URL must not point to a private or loopback address`);
  }
}

export async function validateBaseUrl(rawUrl: string): Promise<void> {
  return check(rawUrl, 'Integration');
}

export async function validateGitRepoUrl(rawUrl: string): Promise<void> {
  return check(rawUrl, 'Repository');
}

export interface SafeRequestResult {
  status: number;
  ok: boolean;
  body: string;
}

/** HTTPS request that revalidates every redirect and pins the validated DNS result. */
export async function safeHttpsRequest(
  rawUrl: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; rejectUnauthorized?: boolean } = {},
  redirectsLeft = 3,
): Promise<SafeRequestResult> {
  await validateBaseUrl(rawUrl);
  const parsed = new URL(rawUrl);
  const addresses = await dnsPromises.lookup(parsed.hostname, { all: true });
  const publicAddresses = addresses.filter(a => a.family === 4 ? !isPrivateIPv4(a.address) : !isPrivateIPv6(a.address));
  if (publicAddresses.length !== addresses.length || publicAddresses.length === 0) {
    throw new Error('Integration URL must not point to a private or loopback address');
  }
  const pinned = publicAddresses[0];

  return new Promise((resolve, reject) => {
    const request = https.request(parsed, {
      method: options.method ?? 'GET',
      headers: options.headers,
      rejectUnauthorized: options.rejectUnauthorized !== false,
      lookup: (_hostname, _lookupOptions, callback) => callback(null, pinned.address, pinned.family),
    }, response => {
      const location = response.headers.location;
      if (location && [301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
        response.resume();
        if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
        const nextUrl = new URL(location, parsed).toString();
        const preserveBody = response.statusCode === 307 || response.statusCode === 308;
        const next = new URL(nextUrl);
        const headers = { ...(options.headers ?? {}) };
        if (next.origin !== parsed.origin) {
          for (const name of Object.keys(headers)) {
            if (['authorization', 'cookie', 'proxy-authorization'].includes(name.toLowerCase())) delete headers[name];
          }
        }
        safeHttpsRequest(nextUrl, preserveBody
          ? { ...options, headers }
          : { ...options, method: 'GET', body: undefined, headers }, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const status = response.statusCode ?? 500;
        resolve({ status, ok: status >= 200 && status < 300, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    request.setTimeout(options.timeoutMs ?? 10_000, () => request.destroy(new Error('Request timed out')));
    request.on('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}
