# MitreMap Full Improvement Implementation Plan

This roadmap converts the repository review into an executable program. Work is
ordered by dependency and risk: security and correctness precede design-system,
reporting, and feature expansion work.

## Delivery rules

- Preserve backward compatibility unless a security boundary requires a break.
- Put business calculations in shared services, not route or presentation code.
- Every defect fix requires a regression test.
- New interactive UI must support keyboard use, responsive layouts, light/dark
  themes, reduced motion, and accessible names.
- Every metric must expose its definition, scope, freshness, and drill-down.
- Migrations must work from an empty database and from the preceding release.

## Milestone 0: Security containment and correctness

### Authorization and identity

- [x] Replace method-only authorization with explicit route policy middleware.
- [x] Restrict authentication providers, users, API keys, application settings,
  ATT&CK updates, integration credentials, TAXII servers/jobs, webhooks,
  report schedules, and destructive administration operations to admins.
- [x] Bind OIDC identities to provider plus issuer subject.
- [x] Add an authenticated, expiring account-linking flow before an OIDC identity
  may attach to an existing local account.
- [ ] Add OIDC discovery, issuer, state, nonce, redirect, and claim validation
  regression tests.
- [x] Restrict bootstrap mutations to one-time credential setup.
- [x] Require an expiring one-time bootstrap token for initial credentials and
  display a dedicated setup warning until the first credential exists.
- [x] Stop persisting privileged API keys in browser local storage; migrate legacy
  values into page-lifetime memory and remove the persistent copy.
- [x] Add refresh-token rotation and reuse-family detection.
- [x] Add session inventory/revocation APIs and account security UI.
- [ ] Normalize trusted-proxy/IP handling and authentication audit events.

### Secrets and repository hygiene

- [x] Stop tracking SQLite DB/WAL/SHM runtime files and ignore `server/data/*.db*`.
- [ ] Document history cleanup and credential rotation procedures.
- [ ] Add secret scanning and prohibited-artifact checks to CI.
- [ ] Add encryption-key IDs, key rotation, and external secret-provider hooks.

### Correctness

- [x] Replace scheduled-report loopback HTTP calls with shared report services.
- [x] Implement every advertised scheduled report type and fail closed on data
  generation errors.
- [ ] **In progress:** Consolidate detected and mitigated coverage in a canonical engine; extend it
  with validated, accepted-risk, partial, and gap
  calculations into a canonical versioned coverage engine.
- [x] Make dashboard, risk, reports, exports, snapshots, and PPTX use the canonical engine.
- [x] Replace arbitrary ATT&CK-ID executive gaps with prioritized gap results.
- [x] Correct OpenAPI/Swagger public/private route behavior and separate public
  OIDC provider discovery from administrative provider configuration.
- [ ] Add schema validation and bounded inputs to every mutation endpoint.

Acceptance: role-policy tests pass for every sensitive endpoint; OIDC cannot
cross-link accounts by email; all coverage surfaces reconcile; every scheduled
report contains real data or records an actionable failure.

## Milestone 1: Engineering quality foundation

- [ ] **In progress:** Add GitHub Actions for install, build, typecheck, server/client tests,
  coverage, clean migration smoke tests, and artifact scanning; add dependency
  production dependency audit, clean migration smoke tests, and artifact scanning;
  add a dedicated secret scanner and image build next.
- [ ] Add ESLint, Prettier, strict scripts, and pre-commit guidance.
- [ ] **In progress:** Add React Testing Library, jsdom, axe, and desktop/mobile
  Playwright foundations; add MSW fixtures and broader workflow coverage next.
- [ ] Export an app factory separately from network startup for reliable tests.
- [x] Replace deprecated `createTableIfNotExists` migration and test-schema usage.
- [ ] **In progress:** Add centralized safe API errors, request IDs, and structured
  error logs; convert remaining route-local errors to typed errors next.
- [ ] **In progress:** Add reusable runtime request validation and apply it to auth,
  user, API-key, and report-schedule creation; expand to remaining mutations and
  generated response/client types next.
- [ ] Add pagination, sorting, filtering, limits, and query indexes to large lists.
- [ ] Split oversized route/page modules into domain services and components.

Acceptance: deterministic clean CI; clean install-to-migrate-to-test path;
critical flows have unit, integration, accessibility, and browser coverage.

## Milestone 2: Responsive and accessible design system

- [ ] Introduce design tokens for typography, spacing, surfaces, semantic colors,
  focus, elevation, chart colors, density, and motion.
