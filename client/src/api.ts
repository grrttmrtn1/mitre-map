import type {
  ApiKey, ArtResult, ArtTest, Assignment, AttackVersion, AuditLogEntry, Comment, ComplianceFramework,
  CoverageAttributionEntry, CoverageSnapshot, CoverageStats, Country, CoveredTechnique, DataSource, Detection, DetectionHistory, DetectionQualityScore, D3FendTechnique,
  Exercise, ExerciseDetail, ExerciseFinding, ExerciseReport, ExerciseTestRun,
  ExecutiveReport, GapTechnique, MatrixColumn, Mitigation, Motivation, OidcProvider, Procedure, ProcedureType,
  PrioritizationQueue,
  RiskByTactic, RiskScore, SigmaLibrarySearch, SigmaParseResult, SigmaRuleDetail, SigmaTemplate,
  Tactic, Tag, Technique, ThreatGroup, ThreatGroupDetail,
  TaxiiBatch, TaxiiJob, TaxiiPendingItem, TaxiiServer, TaxiiCollection,
  Tool, ToolDetail, User, WebhookConfig, AlertRule,
} from './types';

const BASE = '/api';
const STORAGE_KEY = 'mitremap_api_key';

export function getStoredApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
export function setStoredApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}
export function clearStoredApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

let _jwtToken: string | null = null;
export function setJwtToken(token: string | null) { _jwtToken = token; }
export function getJwtToken(): string | null { return _jwtToken; }

let _authErrorHandler: (() => void) | null = null;
export function onAuthError(fn: () => void) { _authErrorHandler = fn; }

