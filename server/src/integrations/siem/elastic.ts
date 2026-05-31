import { translateSigma } from '../sigma-translator';
import type { SiemConnector } from './types';

export function createElasticConnector(config: { base_url: string; api_key: string; space_id?: string }): SiemConnector {
  const spacePrefix = config.space_id ? `/s/${config.space_id}` : '';
  const headers = () => ({ Authorization: `ApiKey ${config.api_key}`, 'Content-Type': 'application/json', 'kbn-xsrf': 'true' });
  return {
    async testConnection() {
      try {
        const res = await fetch(`${config.base_url}${spacePrefix}/api/detection_engine/rules/_find?per_page=1`, { headers: headers() });
        return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}` };
      } catch (e: any) { return { ok: false, message: e.message }; }
    },
    async pushRule(detection) {
      const eql = await translateSigma(detection.sigmaYaml, 'elasticsearch');
      const ruleId = `mitremap-${detection.id}`;
      const body = { rule_id: ruleId, name: detection.name, type: 'eql', query: eql, language: 'eql', index: ['logs-*', 'winlogbeat-*'], enabled: true, severity: 'medium', risk_score: 47, from: 'now-1h', interval: '5m' };
      const res = await fetch(`${config.base_url}${spacePrefix}/api/detection_engine/rules`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
      return { ok: res.ok, remoteId: ruleId, message: res.ok ? 'Rule pushed' : `HTTP ${res.status}` };
    },
    async pullStatuses() {
      const res = await fetch(`${config.base_url}${spacePrefix}/api/detection_engine/rules/_find?filter=alert.attributes.tags:%22mitremap%22&per_page=100`, { headers: headers() });
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
      const json = await res.json() as any;
      return (json.data ?? []).filter((r: any) => r.rule_id?.startsWith('mitremap-')).map((r: any) => ({ remote_id: r.rule_id, enabled: r.enabled ?? false }));
    },
  };
}
