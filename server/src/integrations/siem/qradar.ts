import { translateSigma } from '../sigma-translator';
import type { SiemConnector } from './types';

export function createQRadarConnector(config: { base_url: string; token: string }): SiemConnector {
  const headers = () => ({ SEC: config.token, 'Content-Type': 'application/json', Accept: 'application/json' });
  return {
    async testConnection() {
      try {
        const res = await fetch(`${config.base_url}/api/system/about`, { headers: headers() });
        return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}` };
      } catch (e: any) { return { ok: false, message: e.message }; }
    },
    async pushRule(detection) {
      const aql = await translateSigma(detection.sigmaYaml, 'qradar');
      const body = { name: `mitremap-${detection.id}`, aql_query: aql, enabled: true };
      const res = await fetch(`${config.base_url}/api/analytics/rules`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
      return { ok: res.ok, message: res.ok ? 'Rule pushed' : `HTTP ${res.status}` };
    },
    async pullStatuses() {
      const res = await fetch(`${config.base_url}/api/analytics/rules?filter=name LIKE 'mitremap-%'`, { headers: headers() });
      if (!res.ok) return [];
      const rules = await res.json() as any[];
      return rules.map((r: any) => ({ remote_id: String(r.id), enabled: r.enabled ?? false }));
    },
  };
}
