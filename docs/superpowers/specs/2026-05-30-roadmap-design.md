# MitreMap Roadmap Design
**Date:** 2026-05-30
**Audience:** Detection engineers, analysts, security managers, team leads

---

## Context

MitreMap is a mature enterprise detection coverage platform with 16 pages, 13 DB migrations, and a rich feature set spanning ATT&CK matrix visualization, detection management, threat intelligence, red/purple team exercises, compliance mapping, TAXII ingestion, and reporting.

The two primary pain points identified are:
1. **Search & discoverability** — no global search; finding things requires navigating to a specific page
2. **Workflow continuity** — common multi-step workflows (gap → detection, gap → assignment, technique → exercise) require too many context switches

The roadmap targets both daily operational users (analysts, detection engineers) and managers/team leads needing reporting and posture visibility.

---

## Section 1 — Foundation: Search, Navigation & Workflow

### Global Command Palette (`Cmd/Ctrl+K`)
A keyboard-triggered command palette that searches across detections, techniques, threat groups, gaps, exercises, and tools in real time. Results are grouped by entity type with deep links. Fully keyboard-navigable (arrow keys, Enter to navigate, Escape to dismiss).

Implementation: client-side search against cached API data with a debounced fallback to server search for large datasets. The palette is a floating modal rendered at the app root, outside all page components.

### Quick-Action Shortcuts
Context-aware actions that eliminate multi-page workflows:
- **"Create detection from this gap"** — available on Gap Analysis and Priority Queue rows; opens a pre-populated detection form (technique ID, name suggestion, status=planned) without leaving the page
- **"Add to exercise scope"** — available on ATT&CK matrix cells and gap rows; adds a technique to any active exercise via a small popover picker
- **"Assign this gap"** — one-click assignment from Gap Analysis; opens an inline assignee/priority/due-date form directly in the row

### In-App Notification Center
A persistent bell icon in the sidebar with an unread badge. Notification types:
- Webhook alert rule triggered (coverage dropped below threshold)
- TAXII batch staged and ready for analyst review
- Deprecated technique detected in active detections
- Assignment due date within 48 hours

Notifications are stored server-side (new `notifications` table) so they persist across sessions and can be marked read/dismissed. A "mark all read" action clears the badge.

### Breadcrumb Navigation
Lightweight breadcrumbs on pages that are commonly reached from another page (e.g. technique detail from ATT&CK matrix, threat group from coverage view). Browser-history-aware back button restores scroll position and filter state.

---

## Section 2 — Compliance Expansion

### New Frameworks
Three new frameworks using the existing schema (`compliance_frameworks` → `compliance_controls` → `technique_compliance`) — no schema changes required, only migration data:

| Framework | Coverage focus |
|---|---|
| ISO 27001:2022 | Annex A controls mapped to ATT&CK techniques |
| PCI DSS v4.0 | Requirements 10 & 11 (logging, monitoring, intrusion detection) |
| SOC 2 TSC | CC6–CC9 (logical access, change management, risk mitigation) |

### Compliance Trend Tracking
Extend the existing `coverage_snapshots` mechanism to record per-framework compliance percentage at snapshot time. The Reports → Compliance tab shows each framework trending over the same 7D/30D/90D/All time ranges as overall coverage.

### Compliance Gap Reports
Per-framework export (PDF and CSV) listing every control with no detection coverage, the ATT&CK techniques it maps to, and the current priority score for each gap. Surfaced as a download button on the Compliance page and as an option in the existing Reports page exports section.

### Framework Comparison View
A new tab on the Compliance page: a side-by-side summary table showing all configured frameworks simultaneously — framework name, control count, covered controls, and coverage percentage — so gaps affecting multiple frameworks are visible at a glance.

---

## Section 3 — SIEM Integrations & External Connectors

### Integrations Page
A new top-level page under the System nav section ("Integrations"). Each integration is a configured connection with:
- Credential storage (AES-256 encrypted at rest in the `siem_integrations` table; key derived from `JWT_SECRET` — credentials must be reversible for outbound calls unlike API keys which are hashed one-way)
- Connection test (validates auth + reachability before saving)
- Last sync timestamp + status
- Enable/disable toggle

### SIEM Push/Pull

