import { translateSigma } from '../sigma-translator';
import type { SiemConnector } from './types';

export function createSentinelConnector(config: {
  tenant_id: string; client_id: string; client_secret: string;
  subscription_id: string; resource_group: string; workspace_name: string;
}): SiemConnector {
  const ARM_BASE = 'https://management.azure.com';

  async function getToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials', client_id: config.client_id,
      client_secret: config.client_secret, scope: 'https://management.azure.com/.default',
    });
    const res = await fetch(`https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
    return ((await res.json()) as any).access_token;
  }

  const alertRulesPath = `/subscriptions/${config.subscription_id}/resourceGroups/${config.resource_group}/providers/Microsoft.OperationalInsights/workspaces/${config.workspace_name}/providers/Microsoft.SecurityInsights/alertRules`;

  return {
    async testConnection() {
      try {
        const token = await getToken();
        const res = await fetch(`${ARM_BASE}${alertRulesPath}?api-version=2023-02-01`, { headers: { Authorization: `Bearer ${token}` } });
        return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}` };
      } catch (e: any) { return { ok: false, message: e.message }; }
    },
    async pushRule(detection) {
      const kql = await translateSigma(detection.sigmaYaml, 'microsoft365defender');
      const token = await getToken();
      const ruleId = `mitremap-${detection.id}`;
      const body = { kind: 'Scheduled', properties: { displayName: detection.name, query: kql, queryFrequency: 'PT5M', queryPeriod: 'PT1H', triggerOperator: 'GreaterThan', triggerThreshold: 0, severity: 'Medium', enabled: true } };
      const res = await fetch(`${ARM_BASE}${alertRulesPath}/${ruleId}?api-version=2023-02-01`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { ok: res.ok || res.status === 201, remoteId: ruleId, message: res.ok ? 'Rule pushed' : `HTTP ${res.status}` };
    },
    async pullStatuses() {
      const token = await getToken();
      const res = await fetch(`${ARM_BASE}${alertRulesPath}?api-version=2023-02-01`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
      const json = await res.json() as any;
      return (json.value ?? []).filter((r: any) => r.name?.startsWith('mitremap-')).map((r: any) => ({ remote_id: r.name, enabled: r.properties?.enabled ?? false }));
    },
  };
}
