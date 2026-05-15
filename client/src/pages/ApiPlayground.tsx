import { useState, useMemo } from 'react';
import { getStoredApiKey } from '../api';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface Param {
  name: string;
  description: string;
  required?: boolean;
  example?: string;
}

interface EndpointDef {
  id: string;
  method: Method;
  path: string;
  description: string;
  pathParams?: Param[];
  queryParams?: Param[];
  body?: { description: string; example: object };
}

interface Group {
  name: string;
  color: string;
  endpoints: EndpointDef[];
}

const METHOD_COLORS: Record<Method, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border border-red-500/30',
  PATCH: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
};

const STATUS_COLOR = (s: number) =>
  s >= 500 ? 'text-red-400' : s >= 400 ? 'text-amber-400' : s >= 200 ? 'text-emerald-400' : 'text-gray-500 dark:text-slate-400';

const GROUPS: Group[] = [
  {
    name: 'Health',
    color: 'text-gray-500 dark:text-slate-400',
    endpoints: [
      { id: 'health', method: 'GET', path: '/api/health', description: 'Server health check' },
    ],
  },
  {
    name: 'Auth',
    color: 'text-green-400',
    endpoints: [
      {
        id: 'auth-login',
        method: 'POST',
        path: '/api/auth/login',
        description: 'Login with email and password — returns JWT access token',
        body: { description: 'Login credentials', example: { email: 'admin@example.com', password: 'your-password' } },
      },
      { id: 'auth-me', method: 'GET', path: '/api/auth/me', description: 'Get current authenticated user' },
      { id: 'auth-refresh', method: 'POST', path: '/api/auth/refresh', description: 'Refresh access token using HTTP-only cookie' },
      { id: 'auth-logout', method: 'POST', path: '/api/auth/logout', description: 'Logout and invalidate refresh token cookie' },
      { id: 'auth-oidc-providers', method: 'GET', path: '/api/auth/oidc/providers', description: 'List enabled OIDC SSO providers' },
      {
        id: 'auth-oidc-create',
        method: 'POST',
        path: '/api/auth/oidc/providers',
        description: 'Create an OIDC SSO provider (admin)',
        body: {
          description: 'Provider configuration',
          example: { name: 'Okta', slug: 'okta', issuer_url: 'https://dev-xxx.okta.com', client_id: 'CLIENT_ID', client_secret: 'CLIENT_SECRET', enabled: true },
        },
      },
      {
        id: 'auth-oidc-update',
        method: 'PUT',
        path: '/api/auth/oidc/providers/:id',
        description: 'Update an OIDC provider',
        pathParams: [{ name: 'id', description: 'Provider ID', required: true, example: '1' }],
        body: { description: 'Fields to update', example: { enabled: false } },
      },
      {
        id: 'auth-oidc-delete',
        method: 'DELETE',
        path: '/api/auth/oidc/providers/:id',
        description: 'Delete an OIDC provider',
        pathParams: [{ name: 'id', description: 'Provider ID', required: true, example: '1' }],
      },
    ],
  },
  {
    name: 'Users',
    color: 'text-green-300',
    endpoints: [
      { id: 'users-list', method: 'GET', path: '/api/users', description: 'List all users (admin)' },
      {
        id: 'users-create',
        method: 'POST',
        path: '/api/users',
        description: 'Create a user (admin)',
        body: { description: 'User details', example: { email: 'analyst@example.com', name: 'Jane Analyst', password: 'securepassword', role: 'analyst' } },
      },
      {
        id: 'users-update',
        method: 'PUT',
        path: '/api/users/:id',
        description: 'Update a user',
        pathParams: [{ name: 'id', description: 'User ID', required: true, example: '1' }],
        body: { description: 'Updated fields', example: { role: 'admin', is_active: true } },
      },
      {
        id: 'users-delete',
        method: 'DELETE',
        path: '/api/users/:id',
        description: 'Delete a user',
        pathParams: [{ name: 'id', description: 'User ID', required: true, example: '1' }],
      },
      {
        id: 'users-reset-password',
        method: 'POST',
        path: '/api/users/:id/reset-password',
        description: 'Reset a user password (admin)',
        pathParams: [{ name: 'id', description: 'User ID', required: true, example: '1' }],
        body: { description: 'New password', example: { password: 'newpassword123' } },
      },
    ],
  },
  {
    name: 'ATT&CK',
    color: 'text-red-400',
    endpoints: [
      { id: 'attack-tactics', method: 'GET', path: '/api/attack/tactics', description: 'List all ATT&CK tactics' },
      {
        id: 'attack-techniques',
        method: 'GET',
        path: '/api/attack/techniques',
        description: 'List all ATT&CK techniques',
        queryParams: [{ name: 'tactic', description: 'Filter by tactic ID', example: 'TA0001' }],
      },
      {
        id: 'attack-technique-id',
        method: 'GET',
        path: '/api/attack/techniques/:id',
        description: 'Get a specific ATT&CK technique',
        pathParams: [{ name: 'id', description: 'Technique ID', required: true, example: 'T1055' }],
      },
      { id: 'attack-mitigations', method: 'GET', path: '/api/attack/mitigations', description: 'List all ATT&CK mitigations' },
      {
        id: 'attack-mitigation-id',
        method: 'GET',
        path: '/api/attack/mitigations/:id',
        description: 'Get a specific ATT&CK mitigation',
        pathParams: [{ name: 'id', description: 'Mitigation ID', required: true, example: 'M1049' }],
      },
    ],
  },
  {
    name: 'D3FEND',
    color: 'text-cyan-400',
    endpoints: [
      { id: 'd3fend-techniques', method: 'GET', path: '/api/d3fend/techniques', description: 'List all D3FEND techniques' },
      {
        id: 'd3fend-technique-id',
        method: 'GET',
        path: '/api/d3fend/techniques/:id',
        description: 'Get a specific D3FEND technique',
        pathParams: [{ name: 'id', description: 'D3FEND technique ID', required: true, example: 'D3-PSA' }],
      },
      {
        id: 'd3fend-mappings',
        method: 'GET',
        path: '/api/d3fend/mappings/:attackId',
        description: 'Get D3FEND techniques that counter an ATT&CK technique',
        pathParams: [{ name: 'attackId', description: 'ATT&CK technique ID', required: true, example: 'T1055' }],
      },
    ],
  },
  {
    name: 'Detections',
    color: 'text-orange-400',
    endpoints: [
      {
        id: 'detections-list',
        method: 'GET',
        path: '/api/detections',
        description: 'List detections with optional filters',
        queryParams: [
          { name: 'status', description: 'Filter by status', example: 'active' },
          { name: 'source', description: 'Filter by source', example: 'splunk' },
          { name: 'severity', description: 'Filter by severity', example: 'high' },
          { name: 'technique', description: 'Filter by ATT&CK technique ID', example: 'T1055' },
        ],
      },
      {
        id: 'detections-get',
        method: 'GET',
        path: '/api/detections/:id',
        description: 'Get a specific detection',
        pathParams: [{ name: 'id', description: 'Detection ID', required: true, example: '1' }],
      },
      {
        id: 'detections-create',
        method: 'POST',
        path: '/api/detections',
        description: 'Create a new detection',
        body: {
          description: 'Detection object — name and technique_ids are required',
          example: {
            name: 'Suspicious Process Injection',
            description: 'Detects process injection activity',
            rule_id: 'RULE-001',
            source: 'splunk',
            technique_ids: ['T1055'],
            status: 'active',
            severity: 'high',
            confidence: 'high',
          },
        },
      },
      {
        id: 'detections-update',
        method: 'PUT',
        path: '/api/detections/:id',
        description: 'Update an existing detection',
        pathParams: [{ name: 'id', description: 'Detection ID', required: true, example: '1' }],
        body: {
          description: 'Updated detection fields',
          example: {
            name: 'Updated Detection Name',
            technique_ids: ['T1055'],
            status: 'active',
            severity: 'medium',
          },
        },
      },
      {
        id: 'detections-delete',
        method: 'DELETE',
        path: '/api/detections/:id',
        description: 'Delete a detection',
        pathParams: [{ name: 'id', description: 'Detection ID', required: true, example: '1' }],
      },
      {
        id: 'detections-bulk-update',
        method: 'PATCH',
        path: '/api/detections/bulk',
        description: 'Bulk update detection status',
        body: { description: 'ids array and new status', example: { ids: [1, 2, 3], status: 'archived' } },
      },
      {
        id: 'detections-bulk-delete',
        method: 'DELETE',
        path: '/api/detections/bulk',
        description: 'Bulk delete detections',
        body: { description: 'ids array', example: { ids: [1, 2, 3] } },
      },
      {
        id: 'detections-import',
        method: 'POST',
        path: '/api/detections/import',
        description: 'Import multiple detections',
        body: {
          description: 'Array of detection objects',
          example: {
            detections: [
              { name: 'Detection 1', technique_ids: ['T1055'], source: 'splunk', status: 'active', severity: 'high' },
            ],
          },
        },
      },
      {
        id: 'detections-quality-scores',
        method: 'GET',
        path: '/api/detections/quality-scores',
        description: 'Quality score (0–100, grade A–F) for every detection — computed from severity, confidence, empirical FP rate, test results, and technique uniqueness',
      },
      {
        id: 'detections-history',
        method: 'GET',
        path: '/api/detections/:id/history',
        description: 'Version history with per-version field diffs (newest first)',
        pathParams: [{ name: 'id', description: 'Detection ID', required: true, example: '1' }],
      },
      {
        id: 'detections-fire',
        method: 'PATCH',
        path: '/api/detections/:id/fire',
        description: 'Log a fire event — increments the true_positive, false_positive, or suppressed counter and stamps last_fired_at',
        pathParams: [{ name: 'id', description: 'Detection ID', required: true, example: '1' }],
        body: { description: 'Fire outcome', example: { outcome: 'true_positive' } },
      },
      {
        id: 'detections-review',
        method: 'PATCH',
        path: '/api/detections/:id/review',
        description: 'Stamp last_reviewed_at to the current timestamp',
        pathParams: [{ name: 'id', description: 'Detection ID', required: true, example: '1' }],
      },
    ],
  },
  {
    name: 'Tools',
    color: 'text-violet-400',
    endpoints: [
      { id: 'tools-list', method: 'GET', path: '/api/tools', description: 'List all security tools' },
      {
        id: 'tools-get',
        method: 'GET',
        path: '/api/tools/:id',
        description: 'Get a specific tool',
        pathParams: [{ name: 'id', description: 'Tool ID', required: true, example: '1' }],
      },
      {
        id: 'tools-create',
        method: 'POST',
        path: '/api/tools',
        description: 'Create a new tool',
        body: {
          description: 'Tool object',
          example: { name: 'CrowdStrike Falcon', vendor: 'CrowdStrike', category: 'EDR', description: 'Endpoint detection and response', d3fend_ids: [], mitigation_ids: [] },
        },
      },
      {
        id: 'tools-update',
        method: 'PUT',
        path: '/api/tools/:id',
        description: 'Update a tool',
        pathParams: [{ name: 'id', description: 'Tool ID', required: true, example: '1' }],
        body: { description: 'Updated tool fields', example: { name: 'Updated Tool', vendor: 'Vendor', category: 'EDR' } },
      },
      {
        id: 'tools-delete',
        method: 'DELETE',
        path: '/api/tools/:id',
        description: 'Delete a tool',
        pathParams: [{ name: 'id', description: 'Tool ID', required: true, example: '1' }],
      },
    ],
  },
  {
    name: 'Coverage',
    color: 'text-emerald-400',
    endpoints: [
      { id: 'coverage-stats', method: 'GET', path: '/api/coverage/stats', description: 'Coverage statistics summary' },
      { id: 'coverage-matrix', method: 'GET', path: '/api/coverage/matrix', description: 'Coverage matrix by tactic' },
      { id: 'coverage-gaps', method: 'GET', path: '/api/coverage/gaps', description: 'Uncovered techniques (gaps)' },
    ],
  },
  {
    name: 'Tags',
    color: 'text-pink-400',
    endpoints: [
      { id: 'tags-list', method: 'GET', path: '/api/tags', description: 'List all tags' },
      {
        id: 'tags-create',
        method: 'POST',
        path: '/api/tags',
        description: 'Create a tag',
        body: { description: 'Tag object', example: { name: 'Critical', color: '#ef4444' } },
      },
      {
        id: 'tags-update',
        method: 'PUT',
        path: '/api/tags/:id',
        description: 'Update a tag',
        pathParams: [{ name: 'id', description: 'Tag ID', required: true, example: '1' }],
        body: { description: 'Updated tag', example: { name: 'Updated', color: '#3b82f6' } },
      },
      {
        id: 'tags-delete',
        method: 'DELETE',
        path: '/api/tags/:id',
        description: 'Delete a tag',
        pathParams: [{ name: 'id', description: 'Tag ID', required: true, example: '1' }],
      },
      {
        id: 'tags-entity-get',
        method: 'GET',
        path: '/api/tags/:entityType/:entityId',
        description: 'Get tags for an entity',
        pathParams: [
          { name: 'entityType', description: 'Entity type', required: true, example: 'detection' },
          { name: 'entityId', description: 'Entity ID', required: true, example: '1' },
        ],
      },
      {
        id: 'tags-entity-add',
        method: 'POST',
        path: '/api/tags/:entityType/:entityId',
        description: 'Add a tag to an entity',
        pathParams: [
          { name: 'entityType', description: 'Entity type', required: true, example: 'detection' },
          { name: 'entityId', description: 'Entity ID', required: true, example: '1' },
        ],
        body: { description: 'Tag ID to add', example: { tag_id: 1 } },
      },
      {
        id: 'tags-entity-remove',
        method: 'DELETE',
        path: '/api/tags/:entityType/:entityId/:tagId',
        description: 'Remove a tag from an entity',
        pathParams: [
          { name: 'entityType', description: 'Entity type', required: true, example: 'detection' },
          { name: 'entityId', description: 'Entity ID', required: true, example: '1' },
          { name: 'tagId', description: 'Tag ID', required: true, example: '1' },
        ],
      },
    ],
  },
  {
    name: 'Assignments',
    color: 'text-yellow-400',
    endpoints: [
      { id: 'assignments-list', method: 'GET', path: '/api/assignments', description: 'List all assignments' },
      {
        id: 'assignments-entity',
        method: 'GET',
        path: '/api/assignments/:entityType/:entityId',
        description: 'Get assignments for an entity',
        pathParams: [
          { name: 'entityType', description: 'Entity type', required: true, example: 'detection' },
          { name: 'entityId', description: 'Entity ID', required: true, example: '1' },
        ],
      },
      {
        id: 'assignments-create',
        method: 'POST',
        path: '/api/assignments',
        description: 'Create an assignment',
        body: {
          description: 'Assignment object',
          example: { entity_type: 'detection', entity_id: 1, assignee: 'john.doe', due_date: '2025-12-31' },
        },
      },
      {
        id: 'assignments-update',
        method: 'PUT',
        path: '/api/assignments/:id',
        description: 'Update an assignment',
        pathParams: [{ name: 'id', description: 'Assignment ID', required: true, example: '1' }],
        body: { description: 'Updated assignment', example: { assignee: 'jane.doe', status: 'completed' } },
      },
      {
        id: 'assignments-delete',
        method: 'DELETE',
        path: '/api/assignments/:id',
        description: 'Delete an assignment',
        pathParams: [{ name: 'id', description: 'Assignment ID', required: true, example: '1' }],
      },
    ],
  },
  {
    name: 'Audit',
    color: 'text-gray-700 dark:text-slate-300',
    endpoints: [
      {
        id: 'audit-list',
        method: 'GET',
        path: '/api/audit',
        description: 'List audit log entries',
        queryParams: [
          { name: 'limit', description: 'Max entries to return', example: '50' },
          { name: 'offset', description: 'Pagination offset', example: '0' },
        ],
      },
      {
        id: 'audit-entity',
        method: 'GET',
        path: '/api/audit/:entityType/:entityId',
        description: 'Get audit log for a specific entity',
        pathParams: [
          { name: 'entityType', description: 'Entity type', required: true, example: 'detection' },
          { name: 'entityId', description: 'Entity ID', required: true, example: '1' },
        ],
      },
    ],
  },
  {
    name: 'Comments',
    color: 'text-teal-400',
    endpoints: [
      {
        id: 'comments-list',
        method: 'GET',
        path: '/api/comments/:entityType/:entityId',
        description: 'Get comments for an entity',
        pathParams: [
          { name: 'entityType', description: 'Entity type', required: true, example: 'detection' },
          { name: 'entityId', description: 'Entity ID', required: true, example: '1' },
        ],
      },
      {
        id: 'comments-create',
        method: 'POST',
        path: '/api/comments/:entityType/:entityId',
        description: 'Add a comment to an entity',
        pathParams: [
          { name: 'entityType', description: 'Entity type', required: true, example: 'detection' },
          { name: 'entityId', description: 'Entity ID', required: true, example: '1' },
        ],
        body: { description: 'Comment body', example: { text: 'Needs tuning for FP reduction', author: 'analyst1' } },
      },
      {
        id: 'comments-update',
        method: 'PUT',
        path: '/api/comments/:id',
        description: 'Update a comment',
        pathParams: [{ name: 'id', description: 'Comment ID', required: true, example: '1' }],
        body: { description: 'Updated comment', example: { text: 'Updated comment text' } },
      },
      {
        id: 'comments-delete',
        method: 'DELETE',
        path: '/api/comments/:id',
        description: 'Delete a comment',
        pathParams: [{ name: 'id', description: 'Comment ID', required: true, example: '1' }],
      },
    ],
  },
  {
    name: 'Snapshots',
    color: 'text-indigo-400',
    endpoints: [
      { id: 'snapshots-list', method: 'GET', path: '/api/snapshots', description: 'List coverage snapshots' },
      {
        id: 'snapshots-create',
        method: 'POST',
        path: '/api/snapshots',
        description: 'Create a coverage snapshot',
        body: { description: 'Optional snapshot label', example: { label: 'Q1 2025 Baseline' } },
      },
      {
        id: 'snapshots-delete',
        method: 'DELETE',
        path: '/api/snapshots/:id',
        description: 'Delete a snapshot',
        pathParams: [{ name: 'id', description: 'Snapshot ID', required: true, example: '1' }],
      },
    ],
  },
  {
    name: 'Threat Groups',
    color: 'text-rose-400',
    endpoints: [
      { id: 'threats-list', method: 'GET', path: '/api/threat-groups', description: 'List all threat groups' },
      {
        id: 'threats-create',
        method: 'POST',
        path: '/api/threat-groups',
        description: 'Create a threat group',
        body: {
          description: 'Threat group — id and name required',
          example: { id: 'G9999', name: 'APT-Example', aliases: ['Example APT'], description: 'Example group', country: 'Unknown', motivation: 'Espionage', targeted_sectors: ['Finance', 'Energy'], technique_ids: [] },
        },
      },
      {
        id: 'threats-get',
        method: 'GET',
        path: '/api/threat-groups/:id',
        description: 'Get a threat group with coverage details',
        pathParams: [{ name: 'id', description: 'Threat group ID', required: true, example: 'G0016' }],
      },
      {
        id: 'threats-update',
        method: 'PUT',
        path: '/api/threat-groups/:id',
        description: 'Update a threat group',
        pathParams: [{ name: 'id', description: 'Threat group ID', required: true, example: 'G0016' }],
        body: { description: 'Updated fields', example: { name: 'Updated Name', motivation: 'Financial' } },
      },
      {
        id: 'threats-delete',
        method: 'DELETE',
        path: '/api/threat-groups/:id',
        description: 'Delete a threat group',
        pathParams: [{ name: 'id', description: 'Threat group ID', required: true, example: 'G0016' }],
      },
      {
        id: 'threats-add-techniques',
        method: 'POST',
        path: '/api/threat-groups/:id/techniques',
        description: 'Add techniques to a threat group',
        pathParams: [{ name: 'id', description: 'Threat group ID', required: true, example: 'G0016' }],
        body: { description: 'Techniques to add', example: { technique_ids: ['T1055', 'T1059'] } },
      },
      {
        id: 'threats-remove-techniques',
        method: 'DELETE',
        path: '/api/threat-groups/:id/techniques',
        description: 'Remove techniques from a threat group',
        pathParams: [{ name: 'id', description: 'Threat group ID', required: true, example: 'G0016' }],
        body: { description: 'Techniques to remove', example: { technique_ids: ['T1055'] } },
      },
      {
        id: 'threats-exposure',
        method: 'GET',
        path: '/api/threat-groups/:id/exposure',
        description: 'Get exposure analysis for a threat group',
        pathParams: [{ name: 'id', description: 'Threat group ID', required: true, example: 'G0016' }],
      },
    ],
  },
  {
    name: 'Compliance',
    color: 'text-amber-400',
    endpoints: [
      { id: 'compliance-frameworks', method: 'GET', path: '/api/compliance/frameworks', description: 'List compliance frameworks' },
      {
        id: 'compliance-framework-id',
        method: 'GET',
        path: '/api/compliance/frameworks/:id',
        description: 'Get a specific compliance framework',
        pathParams: [{ name: 'id', description: 'Framework ID', required: true, example: 'NIST-CSF' }],
      },
      { id: 'compliance-controls', method: 'GET', path: '/api/compliance/controls', description: 'List compliance controls' },
      { id: 'compliance-gap', method: 'GET', path: '/api/compliance/gap', description: 'Compliance gap analysis' },
    ],
  },
  {
    name: 'Sigma',
    color: 'text-sky-400',
    endpoints: [
      {
        id: 'sigma-parse',
        method: 'POST',
        path: '/api/sigma/parse',
        description: 'Parse a Sigma rule YAML string',
        body: { description: 'Sigma rule YAML', example: { rule: 'title: Example\nstatus: stable\nlogsource:\n  category: process_creation\ndetection:\n  selection:\n    Image: \'*\\\\powershell.exe\'\n  condition: selection' } },
      },
      {
        id: 'sigma-import',
        method: 'POST',
        path: '/api/sigma/import',
        description: 'Parse and import a Sigma rule as a detection',
        body: { description: 'Sigma rule YAML', example: { rule: 'title: Example\nstatus: stable\nlogsource:\n  category: process_creation\ndetection:\n  selection:\n    Image: \'*\\\\powershell.exe\'\n  condition: selection' } },
      },
    ],
  },
  {
    name: 'Exports',
    color: 'text-lime-400',
    endpoints: [
      { id: 'export-navigator', method: 'GET', path: '/api/exports/navigator', description: 'ATT&CK Navigator layer JSON' },
      { id: 'export-detections-csv', method: 'GET', path: '/api/exports/detections/csv', description: 'Detections as CSV' },
      { id: 'export-tools-csv', method: 'GET', path: '/api/exports/tools/csv', description: 'Tools as CSV' },
      { id: 'export-coverage-json', method: 'GET', path: '/api/exports/coverage/json', description: 'Coverage matrix as JSON' },
    ],
  },
  {
    name: 'Reports',
    color: 'text-blue-400',
    endpoints: [
      { id: 'reports-executive', method: 'GET', path: '/api/reports/executive', description: 'Executive summary report' },
      { id: 'reports-threat-landscape', method: 'GET', path: '/api/reports/threat-landscape', description: 'Threat landscape report' },
      { id: 'reports-gaps', method: 'GET', path: '/api/reports/gaps', description: 'Gap prioritization report' },
    ],
  },
  {
    name: 'Risk',
    color: 'text-orange-300',
    endpoints: [
      { id: 'risk-score', method: 'GET', path: '/api/risk/score', description: 'Overall risk score' },
      { id: 'risk-by-tactic', method: 'GET', path: '/api/risk/by-tactic', description: 'Risk scores by tactic' },
      { id: 'risk-by-technique', method: 'GET', path: '/api/risk/by-technique', description: 'Risk scores by technique' },
    ],
  },
  {
    name: 'API Keys',
    color: 'text-gray-700 dark:text-slate-300',
    endpoints: [
      { id: 'apikeys-list', method: 'GET', path: '/api/api-keys', description: 'List API keys' },
      {
        id: 'apikeys-create',
        method: 'POST',
        path: '/api/api-keys',
        description: 'Create a new API key',
        body: { description: 'API key details', example: { name: 'CI Pipeline Key', scopes: ['read'] } },
      },
      {
        id: 'apikeys-update',
        method: 'PATCH',
        path: '/api/api-keys/:id',
        description: 'Update an API key',
        pathParams: [{ name: 'id', description: 'API key ID', required: true, example: '1' }],
        body: { description: 'Updated key fields', example: { name: 'Renamed Key', active: false } },
      },
      {
        id: 'apikeys-delete',
        method: 'DELETE',
        path: '/api/api-keys/:id',
        description: 'Revoke an API key',
        pathParams: [{ name: 'id', description: 'API key ID', required: true, example: '1' }],
      },
    ],
  },
  {
    name: 'Motivations',
    color: 'text-fuchsia-400',
    endpoints: [
      { id: 'motivations-list', method: 'GET', path: '/api/motivations', description: 'List all threat actor motivations' },
      {
        id: 'motivations-create',
        method: 'POST',
        path: '/api/motivations',
        description: 'Create a motivation',
        body: { description: 'Motivation details', example: { name: 'Financial', color: '#f59e0b', description: 'Financially motivated attacks' } },
      },
      {
        id: 'motivations-update',
        method: 'PUT',
        path: '/api/motivations/:id',
        description: 'Update a motivation',
        pathParams: [{ name: 'id', description: 'Motivation ID', required: true, example: '1' }],
        body: { description: 'Updated fields', example: { name: 'Financial Gain', color: '#f59e0b' } },
      },
      {
        id: 'motivations-delete',
        method: 'DELETE',
        path: '/api/motivations/:id',
        description: 'Delete a motivation',
        pathParams: [{ name: 'id', description: 'Motivation ID', required: true, example: '1' }],
      },
    ],
  },
  {
    name: 'Countries',
    color: 'text-blue-300',
    endpoints: [
      { id: 'countries-list', method: 'GET', path: '/api/countries', description: 'List all countries' },
      {
        id: 'countries-create',
        method: 'POST',
        path: '/api/countries',
        description: 'Create a country',
        body: { description: 'Country details', example: { name: 'Russia', color: '#ef4444', flag: '🇷🇺' } },
      },
      {
        id: 'countries-update',
        method: 'PUT',
        path: '/api/countries/:id',
        description: 'Update a country',
        pathParams: [{ name: 'id', description: 'Country ID', required: true, example: '1' }],
        body: { description: 'Updated fields', example: { name: 'Russian Federation' } },
      },
      {
        id: 'countries-delete',
        method: 'DELETE',
        path: '/api/countries/:id',
        description: 'Delete a country',
        pathParams: [{ name: 'id', description: 'Country ID', required: true, example: '1' }],
      },
    ],
  },
  {
    name: 'Data Sources',
    color: 'text-teal-300',
    endpoints: [
      { id: 'datasources-list', method: 'GET', path: '/api/data-sources', description: 'List ATT&CK data sources with org collection status' },
      {
        id: 'datasources-create',
        method: 'POST',
        path: '/api/data-sources',
        description: 'Create a custom data source',
        body: { description: 'Data source details', example: { name: 'Windows Event Logs', category: 'Windows', description: 'Standard Windows security event logs' } },
      },
      {
        id: 'datasources-update',
        method: 'PUT',
        path: '/api/data-sources/:id',
        description: 'Update a data source',
        pathParams: [{ name: 'id', description: 'Data source ID', required: true, example: '1' }],
        body: { description: 'Updated fields', example: { name: 'Updated Name', category: 'Windows' } },
      },
      {
        id: 'datasources-delete',
        method: 'DELETE',
        path: '/api/data-sources/:id',
        description: 'Delete a data source',
        pathParams: [{ name: 'id', description: 'Data source ID', required: true, example: '1' }],
      },
      {
        id: 'datasources-techniques',
        method: 'GET',
        path: '/api/data-sources/:id/techniques',
        description: 'Get ATT&CK techniques associated with a data source',
        pathParams: [{ name: 'id', description: 'Data source ID', required: true, example: '1' }],
      },
      {
        id: 'datasources-techniques-add',
        method: 'POST',
        path: '/api/data-sources/:id/techniques',
        description: 'Associate a technique with a data source',
        pathParams: [{ name: 'id', description: 'Data source ID', required: true, example: '1' }],
        body: { description: 'Technique to associate', example: { technique_id: 'T1059' } },
      },
      {
        id: 'datasources-techniques-remove',
        method: 'DELETE',
        path: '/api/data-sources/:id/techniques/:technique_id',
        description: 'Remove a technique association from a data source',
        pathParams: [
          { name: 'id', description: 'Data source ID', required: true, example: '1' },
          { name: 'technique_id', description: 'ATT&CK technique ID', required: true, example: 'T1059' },
        ],
      },
      {
        id: 'datasources-status',
        method: 'PUT',
        path: '/api/data-sources/:id/status',
        description: 'Update org collection status for a data source',
        pathParams: [{ name: 'id', description: 'Data source ID', required: true, example: '1' }],
        body: { description: 'Collection status', example: { status: 'collecting', collection_method: 'Sysmon', notes: 'Deployed via GPO' } },
      },
      {
        id: 'datasources-by-technique',
        method: 'GET',
        path: '/api/data-sources/technique/:technique_id',
        description: 'Get data sources for a specific technique',
        pathParams: [{ name: 'technique_id', description: 'ATT&CK technique ID', required: true, example: 'T1059' }],
      },
      { id: 'datasources-analysis', method: 'GET', path: '/api/data-sources/analysis', description: 'Gap analysis — uncovered techniques with data source context' },
    ],
  },
  {
    name: 'Atomic Tests',
    color: 'text-orange-300',
    endpoints: [
      { id: 'atomic-tests', method: 'GET', path: '/api/atomic/tests', description: 'List all Atomic Red Team tests' },
      {
        id: 'atomic-tests-technique',
        method: 'GET',
        path: '/api/atomic/tests/:technique_id',
        description: 'Get Atomic tests for a specific technique',
        pathParams: [{ name: 'technique_id', description: 'ATT&CK technique ID', required: true, example: 'T1059' }],
      },
      { id: 'atomic-coverage', method: 'GET', path: '/api/atomic/coverage', description: 'Coverage summary — techniques with Atomic tests' },
      {
        id: 'atomic-results-create',
        method: 'POST',
        path: '/api/atomic/results',
        description: 'Record a test execution result',
        body: { description: 'Test result', example: { test_id: 'abc123', technique_id: 'T1059', status: 'pass', executor: 'analyst@example.com', notes: 'Completed successfully' } },
      },
      {
        id: 'atomic-results-update',
        method: 'PUT',
        path: '/api/atomic/results/:id',
        description: 'Update a test result',
        pathParams: [{ name: 'id', description: 'Result ID', required: true, example: '1' }],
        body: { description: 'Updated result', example: { status: 'fail', notes: 'EDR blocked execution' } },
      },
      {
        id: 'atomic-results-delete',
        method: 'DELETE',
        path: '/api/atomic/results/:id',
        description: 'Delete a test result',
        pathParams: [{ name: 'id', description: 'Result ID', required: true, example: '1' }],
      },
      {
        id: 'atomic-import',
        method: 'POST',
        path: '/api/atomic/import',
        description: 'Import Atomic Red Team test definitions from JSON',
        body: { description: 'Array of ART test objects', example: { tests: [] } },
      },
    ],
  },
  {
    name: 'Webhooks',
    color: 'text-pink-300',
    endpoints: [
      { id: 'webhooks-configs-list', method: 'GET', path: '/api/webhooks/configs', description: 'List all webhook endpoint configurations' },
      {
        id: 'webhooks-configs-create',
        method: 'POST',
        path: '/api/webhooks/configs',
        description: 'Create a webhook endpoint config',
        body: {
          description: 'Webhook config — name and url required',
          example: { name: 'Slack Alerts', url: 'https://hooks.slack.com/services/xxx/yyy/zzz', secret: 'hmac-secret', custom_headers: '{"X-Source":"mitremap"}', enabled: true },
        },
      },
      {
        id: 'webhooks-configs-update',
        method: 'PUT',
        path: '/api/webhooks/configs/:id',
        description: 'Update a webhook config',
        pathParams: [{ name: 'id', description: 'Config ID', required: true, example: '1' }],
        body: { description: 'Updated fields', example: { enabled: false } },
      },
      {
        id: 'webhooks-configs-delete',
        method: 'DELETE',
        path: '/api/webhooks/configs/:id',
        description: 'Delete a webhook config (cascades alert rules)',
        pathParams: [{ name: 'id', description: 'Config ID', required: true, example: '1' }],
      },
      {
        id: 'webhooks-configs-test',
        method: 'POST',
        path: '/api/webhooks/configs/:id/test',
        description: 'Send a test payload to a webhook endpoint',
        pathParams: [{ name: 'id', description: 'Config ID', required: true, example: '1' }],
      },
      { id: 'webhooks-rules-list', method: 'GET', path: '/api/webhooks/rules', description: 'List all alert rules (joined with webhook name and URL)' },
      {
        id: 'webhooks-rules-create',
        method: 'POST',
        path: '/api/webhooks/rules',
        description: 'Create an alert rule — types: coverage_threshold | detection_validation_failed | new_uncovered_group_technique',
        body: {
          description: 'Alert rule — name, type, and webhook_config_id required; threshold required for coverage_threshold type',
          example: { name: 'Low Coverage Alert', type: 'coverage_threshold', threshold: 60, webhook_config_id: 1, enabled: true },
        },
      },
      {
        id: 'webhooks-rules-update',
        method: 'PUT',
        path: '/api/webhooks/rules/:id',
        description: 'Update an alert rule',
        pathParams: [{ name: 'id', description: 'Rule ID', required: true, example: '1' }],
        body: { description: 'Updated fields', example: { threshold: 70, enabled: true } },
      },
      {
        id: 'webhooks-rules-delete',
        method: 'DELETE',
        path: '/api/webhooks/rules/:id',
        description: 'Delete an alert rule',
        pathParams: [{ name: 'id', description: 'Rule ID', required: true, example: '1' }],
      },
    ],
  },
  {
    name: 'Settings',
    color: 'text-gray-500 dark:text-slate-400',
    endpoints: [
      {
        id: 'settings-get',
        method: 'GET',
        path: '/api/settings/:key',
        description: 'Get a setting value — sensitive keys (e.g. github_token) return only { configured: bool }',
        pathParams: [{ name: 'key', description: 'Setting key', required: true, example: 'github_token' }],
      },
      {
        id: 'settings-put',
        method: 'PUT',
        path: '/api/settings/:key',
        description: 'Upsert a setting value',
        pathParams: [{ name: 'key', description: 'Setting key', required: true, example: 'github_token' }],
        body: { description: 'New value', example: { value: 'ghp_xxxxxxxxxxxxxxxxxxxx' } },
      },
      {
        id: 'settings-delete',
        method: 'DELETE',
        path: '/api/settings/:key',
        description: 'Clear a setting (sets value to null)',
        pathParams: [{ name: 'key', description: 'Setting key', required: true, example: 'github_token' }],
      },
    ],
  },
  {
    name: 'Admin',
    color: 'text-red-300',
    endpoints: [
      { id: 'admin-purgeable', method: 'GET', path: '/api/admin/purgeable', description: 'List purgeable datasets' },
      {
        id: 'admin-purge',
        method: 'DELETE',
        path: '/api/admin/purge/:dataset',
        description: 'Purge a specific dataset',
        pathParams: [{ name: 'dataset', description: 'Dataset name', required: true, example: 'attack_techniques' }],
      },
      { id: 'admin-purge-all', method: 'DELETE', path: '/api/admin/purge-all', description: 'Purge all stock data (irreversible)' },
    ],
  },
];

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function colorizeJson(json: string): string {
  return escapeHtml(json).replace(
    /("(?:\\.|[^"\\])*"(?:\s*:)?|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      if (m.endsWith(':')) return `<span class="text-blue-300">${m}</span>`;
      if (m.startsWith('"')) return `<span class="text-emerald-300">${m}</span>`;
      if (m === 'true' || m === 'false') return `<span class="text-amber-300">${m}</span>`;
      if (m === 'null') return `<span class="text-gray-400 dark:text-slate-500">${m}</span>`;
      return `<span class="text-cyan-300">${m}</span>`;
    }
  );
}

