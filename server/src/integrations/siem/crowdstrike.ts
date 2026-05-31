import { translateSigma } from '../sigma-translator';
import type { SiemConnector } from './types';

export function createCrowdStrikeConnector(config: { client_id: string; client_secret: string; base_url?: string }): SiemConnector {
  const base = config.base_url ?? 'https://api.crowdstrike.com';
  async function getToken(): Promise<string> {
    const body = new URLSearchParams({ client_id: config.client_id, client_secret: config.client_secret });
    const res = await fetch(`${base}/oauth2/token`, { method: 'POST', body });
    if (!res.ok) throw new Error(`CrowdStrike auth failed: ${res.status}`);
    return ((await res.json()) as any).access_token;
  }
  return {
    async testConnection() {
      try { await getToken(); return { ok: true, message: 'Connected' }; }
      catch (e: any) { return { ok: false, message: e.message }; }
    },
    async pushRule(detection) {
      const token = await getToken();
      const query = await translateSigma(detection.sigmaYaml, 'crowdstrike');
      const body = { name: `mitremap-${detection.id}`, description: detection.name, pattern: query };
      const res = await fetch(`${base}/ioarules/entities/rules/v1`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { ok: res.ok, message: res.ok ? 'Rule pushed' : `HTTP ${res.status}` };
    },
    async pullStatuses() {
      const token = await getToken();
      const res = await fetch(`${base}/ioarules/entities/rules/GET/v1?filter=name:'mitremap-'`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      const j = await res.json() as any;
      return (j.resources ?? []).map((r: any) => ({ remote_id: String(r.id), enabled: r.enabled ?? false }));
    },
  };
}
