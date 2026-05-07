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

export interface MatrixCell {
  id: string;
  name: string;
  status: 'full' | 'detected' | 'mitigated' | 'tuning' | 'planned' | 'gap';
  detection_count: number;
  detections: Array<{ id: number; name: string; severity: string }>;
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
