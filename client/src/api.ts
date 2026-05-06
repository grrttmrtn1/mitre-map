import type {
  ApiKey, Assignment, AuditLogEntry, Comment, ComplianceFramework, CoverageSnapshot, CoverageStats,
  Detection, D3FendTechnique, ExecutiveReport, GapTechnique, MatrixColumn, Mitigation,
  RiskByTactic, RiskScore, SigmaParseResult, Tactic, Tag, Technique, ThreatGroup,
  ThreatGroupDetail, Tool, ToolDetail,
} from './types';

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function del(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  if (!res.ok && res.status !== 204) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return;
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('application/json') ? res.json() : undefined;
}

export const api = {
  // ATT&CK
  getTactics: () => get<Tactic[]>('/attack/tactics'),
  getTechniques: (tactic?: string) => get<Technique[]>(`/attack/techniques${tactic ? `?tactic=${tactic}` : ''}`),
  getTechnique: (id: string) => get<Technique & { mitigations: Mitigation[]; d3fend_countermeasures: D3FendTechnique[]; detections: Detection[] }>(`/attack/techniques/${id}`),
  getMitigations: () => get<Mitigation[]>('/attack/mitigations'),

  // D3FEND
  getD3fendTechniques: () => get<D3FendTechnique[]>('/d3fend/techniques'),
  getD3fendMappings: (attackId: string) => get<D3FendTechnique[]>(`/d3fend/mappings/${attackId}`),

  // Detections
  getDetections: (filters?: { status?: string; source?: string; severity?: string; technique?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.source) params.set('source', filters.source);
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.technique) params.set('technique', filters.technique);
    const q = params.toString();
    return get<Detection[]>(`/detections${q ? `?${q}` : ''}`);
  },
  getDetection: (id: number) => get<Detection>(`/detections/${id}`),
  createDetection: (data: Partial<Detection>) => post<Detection>('/detections', data),
  updateDetection: (id: number, data: Partial<Detection>) => put<Detection>(`/detections/${id}`, data),
  deleteDetection: (id: number) => del(`/detections/${id}`),
  importDetections: (detections: Partial<Detection>[]) => post<{ imported: number }>('/detections/import', { detections }),
  bulkUpdateDetections: (ids: number[], status: string) => patch<{ updated: number }>('/detections/bulk', { ids, status }),
  bulkDeleteDetections: (ids: number[]) => del('/detections/bulk', { ids }),

  // Tools
  getTools: () => get<Tool[]>('/tools'),
  getTool: (id: number) => get<ToolDetail>(`/tools/${id}`),
  createTool: (data: Partial<Tool> & { d3fend_ids?: string[]; mitigation_ids?: string[] }) => post<Tool>('/tools', data),
  updateTool: (id: number, data: Partial<Tool> & { d3fend_ids?: string[]; mitigation_ids?: string[] }) => put<Tool>(`/tools/${id}`, data),
  deleteTool: (id: number) => del(`/tools/${id}`),

  // Coverage
  getCoverageStats: () => get<CoverageStats>('/coverage/stats'),
  getCoverageMatrix: () => get<MatrixColumn[]>('/coverage/matrix'),
  getCoverageGaps: () => get<GapTechnique[]>('/coverage/gaps'),

  // Tags
  getTags: () => get<Tag[]>('/tags'),
  createTag: (data: Partial<Tag>) => post<Tag>('/tags', data),
  updateTag: (id: number, data: Partial<Tag>) => put<Tag>(`/tags/${id}`, data),
  deleteTag: (id: number) => del(`/tags/${id}`),
  getEntityTags: (entityType: string, entityId: string | number) => get<Tag[]>(`/tags/${entityType}/${entityId}`),
  addEntityTag: (entityType: string, entityId: string | number, tag_id: number) => post<{ ok: boolean }>(`/tags/${entityType}/${entityId}`, { tag_id }),
  removeEntityTag: (entityType: string, entityId: string | number, tagId: number) => del(`/tags/${entityType}/${entityId}/${tagId}`),

  // Assignments
  getAssignments: (filters?: { assignee?: string; status?: string; entity_type?: string }) => {
    const params = new URLSearchParams();
    if (filters?.assignee) params.set('assignee', filters.assignee);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.entity_type) params.set('entity_type', filters.entity_type);
    const q = params.toString();
    return get<Assignment[]>(`/assignments${q ? `?${q}` : ''}`);
  },
  getEntityAssignments: (entityType: string, entityId: string | number) => get<Assignment[]>(`/assignments/${entityType}/${entityId}`),
  createAssignment: (data: Partial<Assignment>) => post<Assignment>('/assignments', data),
  updateAssignment: (id: number, data: Partial<Assignment>) => put<Assignment>(`/assignments/${id}`, data),
  deleteAssignment: (id: number) => del(`/assignments/${id}`),

  // Comments
  getComments: (entityType: string, entityId: string | number) => get<Comment[]>(`/comments/${entityType}/${entityId}`),
  createComment: (entityType: string, entityId: string | number, body: string, author?: string) =>
    post<Comment>(`/comments/${entityType}/${entityId}`, { body, author }),
  updateComment: (id: number, body: string) => put<Comment>(`/comments/${id}`, { body }),
  deleteComment: (id: number) => del(`/comments/${id}`),

  // Audit log
  getAuditLog: (filters?: { entity_type?: string; entity_id?: string; actor?: string; action?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (filters?.entity_type) params.set('entity_type', filters.entity_type);
    if (filters?.entity_id) params.set('entity_id', filters.entity_id);
    if (filters?.actor) params.set('actor', filters.actor);
    if (filters?.action) params.set('action', filters.action);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    const q = params.toString();
    return get<{ rows: AuditLogEntry[]; total: number }>(`/audit${q ? `?${q}` : ''}`);
  },
  getEntityAuditLog: (entityType: string, entityId: string | number) => get<AuditLogEntry[]>(`/audit/${entityType}/${entityId}`),

  // Coverage snapshots
  getSnapshots: () => get<CoverageSnapshot[]>('/snapshots'),
  createSnapshot: (notes?: string) => post<CoverageSnapshot>('/snapshots', { notes }),
  deleteSnapshot: (id: number) => del(`/snapshots/${id}`),

  // Threat groups
  getThreatGroups: () => get<ThreatGroup[]>('/threat-groups'),
  getThreatGroup: (id: string) => get<ThreatGroupDetail>(`/threat-groups/${id}`),
  getThreatGroupExposure: (id: string) => get<{ group_id: string; techniques: any[]; exposed_count: number; total: number }>(`/threat-groups/${id}/exposure`),
  createThreatGroup: (data: Partial<ThreatGroup> & { technique_ids?: string[] }) => post<ThreatGroup>('/threat-groups', data),
  updateThreatGroup: (id: string, data: Partial<ThreatGroup> & { technique_ids?: string[] }) => put<ThreatGroup>(`/threat-groups/${id}`, data),
  deleteThreatGroup: (id: string) => del(`/threat-groups/${id}`),
  addGroupTechniques: (id: string, technique_ids: string[]) => post<{ group_id: string; total_techniques: number }>(`/threat-groups/${id}/techniques`, { technique_ids }),
  removeGroupTechniques: (id: string, technique_ids: string[]) => del(`/threat-groups/${id}/techniques`, { technique_ids }),

  // Compliance
  getComplianceFrameworks: () => get<ComplianceFramework[]>('/compliance/frameworks'),
  getComplianceFramework: (id: string) => get<ComplianceFramework & { controls: any[] }>(`/compliance/frameworks/${id}`),
  getComplianceGap: (framework_id?: string) => {
    const q = framework_id ? `?framework_id=${framework_id}` : '';
    return get<any[]>(`/compliance/gap${q}`);
  },

  // SIGMA
  parseSigmaRule: (rule_text: string) => post<SigmaParseResult>('/sigma/parse', { rule_text }),
  importSigmaRules: (rules: string[]) => post<{ imported: number; skipped: number; detection_ids: number[] }>('/sigma/import', { rules }),

  // Exports (returns URLs to navigate to directly)
  getExportUrl: (type: 'navigator' | 'detections/csv' | 'tools/csv' | 'coverage/json') => `${BASE}/exports/${type}`,

  // Reports
  getExecutiveReport: () => get<ExecutiveReport>('/reports/executive'),
  getThreatLandscapeReport: () => get<{ generated_at: string; groups: any[] }>('/reports/threat-landscape'),
  getGapReport: () => get<{ generated_at: string; total_gaps: number; gaps: any[] }>('/reports/gaps'),

  // Risk
  getRiskScore: () => get<RiskScore>('/risk/score'),
  getRiskByTactic: () => get<RiskByTactic[]>('/risk/by-tactic'),
  getRiskByTechnique: () => get<any[]>('/risk/by-technique'),

  // API Keys
  getApiKeys: () => get<ApiKey[]>('/api-keys'),
  createApiKey: (data: { name: string; scopes?: string[]; expires_at?: string }) =>
    post<ApiKey & { key: string; message: string }>('/api-keys', data),
  updateApiKey: (id: number, data: Partial<{ name: string; scopes: string[]; expires_at: string }>) =>
    patch<ApiKey>(`/api-keys/${id}`, data),
  deleteApiKey: (id: number) => del(`/api-keys/${id}`),

  // Admin / Purge
  getPurgeableDatasets: () => get<{ datasets: Array<{ key: string; label: string; count: number }> }>('/admin/purgeable'),
  purgeDataset: (dataset: string) => del(`/admin/purge/${dataset}`) as Promise<any>,
  purgeAll: () => del('/admin/purge-all') as Promise<any>,
};
