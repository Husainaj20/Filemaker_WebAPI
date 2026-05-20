# Final Project Handoff

## Executive Summary

The Excess Land FMP-to-Web application is complete through Phase 5 and is release-aligned on `phase-5-webviewer-filemaker-hardening`.

Current release posture:

- Latest release commit: `5bd3c285cbece9962fc849accf0c3fa396f861ec`
- Latest release tag: `phase-5-webviewer-filemaker-hardening`
- Alignment: `HEAD == origin/main == phase-5-webviewer-filemaker-hardening`
- Test gate: `npm test` passing (`65/65`)
- Readiness gate: `npm run check:ready` passing in mock-mode runtime
- Mock health gate: `ready=true`, `mode=mock`

This package is ready for production cutover validation against real FileMaker, with remaining go-live blockers limited to environment-specific FileMaker confirmations.

## Current Latest Release/Tag

- Commit: `5bd3c285cbece9962fc849accf0c3fa396f861ec`
- Commit message: `Phase 5: harden WebViewer FileMaker integration`
- Tag: `phase-5-webviewer-filemaker-hardening`
- Branch state at audit time: `origin/main` at same commit

## Phase-by-Phase Summary

### Phase 1: Lifecycle MVP

- Tag: `phase-1-lifecycle-mvp`
- Commit: `d6a3bcae306f322a7e8518c17e0c8941901591f8`
- Delivered canonical lifecycle and baseline request operations.

### Phase 2: FileMaker Persistence Foundation

- Tag: `phase-2-filemaker-persistence`
- Commit: `496ad108c14ae9ed6b5c8ba610da8cc8e0f9ed6b`
- Added repository-mode architecture with FileMaker integration boundary and fallback patterns.

### Phase 2.5: Mapping Hardening

- Tag: `phase-2-5-filemaker-mapping`
- Commit: `c16ff67f11f7f7262b64b1009509315b9e3a8cae`
- Added mapping diagnostics and checklist-driven schema confirmation workflow.

### Phase 3: Request Detail Depth

- Tag: `phase-3-request-detail-depth`
- Commit: `be74ac051c94100b30fb9c715feecb5dd2027c90`
- Added deep request detail operations (notes, documents, response metadata, audit depth).

### Phase 4: Operational Readiness

- Tag: `phase-4-operational-readiness`
- Commit: `b5cfad57aedab6ec24ec57d39436908cfbf8fbfe`
- Added roles/permissions, reporting/export, and deployment-readiness diagnostics.

### Phase 5: WebViewer/FileMaker Integration Hardening

- Tag: `phase-5-webviewer-filemaker-hardening`
- Commit: `5bd3c285cbece9962fc849accf0c3fa396f861ec`
- Added WebViewer runtime bridge helper, embedded diagnostics, and request-open script contract handling.

## Core Lifecycle Status

Canonical lifecycle is active and preserved:

- `draft`
- `request_sent`
- `waiting_response`
- `completed`

Lifecycle transitions, reporting states, and UI controls are aligned with this canonical model.

## API Capabilities

Primary capabilities:

- Request CRUD and lifecycle transitions
- Request detail operations:
  - audit history
  - notes
  - document placeholders/downloads
  - response metadata
- Reporting/export:
  - summary JSON
  - CSV export
- Operational diagnostics:
  - health
  - mapping/readiness probes
  - deployment readiness
  - WebViewer runtime diagnostics

## Frontend Capabilities

- Request list and detail workspace
- Lifecycle action controls (send/start/complete)
- Request-type/detail forms
- Notes and document placeholder flows
- Role-aware UI behavior
- Embedded runtime awareness for WebViewer mode
- Graceful fallback when FileMaker bridge is unavailable

## Role/Reporting/Export Capabilities

Role model:

- `viewer`: read-focused usage
- `operator`: write + export usage
- `admin`: operator + deployment diagnostics

Reporting/export:

- `GET /api/reports/summary`
- `GET /api/reports/summary.json`
- `GET /api/reports/requests.csv`

## FileMaker Adapter Status

