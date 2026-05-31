import { translateSigma } from '../sigma-translator';
import type { SiemConnector } from './types';

export function createSplunkConnector(config: { base_url: string; token: string; app: string }): SiemConnector {
  const headers = () => ({ Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' });
  return {
    async testConnection() {
      try {
        const res = await fetch(`${config.base_url}/services/apps/local`, { headers: headers() });
        return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}` };
      } catch (e: any) { return { ok: false, message: e.message }; }
    },
    async pushRule(detection) {
      const spl = await translateSigma(detection.sigmaYaml, 'splunk');
      const searchName = `mitremap-${detection.id}-${detection.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`;
      const body = new URLSearchParams({ name: searchName, search: spl, dispatch_earliest_time: '-1h', dispatch_latest_time: 'now', is_scheduled: '1', cron_schedule: '*/5 * * * *', output_mode: 'json' });
      const res = await fetch(`${config.base_url}/servicesNS/nobody/${config.app}/saved/searches`, { method: 'POST', headers: headers(), body });
      return { ok: res.ok || res.status === 409, remoteId: searchName, message: res.ok ? 'Rule pushed' : `HTTP ${res.status}` };
    },
    async pullStatuses() {
      const res = await fetch(`${config.base_url}/servicesNS/nobody/${config.app}/saved/searches?output_mode=json&search=mitremap-`, { headers: headers() });
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
      const json = await res.json() as any;
      return (json.entry ?? []).map((e: any) => ({ remote_id: e.name, enabled: e.content?.disabled === '0' || e.content?.disabled === false }));
    },
  };
}
