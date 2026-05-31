import { translateSigma } from '../sigma-translator';
import type { SiemConnector } from './types';

export function createChronicleConnector(config: {
  project_id: string; instance_id: string; region: string; service_account_json: string;
}): SiemConnector {
  const baseUrl = `https://${config.region}-chronicle.googleapis.com/v1alpha/projects/${config.project_id}/locations/${config.region}/instances/${config.instance_id}`;

  async function getToken(): Promise<string> {
    const sa = JSON.parse(config.service_account_json);
    const now = Math.floor(Date.now() / 1000);
    const { createSign } = await import('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: sa.client_email, sub: sa.client_email, aud: 'https://oauth2.googleapis.com/token', scope: 'https://www.googleapis.com/auth/chronicle-backstory', iat: now, exp: now + 3600 })).toString('base64url');
    const sign = createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const sig = sign.sign(sa.private_key).toString('base64url');
    const jwt = `${header}.${payload}.${sig}`;
    const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
    if (!res.ok) throw new Error(`Chronicle auth failed: ${res.status}`);
    return ((await res.json()) as any).access_token;
  }

  return {
    async testConnection() {
      try {
        const token = await getToken();
        const res = await fetch(`${baseUrl}/rules?pageSize=1`, { headers: { Authorization: `Bearer ${token}` } });
        return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}` };
      } catch (e: any) { return { ok: false, message: e.message }; }
    },
    async pushRule(detection) {
      const yaraL = await translateSigma(detection.sigmaYaml, 'chronicle');
      const token = await getToken();
      const body = { displayName: `mitremap-${detection.id}: ${detection.name}`, text: yaraL };
      const res = await fetch(`${baseUrl}/rules`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      let remoteId: string | undefined;
      if (res.ok) { const j = await res.json() as any; remoteId = j.name; }
      return { ok: res.ok, remoteId, message: res.ok ? 'Rule pushed' : `HTTP ${res.status}` };
    },
    async pullStatuses() {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/rules?pageSize=1000`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
      const json = await res.json() as any;
      return (json.rules ?? []).filter((r: any) => r.displayName?.startsWith('mitremap-')).map((r: any) => ({ remote_id: r.name, enabled: r.deploymentState === 'ACTIVE' }));
    },
  };
}