Implemented and testable without requiring live FileMaker for normal suite runs.

Status categories:

- Mock-ready: yes
- Adapter-ready: yes
- Production-confirmed against real FileMaker: pending environment confirmation

## WebViewer Bridge Status

Delivered bridge hardening includes:

- runtime detection (`standalone` vs embedded)
- safe script invocation wrapper
- deterministic payload serialization
- request-open contract (`WV_Request_Open`)
- safe no-op behavior when bridge is absent
- optional centralized `fmp://` fallback URL builder

## Diagnostics/Readiness Endpoints

- `GET /api/health`
- `GET /api/diagnostics/v2-readiness`
- `GET /api/diagnostics/container-mapping`
- `GET|POST /api/diagnostics/stability`
- `GET /api/diagnostics/deployment-readiness`
- `GET /api/diagnostics/webviewer`

## How To Run Locally (Mock Mode)

From the app directory:

```bash
APP_DATA_MODE=mock APP_ALLOW_MOCK_FALLBACK=true node src/server/server.js
```

Open:

- `http://127.0.0.1:3080`

## How To Run Tests

```bash
npm test
```

## How To Run Readiness Check

Start the app first (mock or target mode), then:

```bash
npm run check:ready
```

## How To Run FileMaker Smoke Test

Read-only smoke:

```bash
npm run smoke:filemaker
```

Mutation smoke (approved non-production test environments only):

```bash
FILEMAKER_ENABLE_MUTATION_SMOKE=true npm run smoke:filemaker
```

## Deployment Checklist (High Level)

- Confirm release/tag alignment on `origin/main`
- Configure runtime env vars using placeholders and secret manager values
- Validate FileMaker layouts/fields/stage mappings
- Validate container/document mappings
- Validate WebViewer URL and script contract
- Run tests + readiness + smoke sequence
- Confirm rollback tags and operator sign-off

Detailed checklist: `docs/production-go-live-checklist.md`

## Rollback Tags

- `phase-1-lifecycle-mvp`
- `phase-2-filemaker-persistence`
- `phase-2-5-filemaker-mapping`
- `phase-3-request-detail-depth`
- `phase-4-operational-readiness`
- `phase-5-webviewer-filemaker-hardening`

## Known Limitations

- Real FileMaker behavior is environment-specific and must be confirmed in target deployment.
- Script contract names/payload assumptions require explicit FileMaker-side confirmation.
- Placeholder mappings must be resolved before strict production mode.
- Fallback mode can mask outages if used in production.

## Production Go-Live Blockers

The following must be completed before production go-live sign-off:

- Real FileMaker credential validation and Data API auth check
- Confirmed layouts and required field mappings
- Confirmed stage map values for all lifecycle states
- Confirmed container/document field mappings
- Confirmed WebViewer script contract execution in embedded runtime
- Successful smoke/readiness checks against target environment

## Real FileMaker Confirmation Checklist

- FileMaker Data API login succeeds with production-intended service account
- Requests layout and records layout return expected fields
- Required request mappings are non-placeholder and complete
- Stage map values correctly round-trip for all canonical states
- Document container fields confirm upload/download expectations
- Embedded WebViewer can execute `WV_Request_Open` with expected payload
- Deployment-readiness diagnostics report `ready=true` in strict runtime

## Support/Troubleshooting Notes

- Use `x-trace-id` for API error correlation
- Verify role headers (`x-role`, `x-user`) for permission issues
- Check `api/health` diagnostics for mode/fallback/mapping status
- Use deployment-readiness and WebViewer diagnostics to isolate runtime mismatches
- Keep `.env` out of source control; rely on placeholders in `.env.example`

## Stash Preservation Note

A local Desktop stash backup remains intentionally untouched during this handoff:

- `stash@{0}` exists in the Desktop dirty worktree as preserved local backup
- It was inspected only (not applied/popped/dropped)
- Patch backup file exists at `/Users/husainaljamal/phase5-unexpected-stash0.patch`

This stash should be manually reviewed and optionally dropped later only after confirming it contains no unique work.
