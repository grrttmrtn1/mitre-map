export interface Tactic {
  id: string;
  name: string;
  shortname: string;
  description: string;
}

export interface Technique {
  id: string;
  name: string;
  description: string;
  tactic_ids: string[];
  is_subtechnique: number;
  parent_id: string | null;
  url: string | null;
}

export interface Mitigation {
  id: string;
  name: string;
  description: string;
}

export interface D3FendTechnique {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  url: string;
}

export interface Detection {
  id: number;
  name: string;
  description: string | null;
  rule_id: string | null;
  source: string | null;
  technique_ids: string[];
  status: 'active' | 'disabled' | 'tuning' | 'planned' | 'archived';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  confidence: 'high' | 'medium' | 'low';
  false_positive_rate: string | null;
  notes: string | null;
  last_fired_at: string | null;
  true_positive_count: number;
  false_positive_count: number;
  suppressed_count: number;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tool {
  id: number;
  name: string;
  vendor: string | null;
  description: string | null;
  category: string;
  status: 'active' | 'planned' | 'deprecated';
  notes: string | null;
  d3fend_count?: number;
  mitigation_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ToolDetail extends Tool {
  d3fend_techniques: D3FendTechnique[];
  mitigations: Mitigation[];
}

export interface SubtechniqueCell {
  id: string;
  name: string;
  status: 'full' | 'detected' | 'mitigated' | 'tuning' | 'planned' | 'gap';
  detection_count: number;
  detections: Array<{ id: number; name: string; severity: string }>;
}

export interface MatrixCell {
  id: string;
  name: string;
  status: 'full' | 'detected' | 'mitigated' | 'tuning' | 'planned' | 'gap';
  detection_count: number;
  detections: Array<{ id: number; name: string; severity: string }>;
  subtechniques: SubtechniqueCell[];
  subtechnique_count: number;
  subtechnique_covered: number;
}

export interface MatrixColumn {
  tactic: Tactic;
  cells: MatrixCell[];
}

export interface CoverageStats {
  total_techniques: number;
  detected_techniques: number;
  mitigated_techniques: number;
  covered_techniques: number;
  gap_techniques: number;
  coverage_pct: number;
  detection_pct: number;
  total_detections: number;
  active_detections: number;
  tuning_detections: number;
  disabled_detections: number;
  planned_detections: number;
  total_tools: number;
  active_tools: number;
  tactic_stats: TacticStat[];
}

export interface TacticStat {
  tactic_id: string;
  tactic_name: string;
  total: number;
  detected: number;
  mitigated: number;
  covered: number;
  gap: number;
  pct: number;
}

export interface GapTechnique extends Technique {
  tactic_names: string[];
  recommended_d3fend: Array<{ id: string; name: string; category: string }>;
  recommended_mitigations: Array<{ id: string; name: string }>;
  group_count: number;
  industry_group_count: number;
  priority_score: number;
  priority_components: { group: number; industry: number; data_sources: number; mitigation_guidance: number };
}

export interface DetectionVersion {
  id: number;
  version_number: number;
  changed_by: string;
  changed_at: string;
  change_summary: string | null;
  snapshot: Detection;
  diff: Array<{ field: string; from: unknown; to: unknown }>;
}

export interface DetectionHistory {
  detection_id: number;
  versions: DetectionVersion[];
}

export interface CoveredTechnique extends Technique {
  tactic_names: string[];
  status: 'full' | 'detected' | 'mitigated';
  detections: Array<{ id: number; name: string; severity: string }>;
  tools: Array<{ id: number; name: string; category: string }>;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export interface Assignment {
  id: number;
  entity_type: string;
  entity_id: string;
  assignee: string;
  status: 'open' | 'in_progress' | 'resolved' | 'wont_fix';
  priority: 'critical' | 'high' | 'medium' | 'low';
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  entity_type: string;
  entity_id: string;
  author: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  changes: Record<string, unknown> | null;
  source_ip: string | null;
  created_at: string;
}

export interface CoverageSnapshot {
  id: number;
  taken_at: string;
  total_techniques: number;
  covered_techniques: number;
  detected_techniques: number;
  mitigated_techniques: number;
  gap_techniques: number;
  coverage_pct: number;
  active_detections: number;
  total_tools: number;
  notes: string | null;
}

export interface Motivation {
  id: number;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export interface Country {
  id: number;
  name: string;
  color: string;
  flag: string | null;
  created_at: string;
}

export type ProcedureType = 'command' | 'script' | 'description' | 'artifact' | 'reference';

export interface Procedure {
  id: number;
  group_id: string;
  technique_id: string;
  type: ProcedureType;
  content: string;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThreatGroup {
  id: string;
  name: string;
  aliases: string[];
  description: string | null;
  country: string | null;
  motivation: string | null;
  url: string | null;
  targeted_sectors: string[];
}

export interface ThreatGroupDetail extends ThreatGroup {
  techniques: Technique[];
  coverage: {
    total: number;
    covered: number;
    pct: number;
    details: Array<{ technique_id: string; technique_name: string; detected: boolean }>;
  };
}

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string | null;
  description: string | null;
  total_controls?: number;
  covered_controls?: number;
  coverage_pct?: number;
}

export interface ComplianceControl {
  id: string;
  framework_id: string;
  name: string;
  description: string | null;
  category: string | null;
  techniques?: Technique[];
  covered_techniques?: number;
  total_techniques?: number;
}

export interface RiskScore {
  score: number;
  level: 'critical' | 'high' | 'medium' | 'low';
  components: {
    coverage_gap_pct: number;
    exposed_threat_groups: number;
    critical_gaps: number;
  };
  coverage_pct: number;
  gap_count: number;
  total_techniques: number;
}

export interface RiskByTactic {
  tactic_id: string;
  tactic_name: string;
  total_techniques: number;
  covered: number;
  gap_count: number;
  coverage_pct: number;
  group_exposure_score: number;
  risk_score: number;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
}

export interface DetectionQualityScore {
  detection_id: number;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  components: {
    severity: number;
    confidence: number;
    fp_rate: number;
    tests: number;
    uniqueness: number;
  };
}

export interface SigmaLibraryItem {
  name: string;
  path: string;
  category: string;
  raw_url: string;
  html_url: string;
}

export interface SigmaLibrarySearch {
  total_count: number;
  rate_limit_remaining: number | null;
  items: SigmaLibraryItem[];
}

export interface SigmaRuleDetail {
  raw: string;
  parsed: {
    title?: string; id?: string; status?: string; level?: string;
    author?: string; date?: string; description?: string;
    tags?: string[]; references?: string[]; falsepositives?: string[];
    logsource?: Record<string, string>; detection_raw?: string;
    technique_ids: string[];
  };
}

export interface SigmaTemplate {
  technique_id: string;
  technique_name: string;
  tactic_names: string[];
  logsource: { category: string; product?: string };
  level: string;
  data_sources: string[];
  yaml: string;
}

export interface SigmaParseResult {
  title: string | undefined;
  rule_id: string | undefined;
  description: string | undefined;
  status: string;
  severity: string;
  technique_ids: string[];
  unknown_technique_ids: string[];
  raw_tags: string[];
}

export interface ApiKey {
  id: number;
  name: string;
  masked_key: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

export interface User {
  id: number;
  email: string;
  name: string | null;
  role: 'admin' | 'analyst' | 'readonly';
  is_active: number;
  created_at: string;
  last_login: string | null;
}

export interface OidcProvider {
  id: number;
  name: string;
  slug: string;
}

export interface DataSource {
  id: number;
  name: string;
  category: string;
  description: string | null;
  org_status: 'collecting' | 'partial' | 'not_collecting' | null;
  collection_method: string | null;
  org_notes: string | null;
  technique_count: number;
}

export interface ArtTest {
  id: number;
  technique_id: string;
  technique_name: string;
  test_guid: string | null;
  name: string;
  description: string | null;
  platform: string;
  executor_type: string;
  auto_generated_command: string | null;
  source: 'atomic' | 'custom';
}

export interface ArtResult {
  id: number;
  detection_id: number;
  art_test_id: number;
  status: 'untested' | 'tested' | 'validated' | 'failed';
  run_at: string | null;
  run_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttackVersion {
  id: number;
  version: string;
  name: string;
  released_at: string;
  notes: string | null;
  is_active: number;
}

export type ExerciseType = 'red_team' | 'purple_team' | 'tabletop';
export type ExerciseStatus = 'planning' | 'active' | 'completed' | 'cancelled';
export type ExerciseOutcome = 'pending' | 'detected' | 'not_detected' | 'partial' | 'n_a';
export type FindingType = 'gap' | 'detection_validated' | 'detection_failed' | 'control_weakness' | 'new_ttp';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export interface Exercise {
  id: number;
  name: string;
  description: string | null;
  type: ExerciseType;
  status: ExerciseStatus;
  threat_group_id: string | null;
  threat_group_name: string | null;
  scope_notes: string | null;
  start_date: string | null;
  end_date: string | null;
  lead: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  technique_count?: number;
  test_run_count?: number;
  detected_count?: number;
  finding_count?: number;
}

export interface ExerciseTechnique {
  technique_id: string;
  technique_name: string;
  tactic_ids: string[];
  available_tests: number;
}

export interface ExerciseTestRun {
  id: number;
  exercise_id: number;
  art_test_id: number;
  test_name: string;
  technique_id: string;
  platform: string | null;
  executor_type: string | null;
  auto_generated_command: string | null;
  test_description: string | null;
  outcome: ExerciseOutcome;
  blocked: boolean;
  ran_at: string | null;
  ran_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseFinding {
  id: number;
  exercise_id: number;
  technique_id: string | null;
  technique_name: string | null;
  title: string;
  finding_type: FindingType;
  severity: FindingSeverity;
  description: string | null;
  recommendation: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseDetail extends Exercise {
  techniques: ExerciseTechnique[];
  test_runs: ExerciseTestRun[];
  findings: ExerciseFinding[];
}

export interface ExerciseReport {
  generated_at: string;
  exercise: {
    id: number;
    name: string;
    type: ExerciseType;
    status: ExerciseStatus;
    threat_group_name: string | null;
    start_date: string | null;
    end_date: string | null;
    lead: string | null;
    scope_notes: string | null;
  };
  summary: {
    total_techniques: number;
    total_runs: number;
    detected: number;
    not_detected: number;
    partial: number;
    blocked: number;
    detection_rate: number;
    total_findings: number;
    critical_findings: number;
  };
  technique_breakdown: Array<{
    technique_id: string;
    technique_name: string;
    tactic_ids: string[];
    total_runs: number;
    detected: number;
    not_detected: number;
    partial: number;
    status: 'untested' | 'detected' | 'partial' | 'not_detected';
  }>;
  gaps: ExerciseTechnique[];
  findings: ExerciseFinding[];
  findings_by_severity: Array<{ severity: string; count: number }>;
}

export interface ExecutiveReport {
  generated_at: string;
  summary: {
    total_techniques: number;
    covered_techniques: number;
    coverage_pct: number;
    gap_count: number;
    active_detections: number;
    total_detections: number;
    active_tools: number;
  };
  trend: { coverage_change: number; detection_change: number } | null;
  severity_breakdown: Array<{ severity: string; count: number }>;
  tactic_coverage: Array<{ id: string; name: string; total: number; covered: number; pct: number }>;
  top_gaps: Technique[];
}

// ── TAXII 2.1 Ingest ─────────────────────────────────────────────────────────

export type TaxiiAuthType = 'none' | 'basic' | 'bearer';

export interface TaxiiServer {
  id: number;
  name: string;
  url: string;
  api_root: string | null;
  collection_id: string | null;
  auth_type: TaxiiAuthType;
  ssl_verify: number;
  auto_merge: number;
  notes: string | null;
  last_fetch_status: 'running' | 'success' | 'error' | null;
  last_fetch_error: string | null;
  last_fetch_items: number | null;
  last_fetch_skipped: number | null;
  last_fetch_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxiiCollection {
  id: string;
  title: string;
  description?: string;
  can_read: boolean;
  can_write: boolean;
}

export interface TaxiiJob {
  id: number;
  server_id: number;
  server_name: string;
  name: string;
  schedule: string;
  enabled: number;
  last_run: string | null;
  last_status: 'success' | 'error' | 'running' | 'pending' | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export type TaxiiPendingAction = 'create_group' | 'update_group' | 'create_technique' | 'link_technique';
export type TaxiiPendingStatus = 'pending' | 'approved' | 'rejected';

export interface TaxiiPendingItem {
  id: number;
  job_id: number | null;
  server_id: number;
  batch_id: string;
  stix_id: string;
  stix_type: string;
  name: string | null;
  proposed_action: TaxiiPendingAction;
  proposed_data: Record<string, unknown>;
  status: TaxiiPendingStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface TaxiiBatch {
  batch_id: string;
  server_id: number;
  server_name: string;
  created_at: string;
  total: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
}

export interface TaxiiFetchResult {
  batch_id: string;
  items_created: number;
  groups_found: number;
  techniques_found: number;
  relationships_found: number;
  skipped: number;
}

export interface WebhookConfig {
  id: number;
  name: string;
  url: string;
  secret: string | null;
  custom_headers: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type AlertRuleType = 'coverage_threshold' | 'detection_validation_failed' | 'new_uncovered_group_technique';

export interface AlertRule {
  id: number;
  name: string;
  type: AlertRuleType;
  threshold: number | null;
  webhook_config_id: number;
  webhook_name: string;
  webhook_url: string;
  enabled: boolean;
  last_notified_at: string | null;
  created_at: string;
  updated_at: string;
}
