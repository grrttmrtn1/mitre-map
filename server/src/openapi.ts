// OpenAPI 3.1.0 specification for MitreMap
// Serves at GET /api/openapi.json and interactive UI at GET /api/docs

const SECURITY = [{ BearerAuth: [] }, { ApiKeyAuth: [] }];

const ErrorSchema = {
  type: 'object',
  required: ['error'],
  properties: { error: { type: 'string' } },
};

const IdParam = (description: string) => ({
  name: 'id',
  in: 'path' as const,
  required: true,
  description,
  schema: { type: 'string' },
});

export const openapiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'MitreMap API',
    version: '1.0.0',
    description:
      'Detection coverage mapping platform — ATT&CK → D3FEND → tools. ' +
      'All `/api/*` routes require authentication via a JWT bearer token or an API key ' +
      'with the `mm_` prefix. Exceptions: `GET /api/health`, `POST /api/auth/login`, ' +
      '`POST /api/auth/refresh`, and OIDC endpoints.',
    contact: { name: 'MitreMap', url: 'https://github.com/mitremap' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: '/api', description: 'Same-origin API base' },
    { url: 'http://localhost:4000/api', description: 'Local dev (HTTP)' },
    { url: 'https://localhost:4000/api', description: 'Local dev (HTTPS)' },
  ],
  tags: [
    { name: 'health', description: 'Server health' },
    { name: 'auth', description: 'Authentication & OIDC' },
    { name: 'users', description: 'User management (admin)' },
    { name: 'api-keys', description: 'Programmatic API key management' },
    { name: 'admin', description: 'Dataset administration (admin)' },
    { name: 'attack', description: 'MITRE ATT&CK tactics, techniques & mitigations' },
    { name: 'd3fend', description: 'MITRE D3FEND defensive techniques' },
    { name: 'detections', description: 'Detection rules & coverage' },
    { name: 'tools', description: 'Security tools inventory' },
    { name: 'coverage', description: 'Coverage statistics & gap analysis' },
    { name: 'tags', description: 'Entity tagging' },
    { name: 'assignments', description: 'Work assignments' },
    { name: 'audit', description: 'Immutable audit log' },
    { name: 'comments', description: 'Entity comments' },
    { name: 'snapshots', description: 'Point-in-time coverage snapshots' },
    { name: 'threat-groups', description: 'Threat actor groups & exposure' },
    { name: 'compliance', description: 'Compliance frameworks & control mapping' },
    { name: 'sigma', description: 'Sigma rule parsing & import' },
    { name: 'exports', description: 'Bulk data exports (CSV, JSON, PPTX)' },
    { name: 'reports', description: 'Pre-built analytical reports' },
    { name: 'risk', description: 'Risk scoring' },
    { name: 'data-sources', description: 'Telemetry data source management' },
    { name: 'atomic', description: 'Atomic Red Team test tracking' },
    { name: 'motivations', description: 'Threat actor motivation taxonomy' },
    { name: 'countries', description: 'Country / nation-state taxonomy' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Short-lived JWT issued by `POST /auth/login` or `POST /auth/refresh`.',
      },
      ApiKeyAuth: {
        type: 'http',
        scheme: 'bearer',
        description:
          'Long-lived API key with the format `mm_<64 hex chars>`. ' +
          'Scopes: `read`, `write`, `admin`.',
      },
    },
    schemas: {
      Error: ErrorSchema,
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string', nullable: true },
          role: { type: 'string', enum: ['admin', 'analyst', 'readonly'] },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AuthTokenResponse: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'Short-lived JWT.' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          scopes: {
            type: 'array',
            items: { type: 'string', enum: ['read', 'write', 'admin'] },
          },
          expires_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          last_used_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      ApiKeyCreated: {
        allOf: [
          { $ref: '#/components/schemas/ApiKey' },
          {
            type: 'object',
            required: ['key'],
            properties: {
              key: {
                type: 'string',
                description: 'Raw API key — only returned once, store securely.',
              },
            },
          },
        ],
      },
      OidcProvider: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          issuer: { type: 'string' },
          client_id: { type: 'string' },
          enabled: { type: 'boolean' },
        },
      },
      Tactic: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'TA0001' },
          name: { type: 'string', example: 'Initial Access' },
          description: { type: 'string' },
          url: { type: 'string' },
          order: { type: 'integer' },
        },
      },
      Technique: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'T1566' },
          name: { type: 'string', example: 'Phishing' },
          description: { type: 'string' },
          tactic_ids: { type: 'array', items: { type: 'string' } },
          is_subtechnique: { type: 'boolean' },
          parent_id: { type: 'string', nullable: true },
          url: { type: 'string' },
          is_deprecated: { type: 'boolean' },
        },
      },
      Mitigation: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'M1049' },
          name: { type: 'string' },
          description: { type: 'string' },
          url: { type: 'string' },
        },
      },
      D3FendTechnique: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'D3-PM' },
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          url: { type: 'string' },
        },
      },
      Detection: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          rule_id: { type: 'string', nullable: true },
          source: { type: 'string', nullable: true },
          status: {
            type: 'string',
            enum: ['active', 'review', 'disabled', 'testing'],
          },
          severity: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low', 'informational'],
            nullable: true,
          },
          confidence: { type: 'number', minimum: 0, maximum: 100, nullable: true },
          false_positive_rate: { type: 'number', minimum: 0, maximum: 100, nullable: true },
          notes: { type: 'string', nullable: true },
          technique_ids: { type: 'array', items: { type: 'string' } },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      Tool: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string' },
          vendor: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['active', 'inactive', 'evaluation'] },
          notes: { type: 'string', nullable: true },
          d3fend_ids: { type: 'array', items: { type: 'string' } },
          mitigation_ids: { type: 'array', items: { type: 'string' } },
        },
      },
      CoverageStats: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          detected: { type: 'integer' },
          mitigated: { type: 'integer' },
          covered: { type: 'integer' },
          gaps: { type: 'integer' },
          coverage_pct: { type: 'number', format: 'float' },
        },
      },
      Tag: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string', example: '#4A90D9', nullable: true },
          description: { type: 'string', nullable: true },
        },
      },
      Assignment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          entity_type: { type: 'string' },
          entity_id: { type: 'string' },
          assignee: { type: 'string' },
          status: {
            type: 'string',
            enum: ['open', 'in_progress', 'done', 'wont_fix'],
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            nullable: true,
          },
          due_date: { type: 'string', format: 'date', nullable: true },
          notes: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AuditEntry: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          entity_type: { type: 'string' },
          entity_id: { type: 'string' },
          action: { type: 'string', enum: ['create', 'update', 'delete'] },
          actor: { type: 'string' },
          diff: { type: 'object', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          entity_type: { type: 'string' },
          entity_id: { type: 'string' },
          body: { type: 'string' },
          author: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      Snapshot: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          notes: { type: 'string', nullable: true },
          stats: { $ref: '#/components/schemas/CoverageStats' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      ThreatGroup: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'G0016' },
          name: { type: 'string' },
          aliases: { type: 'array', items: { type: 'string' }, nullable: true },
          description: { type: 'string', nullable: true },
          country: { type: 'string', nullable: true },
          motivation: { type: 'string', nullable: true },
          url: { type: 'string', nullable: true },
          technique_count: { type: 'integer' },
        },
      },
      ComplianceFramework: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          version: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          control_count: { type: 'integer' },
          coverage_pct: { type: 'number', format: 'float' },
        },
      },
      ComplianceControl: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          framework_id: { type: 'string' },
          control_id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          technique_ids: { type: 'array', items: { type: 'string' } },
        },
      },
      DataSource: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          status: {
            type: 'string',
            enum: ['collecting', 'partial', 'not_collecting'],
            nullable: true,
          },
          collection_method: { type: 'string', nullable: true },
          technique_count: { type: 'integer' },
        },
      },
      AtomicTest: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          technique_id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          platform: { type: 'string', nullable: true },
          executor_type: { type: 'string', nullable: true },
          is_custom: { type: 'boolean' },
        },
      },
      Motivation: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
        },
      },
      Country: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string', nullable: true },
          flag: { type: 'string', nullable: true },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Missing or invalid authentication token.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Insufficient scope or role.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource not found.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      BadRequest: {
        description: 'Invalid request body or parameters.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Conflict: {
        description: 'Duplicate or uniqueness constraint violation.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NoContent: { description: 'Success — no body.' },
    },
  },
  paths: {
    // ── Health ────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['health'],
        summary: 'Server health & bootstrap status',
        security: [],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    bootstrap: {
                      type: 'boolean',
                      description: 'True when no users or API keys exist yet.',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Auth ─────────────────────────────────────────────────────────────
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Login with email & password',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'JWT issued; refresh token set as HttpOnly cookie.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthTokenResponse' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { description: 'Rate limit exceeded (20 attempts per 15 min).' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['auth'],
        summary: 'Refresh JWT using HttpOnly refresh-token cookie',
        security: [],
        responses: {
          200: {
            description: 'New JWT issued.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { token: { type: 'string' } },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['auth'],
        summary: 'Logout — clears refresh-token cookie',
        security: SECURITY,
        responses: {
          200: { description: 'Logged out.' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['auth'],
        summary: 'Current authenticated user',
        security: SECURITY,
        responses: {
          200: {
            description: 'User record.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/oidc/providers': {
      get: {
        tags: ['auth'],
        summary: 'List enabled OIDC providers',
        security: [],
        responses: {
          200: {
            description: 'Array of providers.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/OidcProvider' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['auth'],
        summary: 'Create OIDC provider (admin)',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'slug', 'issuer', 'client_id', 'client_secret'],
                properties: {
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  issuer: { type: 'string' },
                  client_id: { type: 'string' },
                  client_secret: { type: 'string' },
                  enabled: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OidcProvider' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/auth/oidc/providers/{id}': {
      put: {
        tags: ['auth'],
        summary: 'Update OIDC provider (admin)',
        security: SECURITY,
        parameters: [IdParam('Provider ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OidcProvider' },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OidcProvider' },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['auth'],
        summary: 'Delete OIDC provider (admin)',
        security: SECURITY,
        parameters: [IdParam('Provider ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/auth/oidc/{slug}': {
      get: {
        tags: ['auth'],
        summary: 'Begin OIDC authorization flow',
        security: [],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          302: { description: 'Redirect to identity provider.' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/auth/oidc/{slug}/callback': {
      get: {
        tags: ['auth'],
        summary: 'OIDC callback — exchanges code for JWT',
        security: [],
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'state', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          302: { description: 'Redirect to frontend with token.' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── Users ─────────────────────────────────────────────────────────────
    '/users': {
      get: {
        tags: ['users'],
        summary: 'List all users',
        security: SECURITY,
        responses: {
          200: {
            description: 'Array of users.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/User' } },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      post: {
        tags: ['users'],
        summary: 'Create user (admin)',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'analyst', 'readonly'], default: 'analyst' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          403: { $ref: '#/components/responses/Forbidden' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/users/{id}': {
      put: {
        tags: ['users'],
        summary: 'Update user (admin)',
        security: SECURITY,
        parameters: [IdParam('User ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'analyst', 'readonly'] },
                  is_active: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['users'],
        summary: 'Delete user (admin)',
        security: SECURITY,
        parameters: [IdParam('User ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/users/{id}/reset-password': {
      post: {
        tags: ['users'],
        summary: 'Force password reset for user (admin)',
        security: SECURITY,
        parameters: [IdParam('User ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: { password: { type: 'string', format: 'password' } },
              },
            },
          },
        },
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── API Keys ──────────────────────────────────────────────────────────
    '/api-keys': {
      get: {
        tags: ['api-keys'],
        summary: 'List API keys',
        security: SECURITY,
        responses: {
          200: {
            description: 'Array of API keys (raw key never re-exposed).',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ApiKey' } },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      post: {
        tags: ['api-keys'],
        summary: 'Create API key — raw key returned once only',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  scopes: {
                    type: 'array',
                    items: { type: 'string', enum: ['read', 'write', 'admin'] },
                    default: ['read'],
                  },
                  expires_at: { type: 'string', format: 'date-time', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created. Store the `key` field — it will not be shown again.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiKeyCreated' },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api-keys/{id}': {
      patch: {
        tags: ['api-keys'],
        summary: 'Update API key metadata',
        security: SECURITY,
        parameters: [IdParam('API key ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  scopes: { type: 'array', items: { type: 'string' } },
                  expires_at: { type: 'string', format: 'date-time', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiKey' },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['api-keys'],
        summary: 'Revoke API key',
        security: SECURITY,
        parameters: [IdParam('API key ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Admin ─────────────────────────────────────────────────────────────
    '/admin/purgeable': {
      get: {
        tags: ['admin'],
        summary: 'List purgeable datasets with row counts',
        security: SECURITY,
        responses: {
          200: {
            description: 'Dataset names and counts.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      dataset: { type: 'string' },
                      count: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/admin/purge/{dataset}': {
      delete: {
        tags: ['admin'],
        summary: 'Delete all rows from a dataset (admin)',
        security: SECURITY,
        parameters: [
          { name: 'dataset', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/admin/purge-all': {
      delete: {
        tags: ['admin'],
        summary: 'Purge all data from all datasets (admin)',
        security: SECURITY,
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    // ── ATT&CK ────────────────────────────────────────────────────────────
    '/attack/tactics': {
      get: {
        tags: ['attack'],
        summary: 'List ATT&CK tactics',
        security: SECURITY,
        responses: {
          200: {
            description: 'Ordered tactic list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Tactic' } },
              },
            },
          },
        },
      },
    },
    '/attack/techniques': {
      get: {
        tags: ['attack'],
        summary: 'List ATT&CK techniques',
        security: SECURITY,
        parameters: [
          { name: 'tactic', in: 'query', schema: { type: 'string' }, description: 'Filter by tactic ID.' },
          {
            name: 'include_subtechniques',
            in: 'query',
            schema: { type: 'boolean', default: true },
          },
        ],
        responses: {
          200: {
            description: 'Technique list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Technique' } },
              },
            },
          },
        },
      },
    },
    '/attack/techniques/{id}': {
      get: {
        tags: ['attack'],
        summary: 'Technique detail — includes mitigations, D3FEND mappings, detections',
        security: SECURITY,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'T1566' },
        ],
        responses: {
          200: {
            description: 'Technique detail.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Technique' },
                    {
                      type: 'object',
                      properties: {
                        mitigations: { type: 'array', items: { $ref: '#/components/schemas/Mitigation' } },
                        d3fend: { type: 'array', items: { $ref: '#/components/schemas/D3FendTechnique' } },
                        detections: { type: 'array', items: { $ref: '#/components/schemas/Detection' } },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/attack/mitigations': {
      get: {
        tags: ['attack'],
        summary: 'List ATT&CK mitigations',
        security: SECURITY,
        responses: {
          200: {
            description: 'Mitigation list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Mitigation' } },
              },
            },
          },
        },
      },
    },
    '/attack/mitigations/{id}': {
      get: {
        tags: ['attack'],
        summary: 'Mitigation detail — includes related techniques and tools',
        security: SECURITY,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'M1049' },
        ],
        responses: {
          200: {
            description: 'Mitigation detail.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Mitigation' },
                    {
                      type: 'object',
                      properties: {
                        techniques: { type: 'array', items: { $ref: '#/components/schemas/Technique' } },
                        tools: { type: 'array', items: { $ref: '#/components/schemas/Tool' } },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/attack/version': {
      get: {
        tags: ['attack'],
        summary: 'Current ATT&CK data version',
        security: SECURITY,
        responses: {
          200: {
            description: 'Version string.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { version: { type: 'string' } } },
              },
            },
          },
        },
      },
    },
    '/attack/deprecated': {
      get: {
        tags: ['attack'],
        summary: 'List deprecated techniques',
        security: SECURITY,
        responses: {
          200: {
            description: 'Deprecated techniques.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Technique' } },
              },
            },
          },
        },
      },
    },
    '/attack/migration-scan': {
      get: {
        tags: ['attack'],
        summary: 'Scan detections referencing deprecated techniques',
        security: SECURITY,
        responses: {
          200: {
            description: 'Detections with stale technique references.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Detection' } },
              },
            },
          },
        },
      },
    },
    '/attack/check-updates': {
      get: {
        tags: ['attack'],
        summary: 'Check GitHub for latest ATT&CK version (admin)',
        security: SECURITY,
        responses: {
          200: {
            description: 'Latest version info.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    current: { type: 'string' },
                    latest: { type: 'string' },
                    update_available: { type: 'boolean' },
                  },
                },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/attack/apply-update': {
      post: {
        tags: ['attack'],
        summary: 'Download and apply latest ATT&CK data (admin)',
        security: SECURITY,
        responses: {
          200: { description: 'Update applied.' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    // ── D3FEND ────────────────────────────────────────────────────────────
    '/d3fend/techniques': {
      get: {
        tags: ['d3fend'],
        summary: 'List D3FEND techniques',
        security: SECURITY,
        responses: {
          200: {
            description: 'D3FEND technique list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/D3FendTechnique' } },
              },
            },
          },
        },
      },
    },
    '/d3fend/techniques/{id}': {
      get: {
        tags: ['d3fend'],
        summary: 'D3FEND technique detail — ATT&CK mappings and tools',
        security: SECURITY,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'D3-PM' },
        ],
        responses: {
          200: {
            description: 'D3FEND detail.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/D3FendTechnique' },
                    {
                      type: 'object',
                      properties: {
                        attack_techniques: { type: 'array', items: { $ref: '#/components/schemas/Technique' } },
                        tools: { type: 'array', items: { $ref: '#/components/schemas/Tool' } },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/d3fend/mappings/{attackId}': {
      get: {
        tags: ['d3fend'],
        summary: 'D3FEND techniques mapped to a given ATT&CK technique',
        security: SECURITY,
        parameters: [
          { name: 'attackId', in: 'path', required: true, schema: { type: 'string' }, example: 'T1566' },
        ],
        responses: {
          200: {
            description: 'Mapped D3FEND techniques.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/D3FendTechnique' } },
              },
            },
          },
        },
      },
    },

    // ── Detections ────────────────────────────────────────────────────────
    '/detections': {
      get: {
        tags: ['detections'],
        summary: 'List detections',
        security: SECURITY,
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'review', 'disabled', 'testing'] } },
          { name: 'source', in: 'query', schema: { type: 'string' } },
          { name: 'severity', in: 'query', schema: { type: 'string' } },
          { name: 'technique', in: 'query', schema: { type: 'string' }, description: 'Filter by ATT&CK technique ID.' },
        ],
        responses: {
          200: {
            description: 'Detection list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Detection' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['detections'],
        summary: 'Create detection',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'technique_ids'],
                properties: {
                  name: { type: 'string' },
                  technique_ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
                  description: { type: 'string' },
                  rule_id: { type: 'string' },
                  source: { type: 'string' },
                  status: { type: 'string', enum: ['active', 'review', 'disabled', 'testing'], default: 'active' },
                  severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'informational'] },
                  confidence: { type: 'number', minimum: 0, maximum: 100 },
                  false_positive_rate: { type: 'number', minimum: 0, maximum: 100 },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Detection' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/detections/bulk': {
      patch: {
        tags: ['detections'],
        summary: 'Bulk-update detection status',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ids', 'status'],
                properties: {
                  ids: { type: 'array', items: { type: 'string' } },
                  status: { type: 'string', enum: ['active', 'review', 'disabled', 'testing'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated count.' },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
      delete: {
        tags: ['detections'],
        summary: 'Bulk-delete detections',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ids'],
                properties: { ids: { type: 'array', items: { type: 'string' } } },
              },
            },
          },
        },
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/detections/import': {
      post: {
        tags: ['detections'],
        summary: 'Bulk-import detections',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['detections'],
                properties: {
                  detections: { type: 'array', items: { $ref: '#/components/schemas/Detection' } },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Import result.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    imported: { type: 'integer' },
                    skipped: { type: 'integer' },
                    errors: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/detections/{id}': {
      get: {
        tags: ['detections'],
        summary: 'Get detection by ID',
        security: SECURITY,
        parameters: [IdParam('Detection ID')],
        responses: {
          200: {
            description: 'Detection detail.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Detection' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['detections'],
        summary: 'Update detection',
        security: SECURITY,
        parameters: [IdParam('Detection ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Detection' },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Detection' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['detections'],
        summary: 'Delete detection',
        security: SECURITY,
        parameters: [IdParam('Detection ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Tools ─────────────────────────────────────────────────────────────
    '/tools': {
      get: {
        tags: ['tools'],
        summary: 'List security tools with coverage counts',
        security: SECURITY,
        responses: {
          200: {
            description: 'Tool list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Tool' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['tools'],
        summary: 'Create tool',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'category'],
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  vendor: { type: 'string' },
                  description: { type: 'string' },
                  status: { type: 'string', enum: ['active', 'inactive', 'evaluation'], default: 'active' },
                  notes: { type: 'string' },
                  d3fend_ids: { type: 'array', items: { type: 'string' } },
                  mitigation_ids: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Tool' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/tools/{id}': {
      get: {
        tags: ['tools'],
        summary: 'Tool detail — D3FEND techniques and mitigations',
        security: SECURITY,
        parameters: [IdParam('Tool ID')],
        responses: {
          200: {
            description: 'Tool detail.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Tool' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['tools'],
        summary: 'Update tool',
        security: SECURITY,
        parameters: [IdParam('Tool ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Tool' } },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Tool' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['tools'],
        summary: 'Delete tool',
        security: SECURITY,
        parameters: [IdParam('Tool ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Coverage ──────────────────────────────────────────────────────────
    '/coverage/stats': {
      get: {
        tags: ['coverage'],
        summary: 'Summary coverage statistics',
        security: SECURITY,
        responses: {
          200: {
            description: 'Coverage stats.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CoverageStats' },
              },
            },
          },
        },
      },
    },
    '/coverage/matrix': {
      get: {
        tags: ['coverage'],
        summary: 'Tactic / technique matrix with detection & mitigation status',
        security: SECURITY,
        responses: {
          200: {
            description: 'Coverage matrix.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tactic: { $ref: '#/components/schemas/Tactic' },
                      techniques: {
                        type: 'array',
                        items: {
                          allOf: [
                            { $ref: '#/components/schemas/Technique' },
                            {
                              type: 'object',
                              properties: {
                                detected: { type: 'boolean' },
                                mitigated: { type: 'boolean' },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/coverage/gaps': {
      get: {
        tags: ['coverage'],
        summary: 'Undetected & unmitigated techniques with recommendations',
        security: SECURITY,
        responses: {
          200: {
            description: 'Gap list with recommendations.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    allOf: [
                      { $ref: '#/components/schemas/Technique' },
                      {
                        type: 'object',
                        properties: {
                          recommendations: { type: 'array', items: { type: 'string' } },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Tags ──────────────────────────────────────────────────────────────
    '/tags': {
      get: {
        tags: ['tags'],
        summary: 'List all tags',
        security: SECURITY,
        responses: {
          200: {
            description: 'Tag list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['tags'],
        summary: 'Create tag',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  color: { type: 'string', example: '#4A90D9' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Tag' },
              },
            },
          },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/tags/{id}': {
      put: {
        tags: ['tags'],
        summary: 'Update tag',
        security: SECURITY,
        parameters: [IdParam('Tag ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Tag' } },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Tag' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['tags'],
        summary: 'Delete tag',
        security: SECURITY,
        parameters: [IdParam('Tag ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/tags/{entityType}/{entityId}': {
      get: {
        tags: ['tags'],
        summary: 'Get tags for an entity',
        security: SECURITY,
        parameters: [
          { name: 'entityType', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Tags applied to the entity.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['tags'],
        summary: 'Add tag to entity',
        security: SECURITY,
        parameters: [
          { name: 'entityType', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tag_id'],
                properties: { tag_id: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          201: { description: 'Tag applied.' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/tags/{entityType}/{entityId}/{tagId}': {
      delete: {
        tags: ['tags'],
        summary: 'Remove tag from entity',
        security: SECURITY,
        parameters: [
          { name: 'entityType', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'tagId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Assignments ───────────────────────────────────────────────────────
    '/assignments': {
      get: {
        tags: ['assignments'],
        summary: 'List assignments',
        security: SECURITY,
        parameters: [
          { name: 'assignee', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'entity_type', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Assignment list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Assignment' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['assignments'],
        summary: 'Create assignment',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['entity_type', 'entity_id', 'assignee'],
                properties: {
                  entity_type: { type: 'string' },
                  entity_id: { type: 'string' },
                  assignee: { type: 'string' },
                  status: { type: 'string', enum: ['open', 'in_progress', 'done', 'wont_fix'], default: 'open' },
                  priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                  due_date: { type: 'string', format: 'date' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Assignment' },
              },
            },
          },
        },
      },
    },
    '/assignments/{entityType}/{entityId}': {
      get: {
        tags: ['assignments'],
        summary: 'Assignments for a specific entity',
        security: SECURITY,
        parameters: [
          { name: 'entityType', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Assignments.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Assignment' } },
              },
            },
          },
        },
      },
    },
    '/assignments/{id}': {
      put: {
        tags: ['assignments'],
        summary: 'Update assignment',
        security: SECURITY,
        parameters: [IdParam('Assignment ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Assignment' } },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Assignment' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['assignments'],
        summary: 'Delete assignment',
        security: SECURITY,
        parameters: [IdParam('Assignment ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Audit ─────────────────────────────────────────────────────────────
    '/audit': {
      get: {
        tags: ['audit'],
        summary: 'Query audit log',
        security: SECURITY,
        parameters: [
          { name: 'entity_type', in: 'query', schema: { type: 'string' } },
          { name: 'entity_id', in: 'query', schema: { type: 'string' } },
          { name: 'actor', in: 'query', schema: { type: 'string' } },
          { name: 'action', in: 'query', schema: { type: 'string', enum: ['create', 'update', 'delete'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 1000 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: 'Paginated audit entries.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    rows: { type: 'array', items: { $ref: '#/components/schemas/AuditEntry' } },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/audit/{entityType}/{entityId}': {
      get: {
        tags: ['audit'],
        summary: 'Audit trail for a specific entity (last 200 records)',
        security: SECURITY,
        parameters: [
          { name: 'entityType', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Entity audit trail.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/AuditEntry' } },
              },
            },
          },
        },
      },
    },

    // ── Comments ──────────────────────────────────────────────────────────
    '/comments/{entityType}/{entityId}': {
      get: {
        tags: ['comments'],
        summary: 'Get comments for entity',
        security: SECURITY,
        parameters: [
          { name: 'entityType', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Comment list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Comment' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['comments'],
        summary: 'Add comment to entity',
        security: SECURITY,
        parameters: [
          { name: 'entityType', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['body'],
                properties: { body: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Comment created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Comment' },
              },
            },
          },
        },
      },
    },
    '/comments/{id}': {
      put: {
        tags: ['comments'],
        summary: 'Edit comment',
        security: SECURITY,
        parameters: [IdParam('Comment ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['body'],
                properties: { body: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Comment' },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['comments'],
        summary: 'Delete comment',
        security: SECURITY,
        parameters: [IdParam('Comment ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Snapshots ─────────────────────────────────────────────────────────
    '/snapshots': {
      get: {
        tags: ['snapshots'],
        summary: 'List coverage snapshots',
        security: SECURITY,
        responses: {
          200: {
            description: 'Snapshot list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Snapshot' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['snapshots'],
        summary: 'Capture current coverage as a snapshot',
        security: SECURITY,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { notes: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Snapshot created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Snapshot' },
              },
            },
          },
        },
      },
    },
    '/snapshots/{id}': {
      delete: {
        tags: ['snapshots'],
        summary: 'Delete snapshot',
        security: SECURITY,
        parameters: [IdParam('Snapshot ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Threat Groups ─────────────────────────────────────────────────────
    '/threat-groups': {
      get: {
        tags: ['threat-groups'],
        summary: 'List threat groups',
        security: SECURITY,
        responses: {
          200: {
            description: 'Threat group list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ThreatGroup' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['threat-groups'],
        summary: 'Create threat group',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id', 'name'],
                properties: {
                  id: { type: 'string', example: 'G0016' },
                  name: { type: 'string' },
                  aliases: { type: 'array', items: { type: 'string' } },
                  description: { type: 'string' },
                  country: { type: 'string' },
                  motivation: { type: 'string' },
                  url: { type: 'string' },
                  technique_ids: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ThreatGroup' },
              },
            },
          },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/threat-groups/{id}': {
      get: {
        tags: ['threat-groups'],
        summary: 'Threat group detail — techniques & detection coverage',
        security: SECURITY,
        parameters: [IdParam('Group ID (e.g. G0016)')],
        responses: {
          200: {
            description: 'Group detail.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ThreatGroup' },
                    {
                      type: 'object',
                      properties: {
                        techniques: { type: 'array', items: { $ref: '#/components/schemas/Technique' } },
                        coverage: { $ref: '#/components/schemas/CoverageStats' },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['threat-groups'],
        summary: 'Update threat group',
        security: SECURITY,
        parameters: [IdParam('Group ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ThreatGroup' } },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ThreatGroup' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['threat-groups'],
        summary: 'Delete threat group',
        security: SECURITY,
        parameters: [IdParam('Group ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/threat-groups/{id}/techniques': {
      post: {
        tags: ['threat-groups'],
        summary: 'Add techniques to threat group',
        security: SECURITY,
        parameters: [IdParam('Group ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['technique_ids'],
                properties: { technique_ids: { type: 'array', items: { type: 'string' } } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Techniques added.' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['threat-groups'],
        summary: 'Remove techniques from threat group',
        security: SECURITY,
        parameters: [IdParam('Group ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['technique_ids'],
                properties: { technique_ids: { type: 'array', items: { type: 'string' } } },
              },
            },
          },
        },
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/threat-groups/{id}/procedures': {
      get: {
        tags: ['threat-groups'],
        summary: 'Get group procedures',
        security: SECURITY,
        parameters: [IdParam('Group ID')],
        responses: {
          200: {
            description: 'Procedures.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      technique_id: { type: 'string' },
                      type: { type: 'string' },
                      content: { type: 'string' },
                      source: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/threat-groups/{id}/techniques/{technique_id}/procedures': {
      post: {
        tags: ['threat-groups'],
        summary: 'Add procedure for a technique in a group',
        security: SECURITY,
        parameters: [
          IdParam('Group ID'),
          { name: 'technique_id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: {
                  type: { type: 'string' },
                  content: { type: 'string' },
                  source: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Procedure created.' },
        },
      },
    },
    '/threat-groups/{id}/procedures/{proc_id}': {
      put: {
        tags: ['threat-groups'],
        summary: 'Update procedure',
        security: SECURITY,
        parameters: [
          IdParam('Group ID'),
          { name: 'proc_id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { type: { type: 'string' }, content: { type: 'string' }, source: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated.' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['threat-groups'],
        summary: 'Delete procedure',
        security: SECURITY,
        parameters: [
          IdParam('Group ID'),
          { name: 'proc_id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/threat-groups/{id}/exposure': {
      get: {
        tags: ['threat-groups'],
        summary: 'Exposure analysis for a threat group',
        security: SECURITY,
        parameters: [IdParam('Group ID')],
        responses: {
          200: {
            description: 'Detected / mitigated / exposed technique breakdown.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    detected: { type: 'array', items: { $ref: '#/components/schemas/Technique' } },
                    mitigated: { type: 'array', items: { $ref: '#/components/schemas/Technique' } },
                    exposed: { type: 'array', items: { $ref: '#/components/schemas/Technique' } },
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Compliance ────────────────────────────────────────────────────────
    '/compliance/frameworks': {
      get: {
        tags: ['compliance'],
        summary: 'List compliance frameworks with coverage percentage',
        security: SECURITY,
        responses: {
          200: {
            description: 'Framework list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ComplianceFramework' } },
              },
            },
          },
        },
      },
    },
    '/compliance/frameworks/{id}': {
      get: {
        tags: ['compliance'],
        summary: 'Framework detail — controls & coverage',
        security: SECURITY,
        parameters: [IdParam('Framework ID')],
        responses: {
          200: {
            description: 'Framework detail.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ComplianceFramework' },
                    {
                      type: 'object',
                      properties: {
                        controls: { type: 'array', items: { $ref: '#/components/schemas/ComplianceControl' } },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/compliance/controls': {
      get: {
        tags: ['compliance'],
        summary: 'List compliance controls',
        security: SECURITY,
        parameters: [
          { name: 'framework_id', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Control list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ComplianceControl' } },
              },
            },
          },
        },
      },
    },
    '/compliance/gap': {
      get: {
        tags: ['compliance'],
        summary: 'Controls without detection coverage (gap analysis)',
        security: SECURITY,
        parameters: [
          { name: 'framework_id', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Controls with coverage gaps.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ComplianceControl' } },
              },
            },
          },
        },
      },
    },

    // ── Sigma ─────────────────────────────────────────────────────────────
    '/sigma/parse': {
      post: {
        tags: ['sigma'],
        summary: 'Parse a Sigma rule — returns extracted detection fields',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['rule_text'],
                properties: { rule_text: { type: 'string', description: 'Sigma rule YAML content.' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Parsed detection fields.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    technique_ids: { type: 'array', items: { type: 'string' } },
                    severity: { type: 'string' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/sigma/import': {
      post: {
        tags: ['sigma'],
        summary: 'Bulk import Sigma rules as detections',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['rules'],
                properties: {
                  rules: {
                    type: 'array',
                    items: { type: 'string', description: 'Sigma rule YAML string.' },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Import summary.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    imported: { type: 'integer' },
                    skipped: { type: 'integer' },
                    errors: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Exports ───────────────────────────────────────────────────────────
    '/exports/navigator': {
      get: {
        tags: ['exports'],
        summary: 'ATT&CK Navigator layer JSON',
        security: SECURITY,
        responses: {
          200: {
            description: 'Navigator layer.',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/exports/detections/csv': {
      get: {
        tags: ['exports'],
        summary: 'Detections export as CSV',
        security: SECURITY,
        responses: {
          200: {
            description: 'CSV file download.',
            content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } },
          },
        },
      },
    },
    '/exports/tools/csv': {
      get: {
        tags: ['exports'],
        summary: 'Tools export as CSV',
        security: SECURITY,
        responses: {
          200: {
            description: 'CSV file download.',
            content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } },
          },
        },
      },
    },
    '/exports/coverage/json': {
      get: {
        tags: ['exports'],
        summary: 'Full coverage matrix export as JSON',
        security: SECURITY,
        responses: {
          200: {
            description: 'Coverage JSON download.',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/exports/report/pptx': {
      get: {
        tags: ['exports'],
        summary: 'Executive summary PowerPoint report',
        security: SECURITY,
        responses: {
          200: {
            description: 'PPTX binary download.',
            content: {
              'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
    },

    // ── Reports ───────────────────────────────────────────────────────────
    '/reports/executive': {
      get: {
        tags: ['reports'],
        summary: 'Executive summary — coverage %, gaps, trends, severity breakdown',
        security: SECURITY,
        responses: {
          200: {
            description: 'Executive summary data.',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/reports/threat-landscape': {
      get: {
        tags: ['reports'],
        summary: 'Threat group exposure analysis across all groups',
        security: SECURITY,
        responses: {
          200: {
            description: 'Threat landscape report.',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/reports/gaps': {
      get: {
        tags: ['reports'],
        summary: 'Gap analysis with priority scoring',
        security: SECURITY,
        responses: {
          200: {
            description: 'Gap analysis report.',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },

    // ── Risk ──────────────────────────────────────────────────────────────
    '/risk/score': {
      get: {
        tags: ['risk'],
        summary: 'Overall risk score (0–100)',
        security: SECURITY,
        responses: {
          200: {
            description: 'Risk score.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    score: { type: 'number', minimum: 0, maximum: 100 },
                    level: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/risk/by-tactic': {
      get: {
        tags: ['risk'],
        summary: 'Risk breakdown by tactic with group exposure',
        security: SECURITY,
        responses: {
          200: {
            description: 'Per-tactic risk data.',
            content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } },
          },
        },
      },
    },
    '/risk/by-technique': {
      get: {
        tags: ['risk'],
        summary: 'Risk breakdown by technique with group count and compliance impact',
        security: SECURITY,
        responses: {
          200: {
            description: 'Per-technique risk data.',
            content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } },
          },
        },
      },
    },

    // ── Data Sources ──────────────────────────────────────────────────────
    '/data-sources': {
      get: {
        tags: ['data-sources'],
        summary: 'List data sources with technique counts',
        security: SECURITY,
        responses: {
          200: {
            description: 'Data source list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/DataSource' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['data-sources'],
        summary: 'Create data source',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DataSource' },
              },
            },
          },
        },
      },
    },
    '/data-sources/analysis': {
      get: {
        tags: ['data-sources'],
        summary: 'Gap analysis by data source availability',
        security: SECURITY,
        responses: {
          200: {
            description: 'Data source gap analysis.',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/data-sources/technique/{technique_id}': {
      get: {
        tags: ['data-sources'],
        summary: 'Data sources for a specific ATT&CK technique',
        security: SECURITY,
        parameters: [
          { name: 'technique_id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Relevant data sources.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/DataSource' } },
              },
            },
          },
        },
      },
    },
    '/data-sources/{id}': {
      put: {
        tags: ['data-sources'],
        summary: 'Update data source',
        security: SECURITY,
        parameters: [IdParam('Data source ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DataSource' } },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DataSource' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['data-sources'],
        summary: 'Delete data source',
        security: SECURITY,
        parameters: [IdParam('Data source ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/data-sources/{id}/techniques': {
      get: {
        tags: ['data-sources'],
        summary: 'Techniques linked to this data source',
        security: SECURITY,
        parameters: [IdParam('Data source ID')],
        responses: {
          200: {
            description: 'Technique list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Technique' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['data-sources'],
        summary: 'Link technique to data source',
        security: SECURITY,
        parameters: [IdParam('Data source ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['technique_id'],
                properties: { technique_id: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          201: { description: 'Linked.' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/data-sources/{id}/techniques/{technique_id}': {
      delete: {
        tags: ['data-sources'],
        summary: 'Unlink technique from data source',
        security: SECURITY,
        parameters: [
          IdParam('Data source ID'),
          { name: 'technique_id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/data-sources/{id}/status': {
      put: {
        tags: ['data-sources'],
        summary: 'Update org collection status for data source',
        security: SECURITY,
        parameters: [IdParam('Data source ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['collecting', 'partial', 'not_collecting'] },
                  collection_method: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Status updated.' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Atomic Red Team ───────────────────────────────────────────────────
    '/atomic/tests': {
      get: {
        tags: ['atomic'],
        summary: 'List all Atomic Red Team tests',
        security: SECURITY,
        responses: {
          200: {
            description: 'ART test list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/AtomicTest' } },
              },
            },
          },
        },
      },
    },
    '/atomic/tests/{technique_id}': {
      get: {
        tags: ['atomic'],
        summary: 'ART tests for a specific technique',
        security: SECURITY,
        parameters: [
          { name: 'technique_id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Tests for technique.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/AtomicTest' } },
              },
            },
          },
        },
      },
    },
    '/atomic/coverage': {
      get: {
        tags: ['atomic'],
        summary: 'ART coverage breakdown by technique',
        security: SECURITY,
        responses: {
          200: {
            description: 'Coverage summary.',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/atomic/results': {
      post: {
        tags: ['atomic'],
        summary: 'Record an ART test result',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['detection_id', 'art_test_id'],
                properties: {
                  detection_id: { type: 'string' },
                  art_test_id: { type: 'string' },
                  status: { type: 'string', enum: ['pass', 'fail', 'partial'] },
                  notes: { type: 'string' },
                  run_by: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Result recorded.' },
        },
      },
    },
    '/atomic/results/{id}': {
      put: {
        tags: ['atomic'],
        summary: 'Update ART test result',
        security: SECURITY,
        parameters: [IdParam('Result ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['pass', 'fail', 'partial'] },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated.' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['atomic'],
        summary: 'Delete ART test result',
        security: SECURITY,
        parameters: [IdParam('Result ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/atomic/custom': {
      post: {
        tags: ['atomic'],
        summary: 'Create custom ART-style test',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['technique_id', 'name'],
                properties: {
                  technique_id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  platform: { type: 'string' },
                  executor_type: { type: 'string' },
                  command: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AtomicTest' },
              },
            },
          },
        },
      },
    },
    '/atomic/custom/{id}': {
      put: {
        tags: ['atomic'],
        summary: 'Update custom test',
        security: SECURITY,
        parameters: [IdParam('Custom test ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AtomicTest' } },
          },
        },
        responses: {
          200: { description: 'Updated.' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['atomic'],
        summary: 'Delete custom test',
        security: SECURITY,
        parameters: [IdParam('Custom test ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/atomic/import': {
      post: {
        tags: ['atomic'],
        summary: 'Import ART tests from YAML',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['yaml'],
                properties: { yaml: { type: 'string', description: 'Atomic Red Team YAML content.' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Import result.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { imported: { type: 'integer' }, skipped: { type: 'integer' } },
                },
              },
            },
          },
        },
      },
    },

    // ── Motivations ───────────────────────────────────────────────────────
    '/motivations': {
      get: {
        tags: ['motivations'],
        summary: 'List threat actor motivations',
        security: SECURITY,
        responses: {
          200: {
            description: 'Motivation list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Motivation' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['motivations'],
        summary: 'Create motivation',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  color: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Motivation' },
              },
            },
          },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/motivations/{id}': {
      put: {
        tags: ['motivations'],
        summary: 'Update motivation',
        security: SECURITY,
        parameters: [IdParam('Motivation ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Motivation' } },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Motivation' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['motivations'],
        summary: 'Delete motivation',
        security: SECURITY,
        parameters: [IdParam('Motivation ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Countries ─────────────────────────────────────────────────────────
    '/countries': {
      get: {
        tags: ['countries'],
        summary: 'List countries',
        security: SECURITY,
        responses: {
          200: {
            description: 'Country list.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Country' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['countries'],
        summary: 'Create country',
        security: SECURITY,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  color: { type: 'string' },
                  flag: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Country' },
              },
            },
          },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/countries/{id}': {
      put: {
        tags: ['countries'],
        summary: 'Update country',
        security: SECURITY,
        parameters: [IdParam('Country ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Country' } },
          },
        },
        responses: {
          200: {
            description: 'Updated.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Country' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['countries'],
        summary: 'Delete country',
        security: SECURITY,
        parameters: [IdParam('Country ID')],
        responses: {
          204: { $ref: '#/components/responses/NoContent' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
};