All SIEM integrations follow the same review-before-commit model as TAXII: a staged diff of what would change is presented to the analyst before anything is pushed to the SIEM.

| Platform | Push | Pull | Rule format |
|---|---|---|---|
| Microsoft Sentinel | Analytics Rules via Azure Monitor REST API | Enabled/disabled rule status | SIGMA → KQL (sigma-cli) |
| Splunk | Saved Searches via Splunk REST API | Alert fire counts → TP/FP counters | SIGMA → SPL (sigma-cli) |
| Elastic/OpenSearch | Detection Engine rules | Rule enable status | SIGMA → EQL (sigma-cli) |
| CrowdStrike | Custom IOA rules | Detection event counts | SIGMA → native (sigma-cli) |
| QRadar | Custom rules via QRadar REST API | Rule status | SIGMA → AQL (sigma-cli) |
| Google SecOps (Chronicle) | Detection rules via Chronicle Rules API | Rule enable status | SIGMA → YARA-L 2.0 (pySigma-backend-chronicle) |

Push flow: analyst selects detections → preview diff → confirm → push. Pull flow: background sync updates detection status fields and fires effectiveness counter increments.

### GitHub SIGMA Sync
Configure a GitHub repo + branch + path glob. MitreMap accepts an inbound webhook (or polls on a schedule) for `.yml` file changes, runs them through the existing SIGMA parser, and stages new/updated rules in an import review queue. Approved rules import as detections. Rejected rules are logged with a reason.

### Ticketing Connectors (Jira & ServiceNow)
When a gap assignment is created or an exercise finding is logged, optionally create a linked ticket. The ticket ID is stored on the assignment/finding record and rendered as a deep link. Status sync (ticket closed → assignment resolved) runs on a configurable poll interval. Configuration: base URL, auth token, default project/queue.

---

## Section 4 — Intelligence Depth

### Campaign Timelines
A campaign model added to threat groups: each group can have named campaigns with a date range and a scoped subset of techniques. New `group_campaigns` and `campaign_techniques` tables. The ATT&CK matrix gains a campaign filter dropdown when viewing a threat group overlay. TAXII parser extended to ingest STIX campaign objects.

### CVE/NVD Mapping
A CVE tracker linking CVEs to ATT&CK techniques they enable. CVE metadata (CVSS score, affected products, patch status) pulled from the NVD REST API (public, no auth). New `cves` and `cve_techniques` tables. Gap Analysis gains a "Has known CVE" column and filter, adding CVE exposure as an additional priority signal in gap scoring.

### IOC Library
A lightweight indicator library (IPs, domains, file hashes, URLs) associated with threat groups. Not a full TIP — records known indicators per group, linked to techniques where relevant. Exportable as a STIX 2.1 bundle or CSV. New `indicators` and `indicator_groups` tables. TAXII parser extended to ingest STIX indicator objects.

### Extended Threat Group Import
A "Import from ATT&CK" modal on the Threat Groups page that fetches the full MITRE ATT&CK STIX catalogue (130+ groups) and presents a searchable checklist. Selected groups are imported with their technique associations pre-populated. Groups already in the database are skipped (duplicate detection by ATT&CK group ID).

---

## Section 5 — UX Polish & Workflow Continuity

### Detection Workflow
- **Inline quick-edit** — click a status or severity cell in the detections table to change it in place without opening the full modal. Saves via a PATCH immediately on selection.
- **Quality score improvement suggestions** — when a detection scores C or below, the quality score panel lists specific actionable reasons (e.g. "No test results recorded", "FP rate is high — consider a tuning period", "No severity set"). Each suggestion links to the relevant workflow action.
- **Bulk tag assignment** — tag picker added to the existing multi-select bulk action bar alongside bulk status update and bulk delete.

### ATT&CK Matrix Enhancements
- **Threat group overlay mode** — select up to two threat groups; the matrix color-codes each cell: both groups (red), group A only (orange), group B only (yellow), neither (normal status color). A legend explains the overlay.
- **Filter persistence** — technique status filter, threat group overlay, and tactic selection persist in `sessionStorage` so navigating away and back restores the matrix state.
- **Gap-to-detection shortcut** — hover action on gap cells reveals a "+" button that opens a pre-populated new detection form (same as the quick-action described in Section 1).