function authHeaders(): Record<string, string> {
  const token = _jwtToken ?? getStoredApiKey();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauth(status: number) {
  if (status === 401) _authErrorHandler?.();
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error ?? `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  handleUnauth(res.status);
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  handleUnauth(res.status);
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  handleUnauth(res.status);
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  handleUnauth(res.status);
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

async function del(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { ...authHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  handleUnauth(res.status);
  if (!res.ok && res.status !== 204) throw new Error(await errorMessage(res));
  if (res.status === 204) return;
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('application/json') ? res.json() : undefined;
}

export const api = {
  // ATT&CK
  getTactics: () => get<Tactic[]>('/attack/tactics'),
  getTechniques: (tactic?: string, includeSubtechniques?: boolean) => {
    const params = new URLSearchParams();
    if (tactic) params.set('tactic', tactic);
    if (includeSubtechniques) params.set('include_subtechniques', 'true');
    const q = params.toString();
    return get<Technique[]>(`/attack/techniques${q ? `?${q}` : ''}`);
  },
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
  getDetectionQualityScores: () => get<DetectionQualityScore[]>('/detections/quality-scores'),
  getDetection: (id: number) => get<Detection>(`/detections/${id}`),
  getDetectionHistory: (id: number) => get<DetectionHistory>(`/detections/${id}/history`),
  createDetection: (data: Partial<Detection>) => post<Detection>('/detections', data),
  updateDetection: (id: number, data: Partial<Detection>) => put<Detection>(`/detections/${id}`, data),
  deleteDetection: (id: number) => del(`/detections/${id}`),
  importDetections: (detections: Partial<Detection>[]) => post<{ imported: number }>('/detections/import', { detections }),
  bulkUpdateDetections: (ids: number[], status: string) => patch<{ updated: number }>('/detections/bulk', { ids, status }),
  bulkDeleteDetections: (ids: number[]) => del('/detections/bulk', { ids }),
  logDetectionFire: (id: number, outcome: 'true_positive' | 'false_positive' | 'suppressed') =>
    patch<Detection>(`/detections/${id}/fire`, { outcome }),
  reviewDetection: (id: number) => patch<Detection>(`/detections/${id}/review`, {}),

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
  getCoveredTechniques: () => get<CoveredTechnique[]>('/coverage/covered'),
  getCoverageAttribution: (params?: { limit?: number; offset?: number; entity_type?: string; actor?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    if (params?.offset !== undefined) q.set('offset', String(params.offset));
    if (params?.entity_type) q.set('entity_type', params.entity_type);
    if (params?.actor) q.set('actor', params.actor);
    const qs = q.toString();
    return get<{ rows: CoverageAttributionEntry[]; total: number }>(`/coverage/attribution${qs ? `?${qs}` : ''}`);
  },

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
  updateSnapshotAnnotation: (id: number, notes: string | null) => patch<CoverageSnapshot>(`/snapshots/${id}`, { notes }),

  // Threat groups
  getThreatGroups: () => get<ThreatGroup[]>('/threat-groups'),
  getThreatGroup: (id: string) => get<ThreatGroupDetail>(`/threat-groups/${id}`),
  getThreatGroupExposure: (id: string) => get<{ group_id: string; techniques: any[]; exposed_count: number; total: number }>(`/threat-groups/${id}/exposure`),
  createThreatGroup: (data: Partial<ThreatGroup> & { technique_ids?: string[] }) => post<ThreatGroup>('/threat-groups', data),
  updateThreatGroup: (id: string, data: Partial<ThreatGroup> & { technique_ids?: string[] }) => put<ThreatGroup>(`/threat-groups/${id}`, data),
  deleteThreatGroup: (id: string) => del(`/threat-groups/${id}`),
  addGroupTechniques: (id: string, technique_ids: string[]) => post<{ group_id: string; total_techniques: number }>(`/threat-groups/${id}/techniques`, { technique_ids }),
  removeGroupTechniques: (id: string, technique_ids: string[]) => del(`/threat-groups/${id}/techniques`, { technique_ids }),
  getGroupProcedures: (id: string) => get<Procedure[]>(`/threat-groups/${id}/procedures`),
  createProcedure: (id: string, technique_id: string, data: { type: ProcedureType; content: string; source?: string }) =>
    post<Procedure>(`/threat-groups/${id}/techniques/${technique_id}/procedures`, data),
  updateProcedure: (id: string, proc_id: number, data: { type?: ProcedureType; content?: string; source?: string }) =>
    put<Procedure>(`/threat-groups/${id}/procedures/${proc_id}`, data),
  deleteProcedure: (id: string, proc_id: number) => del(`/threat-groups/${id}/procedures/${proc_id}`),

  // Compliance
  getComplianceFrameworks: () => get<ComplianceFramework[]>('/compliance/frameworks'),
  getComplianceFramework: (id: string) => get<ComplianceFramework & { controls: any[] }>(`/compliance/frameworks/${id}`),
  getComplianceGap: (framework_id?: string) => {
    const q = framework_id ? `?framework_id=${framework_id}` : '';
    return get<any[]>(`/compliance/gap${q}`);
  },

  // SIGMA
  parseSigmaRule: (rule_text: string) => post<SigmaParseResult>('/sigma/parse', { rule_text }),
  importSigmaRules: (rules: string[], source?: string, default_status?: string) =>
    post<{ imported: number; skipped: number; detection_ids: number[] }>('/sigma/import', { rules, source, default_status }),
  searchSigmaLibrary: (technique: string) => get<SigmaLibrarySearch>(`/sigma/library?technique=${encodeURIComponent(technique)}`),
  getSigmaRule: (raw_url: string) => get<SigmaRuleDetail>(`/sigma/library/rule?raw_url=${encodeURIComponent(raw_url)}`),
  getSigmaTemplate: (technique: string) => get<SigmaTemplate>(`/sigma/templates?technique=${encodeURIComponent(technique)}`),

  // Auth
  login: (email: string, password: string) => post<{ token: string; user: User }>('/auth/login', { email, password }),
  logout: () => fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include', headers: authHeaders() }),
  refreshToken: () => fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' }).then(r => r.ok ? r.json() as Promise<{ token: string }> : null),
  getMe: () => get<User>('/auth/me'),
  getOidcProviders: () => get<OidcProvider[]>('/auth/oidc/providers'),
  getOidcLoginUrl: (slug: string) => `${BASE}/auth/oidc/${slug}`,
  createOidcProvider: (data: { name: string; slug: string; issuer_url: string; client_id: string; client_secret: string; enabled?: boolean }) => post<OidcProvider>('/auth/oidc/providers', data),
  updateOidcProvider: (id: number, data: { name?: string; slug?: string; issuer_url?: string; client_id?: string; client_secret?: string; enabled?: boolean }) => put<OidcProvider>(`/auth/oidc/providers/${id}`, data),
  deleteOidcProvider: (id: number) => del(`/auth/oidc/providers/${id}`),

  // Users (admin)
  getUsers: () => get<User[]>('/users'),
  createUser: (data: { email: string; name?: string; password: string; role?: string }) => post<User>('/users', data),
  updateUser: (id: number, data: { name?: string; role?: string; is_active?: boolean }) => put<User>(`/users/${id}`, data),
  deleteUser: (id: number) => del(`/users/${id}`),
  resetUserPassword: (id: number, password: string) => post<{ message: string }>(`/users/${id}/reset-password`, { password }),

  // Data Sources
  getDataSources: () => get<DataSource[]>('/data-sources'),
  createDataSource: (data: { name: string; category: string; description?: string }) => post<DataSource>('/data-sources', data),
  updateDataSource: (id: number, data: { name?: string; category?: string; description?: string }) => put<DataSource>(`/data-sources/${id}`, data),
  deleteDataSource: (id: number) => del(`/data-sources/${id}`),
  getDataSourceTechniques: (id: number) => get<any[]>(`/data-sources/${id}/techniques`),
  addDataSourceTechnique: (id: number, technique_id: string) => post<{ ok: boolean }>(`/data-sources/${id}/techniques`, { technique_id }),
  removeDataSourceTechnique: (id: number, technique_id: string) => del(`/data-sources/${id}/techniques/${technique_id}`),
  updateDataSourceStatus: (id: number, data: { status?: string; collection_method?: string; notes?: string }) => put<DataSource>(`/data-sources/${id}/status`, data),
  getTechniqueDataSources: (technique_id: string) => get<DataSource[]>(`/data-sources/technique/${technique_id}`),
  getDataSourceAnalysis: () => get<{ total_gaps: number; gaps: any[] }>('/data-sources/analysis'),

  // ATT&CK Version
  getAttackVersion: () => get<AttackVersion>('/attack/version'),
  getDeprecatedTechniques: () => get<any[]>('/attack/deprecated'),
  getMigrationScan: () => get<any>('/attack/migration-scan'),
  previewAttackUpdate: (version?: string) => get<any>(`/attack/preview-update${version ? `?version=${encodeURIComponent(version)}` : ''}`),
  migrateDetections: () => post<any>('/attack/migrate-detections', {}),
  checkAttackUpdates: () => get<any>('/attack/check-updates'),
  applyAttackUpdate: (version?: string) => post<any>('/attack/apply-update', version ? { version } : {}),

  // Atomic Red Team
  getArtTests: () => get<ArtTest[]>('/atomic/tests'),
  getArtTestsForTechnique: (technique_id: string) => get<ArtTest[]>(`/atomic/tests/${technique_id}`),
  getArtCoverage: () => get<any>('/atomic/coverage'),
  createArtResult: (data: { detection_id: number; art_test_id: number; status?: string; notes?: string; run_by?: string }) => post<ArtResult>('/atomic/results', data),
  updateArtResult: (id: number, data: { status?: string; notes?: string; run_by?: string }) => put<ArtResult>(`/atomic/results/${id}`, data),
  deleteArtResult: (id: number) => del(`/atomic/results/${id}`),
  importArtYaml: (yaml: string) => post<{ imported: number; skipped: number; total: number }>('/atomic/import', { yaml }),
  syncArtTests: () => post<{ imported: number; skipped: number; total: number }>('/atomic/sync', {}),
  createCustomTest: (data: { technique_id: string; name: string; description?: string; platform?: string; executor_type?: string; command?: string }) => post<ArtTest>('/atomic/custom', data),
  updateCustomTest: (id: number, data: { name?: string; description?: string; platform?: string; executor_type?: string; command?: string }) => put<ArtTest>(`/atomic/custom/${id}`, data),
  deleteCustomTest: (id: number) => del(`/atomic/custom/${id}`),

  // Exports (returns URLs to navigate to directly)
  getExportUrl: (type: 'navigator' | 'detections/csv' | 'tools/csv' | 'coverage/json') => `${BASE}/exports/${type}`,
  getPptxExportUrl: () => `${BASE}/exports/report/pptx`,

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

  // Motivations
  getMotivations: () => get<Motivation[]>('/motivations'),
  createMotivation: (data: { name: string; color?: string; description?: string }) => post<Motivation>('/motivations', data),
  updateMotivation: (id: number, data: { name?: string; color?: string; description?: string }) => put<Motivation>(`/motivations/${id}`, data),
  deleteMotivation: (id: number) => del(`/motivations/${id}`),

  // Countries
  getCountries: () => get<Country[]>('/countries'),
  createCountry: (data: { name: string; color?: string; flag?: string }) => post<Country>('/countries', data),
  updateCountry: (id: number, data: { name?: string; color?: string; flag?: string }) => put<Country>(`/countries/${id}`, data),
  deleteCountry: (id: number) => del(`/countries/${id}`),

  // Exercises (Red Team / Purple Team)
  getExercises: () => get<Exercise[]>('/exercises'),
  getExercise: (id: number) => get<ExerciseDetail>(`/exercises/${id}`),
  createExercise: (data: {
    name: string; description?: string; type?: string; status?: string;
    threat_group_id?: string; scope_notes?: string; start_date?: string;
    end_date?: string; lead?: string;
  }) => post<Exercise>('/exercises', data),
  updateExercise: (id: number, data: Partial<{
    name: string; description: string; type: string; status: string;
    threat_group_id: string; scope_notes: string; start_date: string;
    end_date: string; lead: string;
  }>) => put<Exercise>(`/exercises/${id}`, data),
  deleteExercise: (id: number) => del(`/exercises/${id}`),
  addExerciseTechniques: (id: number, technique_ids: string[]) =>
    post<{ added: number }>(`/exercises/${id}/techniques`, { technique_ids }),
  removeExerciseTechnique: (id: number, technique_id: string) =>
    del(`/exercises/${id}/techniques/${technique_id}`),
  addExerciseTestRun: (id: number, data: {
    art_test_id: number; outcome?: string; blocked?: boolean; notes?: string; ran_by?: string;
  }) => post<ExerciseTestRun>(`/exercises/${id}/tests`, data),
  updateExerciseTestRun: (id: number, run_id: number, data: {
    outcome?: string; blocked?: boolean; notes?: string; ran_by?: string;
  }) => put<ExerciseTestRun>(`/exercises/${id}/tests/${run_id}`, data),
  deleteExerciseTestRun: (id: number, run_id: number) => del(`/exercises/${id}/tests/${run_id}`),
  addExerciseFinding: (id: number, data: {
    title: string; technique_id?: string; finding_type?: string;
    severity?: string; description?: string; recommendation?: string;
  }) => post<ExerciseFinding>(`/exercises/${id}/findings`, data),
  updateExerciseFinding: (id: number, finding_id: number, data: Partial<{
    title: string; technique_id: string; finding_type: string;
    severity: string; description: string; recommendation: string;
  }>) => put<ExerciseFinding>(`/exercises/${id}/findings/${finding_id}`, data),
  deleteExerciseFinding: (id: number, finding_id: number) =>
    del(`/exercises/${id}/findings/${finding_id}`),
  getExerciseReport: (id: number) => get<ExerciseReport>(`/exercises/${id}/report`),

  // Settings
  getSettingStatus: (key: string) => get<{ key: string; configured: boolean; value?: string | null }>(`/settings/${key}`),
  setSetting: (key: string, value: string | null) => put<{ key: string; configured: boolean }>(`/settings/${key}`, { value }),
  clearSetting: (key: string) => del(`/settings/${key}`),

  // Admin / Purge
  getPurgeableDatasets: () => get<{ datasets: Array<{ key: string; label: string; count: number }> }>('/admin/purgeable'),
  purgeDataset: (dataset: string) => del(`/admin/purge/${dataset}`) as Promise<any>,
  purgeAll: () => del('/admin/purge-all') as Promise<any>,

  // TAXII 2.1 Ingest
  getTaxiiServers: () => get<TaxiiServer[]>('/taxii/servers'),
  createTaxiiServer: (data: {
    name: string; url: string; api_root?: string; collection_id?: string;
    auth_type?: string; username?: string; password?: string; token?: string;
    ssl_verify?: number; auto_merge?: number; notes?: string;
  }) => post<TaxiiServer>('/taxii/servers', data),
  updateTaxiiServer: (id: number, data: Partial<{
    name: string; url: string; api_root: string; collection_id: string;
    auth_type: string; username: string; password: string; token: string;
    ssl_verify: number; auto_merge: number; notes: string;
  }>) => put<TaxiiServer>(`/taxii/servers/${id}`, data),
  deleteTaxiiServer: (id: number) => del(`/taxii/servers/${id}`),
  testTaxiiServer: (id: number) => post<{ ok: boolean; collections?: TaxiiCollection[]; error?: string }>(`/taxii/servers/${id}/test`, {}),
  fetchTaxiiServer: (id: number) => post<{ ok: boolean; message: string }>(`/taxii/servers/${id}/fetch`, {}),

  getTaxiiBatches: () => get<TaxiiBatch[]>('/taxii/batches'),
  getTaxiiBatchItems: (batchId: string) => get<TaxiiPendingItem[]>(`/taxii/batches/${batchId}/items`),
  approveTaxiiBatch: (batchId: string) => post<{ approved: number; errors: string[] }>(`/taxii/batches/${batchId}/approve`, {}),
  rejectTaxiiBatch: (batchId: string) => post<{ ok: boolean }>(`/taxii/batches/${batchId}/reject`, {}),
  approveTaxiiItem: (id: number) => post<{ ok: boolean }>(`/taxii/pending/${id}/approve`, {}),
  rejectTaxiiItem: (id: number) => post<{ ok: boolean }>(`/taxii/pending/${id}/reject`, {}),

  getTaxiiJobs: () => get<TaxiiJob[]>('/taxii/jobs'),
  createTaxiiJob: (data: { server_id: number; name: string; schedule: string; enabled?: number }) =>
    post<TaxiiJob>('/taxii/jobs', data),
  updateTaxiiJob: (id: number, data: Partial<{ name: string; schedule: string; enabled: number }>) =>
    put<TaxiiJob>(`/taxii/jobs/${id}`, data),
  deleteTaxiiJob: (id: number) => del(`/taxii/jobs/${id}`),
  runTaxiiJob: (id: number) => post<{ ok: boolean; message: string }>(`/taxii/jobs/${id}/run`, {}),

  // Webhooks
  getWebhookConfigs: () => get<WebhookConfig[]>('/webhooks/configs'),
  createWebhookConfig: (data: { name: string; url: string; secret?: string; custom_headers?: string; enabled?: boolean }) =>
    post<WebhookConfig>('/webhooks/configs', data),
  updateWebhookConfig: (id: number, data: Partial<{ name: string; url: string; secret: string; custom_headers: string; enabled: boolean }>) =>
    put<WebhookConfig>(`/webhooks/configs/${id}`, data),
  deleteWebhookConfig: (id: number) => del(`/webhooks/configs/${id}`),
  testWebhookConfig: (id: number) => post<{ ok: boolean; status?: number; error?: string }>(`/webhooks/configs/${id}/test`, {}),

  getAlertRules: () => get<AlertRule[]>('/webhooks/rules'),
  createAlertRule: (data: { name: string; type: string; threshold?: number; webhook_config_id: number; enabled?: boolean }) =>
    post<AlertRule>('/webhooks/rules', data),
  updateAlertRule: (id: number, data: Partial<{ name: string; type: string; threshold: number; webhook_config_id: number; enabled: boolean }>) =>
    put<AlertRule>(`/webhooks/rules/${id}`, data),
  deleteAlertRule: (id: number) => del(`/webhooks/rules/${id}`),

  // Settings (key lookup)
  getSetting: (key: string) => get<{ key: string; value: string | null }>(`/settings/${key}`),

  // Prioritization
  getPrioritizationQueue: () => get<PrioritizationQueue>('/prioritization/queue'),
};