function resolveUrl(path: string, pathParams: Record<string, string>, queryParams: Record<string, string>): string {
  let url = path;
  for (const [k, v] of Object.entries(pathParams)) {
    url = url.replace(`:${k}`, encodeURIComponent(v));
  }
  const qp = Object.entries(queryParams).filter(([, v]) => v.trim());
  if (qp.length) url += '?' + qp.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return url;
}

export default function ApiPlayground() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EndpointDef | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(GROUPS.map((g) => g.name))
  );
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [body, setBody] = useState('');
  const [response, setResponse] = useState<{ status: number; body: string; time: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiKeyOverride, setApiKeyOverride] = useState('');

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return GROUPS;
    const q = search.toLowerCase();
    return GROUPS.map((g) => ({
      ...g,
      endpoints: g.endpoints.filter(
        (e) =>
          e.path.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.method.toLowerCase().includes(q)
      ),
    })).filter((g) => g.endpoints.length > 0);
  }, [search]);

  function selectEndpoint(ep: EndpointDef) {
    setSelected(ep);
    setPathParams({});
    setQueryParams({});
    setBody(ep.body ? JSON.stringify(ep.body.example, null, 2) : '');
    setResponse(null);
  }

  function toggleGroup(name: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  async function sendRequest() {
    if (!selected) return;
    setLoading(true);
    setResponse(null);
    const url = resolveUrl(selected.path, pathParams, queryParams);
    const start = Date.now();
    try {
      const key = apiKeyOverride.trim() || getStoredApiKey();
      const baseHeaders: Record<string, string> = key ? { Authorization: `Bearer ${key}` } : {};
      const init: RequestInit = { method: selected.method };
      const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(selected.method) && body.trim();
      if (hasBody) {
        init.headers = { 'Content-Type': 'application/json', ...baseHeaders };
        init.body = body;
      } else {
        init.headers = baseHeaders;
      }
      const res = await fetch(url, init);
      const time = Date.now() - start;
      const text = await res.text();
      let formatted = text;
      try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON, keep raw */ }
      setResponse({ status: res.status, body: formatted, time });
    } catch (err: unknown) {
      setResponse({ status: 0, body: err instanceof Error ? err.message : String(err), time: Date.now() - start });
    } finally {
      setLoading(false);
    }
  }

  const resolvedUrl = selected ? resolveUrl(selected.path, pathParams, queryParams) : '';
  const hasPathParams = selected && (selected.pathParams?.length ?? 0) > 0;
  const hasQueryParams = selected && (selected.queryParams?.length ?? 0) > 0;
  const hasBody = selected && selected.body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(selected.method);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-slate-800 flex flex-col bg-gray-50 dark:bg-slate-900">
        <div className="px-4 py-4 border-b border-gray-200 dark:border-slate-800">
          <h1 className="text-sm font-semibold text-white mb-3">API Playground</h1>
          <input
            type="text"
            placeholder="Search endpoints..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {filteredGroups.map((group) => (
            <div key={group.name}>
              <button
                onClick={() => toggleGroup(group.name)}
                className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-gray-100/50 dark:bg-slate-800/50 transition-colors"
              >
                <span className={`text-xs font-semibold uppercase tracking-wider ${group.color}`}>{group.name}</span>
                <span className="text-gray-400 dark:text-slate-600 text-xs">{expandedGroups.has(group.name) ? '▾' : '▸'}</span>
              </button>
              {expandedGroups.has(group.name) && (
                <div className="mb-1">
                  {group.endpoints.map((ep) => (
                    <button
                      key={ep.id}
                      onClick={() => selectEndpoint(ep)}
                      className={`w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-gray-100 dark:bg-slate-800 transition-colors ${
                        selected?.id === ep.id ? 'bg-gray-100 dark:bg-slate-800' : ''
                      }`}
                    >
                      <span className={`text-[10px] font-bold w-11 flex-shrink-0 px-1 py-0.5 rounded text-center ${METHOD_COLORS[ep.method]}`}>
                        {ep.method}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-slate-400 truncate font-mono">{ep.path.replace('/api', '')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
          {(() => {
            const stored = getStoredApiKey();
            return stored ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="font-mono truncate">{stored.slice(0, 8)}{'•'.repeat(12)}{stored.slice(-4)}</span>
              </div>
            ) : (
              <div className="text-xs text-amber-500/70">No app key — set one in Settings</div>
            );
          })()}
          <input
            type="password"
            value={apiKeyOverride}
            onChange={e => setApiKeyOverride(e.target.value)}
            placeholder="Override key for this session..."
            className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-700 dark:text-slate-300 font-mono placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
          <div className="text-xs text-gray-400 dark:text-slate-600">
            {GROUPS.reduce((n, g) => n + g.endpoints.length, 0)} endpoints
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-center px-8">
            <div>
              <div className="text-4xl mb-4 text-slate-700">⚡</div>
              <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Select an endpoint to get started</p>
              <p className="text-gray-400 dark:text-slate-600 text-xs mt-1">Browse {GROUPS.reduce((n, g) => n + g.endpoints.length, 0)} endpoints across {GROUPS.length} resource groups</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Endpoint header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-1 rounded ${METHOD_COLORS[selected.method]}`}>
                  {selected.method}
                </span>
                <code className="text-sm text-gray-800 dark:text-slate-200 font-mono">{resolvedUrl}</code>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">{selected.description}</p>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Path parameters */}
              {hasPathParams && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Path Parameters</h3>
                  <div className="space-y-2">
                    {selected.pathParams!.map((p) => (
                      <div key={p.name} className="flex items-start gap-3">
                        <div className="w-36 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <code className="text-xs font-mono text-blue-300">{p.name}</code>
                            {p.required && <span className="text-red-400 text-xs">*</span>}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-slate-600 mt-0.5">{p.description}</div>
                        </div>
                        <input
                          type="text"
                          placeholder={p.example ?? p.name}
                          value={pathParams[p.name] ?? ''}
                          onChange={(e) => setPathParams((prev) => ({ ...prev, [p.name]: e.target.value }))}
                          className="flex-1 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-3 py-1.5 text-xs text-gray-800 dark:text-slate-200 font-mono placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Query parameters */}
              {hasQueryParams && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Query Parameters</h3>
                  <div className="space-y-2">
                    {selected.queryParams!.map((p) => (
                      <div key={p.name} className="flex items-start gap-3">
                        <div className="w-36 flex-shrink-0">
                          <code className="text-xs font-mono text-cyan-300">{p.name}</code>
                          <div className="text-xs text-gray-400 dark:text-slate-600 mt-0.5">{p.description}</div>
                        </div>
                        <input
                          type="text"
                          placeholder={p.example ?? ''}
                          value={queryParams[p.name] ?? ''}
                          onChange={(e) => setQueryParams((prev) => ({ ...prev, [p.name]: e.target.value }))}
                          className="flex-1 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-3 py-1.5 text-xs text-gray-800 dark:text-slate-200 font-mono placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Request body */}
              {hasBody && (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Request Body</h3>
                    <span className="text-xs text-gray-400 dark:text-slate-600">{selected.body!.description}</span>
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    spellCheck={false}
                    className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-gray-800 dark:text-slate-200 font-mono placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-y"
                  />
                </section>
              )}

              {/* Send button */}
              <button
                onClick={sendRequest}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 dark:bg-slate-700 disabled:text-gray-400 dark:text-slate-500 text-white text-sm font-medium rounded-md transition-colors"
              >
                {loading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>Send Request</>
                )}
              </button>

              {/* Response */}
              {response && (
                <section>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Response</h3>
                    <span className={`text-xs font-bold font-mono ${STATUS_COLOR(response.status)}`}>
                      {response.status === 0 ? 'Error' : response.status}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-600">{response.time}ms</span>
                  </div>
                  <div className="relative bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-md overflow-hidden">
                    <div className="absolute top-2 right-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(response.body)}
                        className="text-xs text-gray-400 dark:text-slate-600 hover:text-gray-500 dark:text-slate-400 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded transition-colors"
                      >
                        copy
                      </button>
                    </div>
                    <pre
                      className="p-4 text-xs font-mono overflow-x-auto leading-relaxed max-h-[500px] overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: colorizeJson(response.body) }}
                    />
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