### Gap & Priority Queue Improvements
- **Saved filter presets** — analysts can name and pin filter/sort combinations (e.g. "Financial sector + Critical + Defense Evasion"). Stored per-user in `localStorage`. Pinned presets appear as quick-select chips above the filter row.
- **Column visibility toggle** — a column picker (gear icon) on the gap table lets users show/hide individual columns. Preference stored in `localStorage`.
- **One-click "Assign to self"** — a button on each Priority Queue row that creates an assignment to the current user with default priority, bypassing the modal.

### Dashboard Personalization
- **Configurable widget layout** — widgets can be reordered by drag-and-drop. Show/hide toggles for each widget. Layout stored per-user in `localStorage`.
- **Risk score widget** — surfaces the existing `/api/risk/score` data (currently API-only) as a dashboard card showing the 0–100 score with a color-coded gauge and a collapsed tactic breakdown.

### Table Density Toggle
A global compact/comfortable/spacious setting in the user preferences menu (bottom of sidebar). Applies a CSS class at the app root that adjusts row padding and font size across all data tables. Stored in `localStorage`.

---

## Section 6 — Reporting & Exports

### Scheduled Report Delivery
Configure any built-in report to be emailed on a cron schedule (daily, weekly, monthly). SMTP configuration stored in the settings table. Report is rendered server-side via the existing report API endpoints and attached as PDF. Recipient list is configurable per schedule. New `report_schedules` table.

### Compliance Gap Report Exports
Per-framework PDF and CSV exports of controls with no detection coverage. Surfaced as download buttons on the Compliance page and as a new export option under Reports → Exports. PDF format matches the existing report builder styling.

### Executive Exercise Summary
A condensed one-page exercise report variant (in addition to the existing full technical report): detection rate gauge, top 3 findings by severity, recommended remediation priority list. Exportable as a standalone PDF from the exercise detail page.

### STIX Bundle Export
Export the current threat group + technique + IOC dataset as a valid STIX 2.1 bundle via `GET /api/exports/stix`. Useful for sharing posture data with partners or ingesting into other TIPs. Complements the existing ATT&CK Navigator layer export.

### Report Builder Enhancements
Two new section types added to the existing ReportBuilder component:
- **Compliance Framework Summary** — pulls coverage percentage and gap count for all configured frameworks; renders as a table
- **Integration Sync Status** — shows last push/pull timestamp, rule count, and status per configured SIEM connector (only visible once Section 3 is built)

---

## Data Model Changes Summary

| New table | Purpose | Section |
|---|---|---|
| `notifications` | Per-user in-app notifications | 1 |
| `group_campaigns` | Named campaigns per threat group | 4 |
| `campaign_techniques` | Technique scope per campaign | 4 |
| `cves` | CVE metadata from NVD | 4 |
| `cve_techniques` | CVE → ATT&CK technique links | 4 |
| `indicators` | IOC records | 4 |
| `indicator_groups` | IOC → threat group associations | 4 |
| `siem_integrations` | SIEM connector configurations | 3 |
| `siem_sync_log` | Push/pull history per integration | 3 |
| `github_sync_configs` | GitHub SIGMA sync configurations | 3 |
| `ticketing_configs` | Jira/ServiceNow connection configs | 3 |
| `report_schedules` | Scheduled report delivery configs | 6 |

All other changes (compliance frameworks, dashboard layout, filter presets, column visibility) use the existing settings/localStorage pattern and require no schema changes.

---

## Implementation Order

Sections have no hard dependencies on each other except:
- Section 3 (Integrations) must exist before the "Integration Sync Status" report builder section (Section 6) is built
- Section 4 IOC library must exist before TAXII IOC ingestion can be extended

Recommended parallel streams:

| Stream | Sections | Why parallel |
|---|---|---|
| Foundation | 1 | Ships first; unblocks discoverability for all other features |
| Compliance | 2 | Pure backend data + frontend UI; no dependencies |
| Integrations | 3 | Backend-heavy; can develop independently |
| Intelligence | 4 | New data model; independent of other streams |
| UX & Reporting | 5 + 6 | Frontend-heavy; can run alongside backend streams |