- [ ] **In progress:** Build `PageShell`, `PageHeader`, `KpiCard`, and `ChartCard`;
  add `KpiGrid`, `FilterBar`,
  `DataTable`, `DetailDrawer`, `Tabs`, form controls, empty/error states, and
  accessible dialog/menu primitives.
- [ ] **In progress:** Replace the fixed sidebar with a mobile drawer; add desktop collapse next.
- [ ] **In progress:** Add skip navigation, landmarks, and global focus styles; complete focus
  restoration, live regions, and
  complete keyboard interactions.
- [ ] Associate every form label; name every icon control; remove color-only state.
- [ ] **In progress:** Add reduced-motion support and accessible chart summaries;
  add visible data-table alternatives to all charts next.
- [ ] Replace 9–10px operational text and verify zoom/contrast requirements.
- [ ] Make tables responsive with column controls, sticky identity columns, and
  compact card views.
- [ ] Add task-oriented navigation, global entity search, favorites, and recents.

Acceptance: core workflows work at 320, 768, 1024, and 1440px; WCAG 2.2 AA
automated checks pass; keyboard users can complete all primary workflows.

## Milestone 3: Dashboard and reporting redesign

- [ ] Replace equal-weight dashboard widgets with attention, change, and action
  hierarchy; add role-specific presets.
- [ ] Add drill-down filters to every KPI and visualization.
- [ ] Add freshness/confidence, selected baseline, period, goal, environment, and
  business-scope context to metrics.
- [ ] Replace/supplement radar charts with precise sorted bars/bullet charts.
- [ ] Add coverage waterfall, threat-group/tactic heatmap, detection-quality vs
  relevance quadrant, data-readiness funnel, contribution analysis, control
  overlap, backlog aging/throughput, validation outcomes, and risk burn-down.
- [ ] Store report definitions server-side with ownership, sharing, versioning,
  scopes, filters, and immutable run snapshots.
- [ ] Use shared report components/data for UI, HTML email, PDF, PPTX, CSV, JSON,
  and Markdown.
- [ ] Add preview, test-send, timezone, next-run, delivery history, classification,
  methodology, branding, pagination, and accessible alternatives.
- [ ] Add executive narrative plus traceable operational appendix.

Acceptance: one definition renders consistently across formats; every reported
number drills into source records and includes methodology/freshness metadata.

## Milestone 4: Workflow and product capabilities

- [ ] Add organizations/business units/environments/regions/SIEM scopes and
  scope-aware RBAC, records, dashboards, reports, and saved views.
- [ ] Add coverage goals and SLAs by tactic, threat, framework, scope, and asset
  criticality with breach notifications.
- [ ] Add detection lifecycle approvals, owners, review dates, evidence, and
  separation-of-duties controls.
- [ ] Add expiring accepted-risk exceptions with approvals and reminders.
- [ ] Model telemetry -> parser -> rule -> test -> technique dependencies,
  collection freshness, volume, parsing health, and failure impact.
- [ ] Add scenario comparison, including tool/data-source removal impact.
- [ ] Add date/scope/framework/threat comparison mode.
- [ ] Add integration health, stale feed, sync failure, credential expiry, retry,
  and run-history views.
- [ ] Add controlled immutable report sharing.

Acceptance: all new entities are scoped, audited, permission-checked, reportable,
and covered by lifecycle/integration tests.

## Milestone 5: Operational hardening

- [ ] Add encrypted backup, restore validation, scheduled backup, and disaster
  recovery documentation for SQLite and PostgreSQL.
- [ ] Add readiness/liveness subchecks, metrics, request IDs, scheduler health,
  queue/run telemetry, tracing hooks, and operational alerts.
- [ ] Add retention policies and legal-hold exclusions for audit, intelligence,
  notifications, report runs, and integration logs.
- [ ] Add PostgreSQL upgrade/migration and rollback tests.
- [ ] Add CSP hardening, dependency/SAST/container scanning, SBOM, image signing,
  threat model, and penetration-test checklist.
- [ ] **In progress:** Add route-level code splitting (complete), chart lazy loading, virtualization, query
  profiling, caching, and performance budgets.

Acceptance: restore drills pass; operational dashboards expose degraded
dependencies; release artifacts pass security and performance gates.

## Final release gate

- [ ] Update README, architecture, deployment, security, admin, reporting, API,
  accessibility, backup, and upgrade documentation.
- [ ] Publish a migration guide and breaking-change notes.
- [ ] Run the full verification matrix and record evidence for every acceptance
  criterion above.
