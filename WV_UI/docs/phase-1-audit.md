# Phase 1 Audit: Excess Land Lifecycle MVP

## Executive Summary
Phase 1 is complete for the core Excess Land request lifecycle in mock mode. The application now supports a working end-to-end path through both API and UI: create request, send request, mark in progress, and complete request. Backend contract tests and frontend request-client tests are passing, and manual browser click-through validation is successful.

## What Works Now
- Request creation through API and UI creates records in `draft` stage.
- Send action transitions `draft` -> `request_sent` and stamps `requestEmail.sentAt`.
- Start/In Progress action transitions `request_sent` -> `waiting_response`.
- Complete action transitions `waiting_response` -> `completed` and stamps `response.completedOn`.
- New Request modal validates required fields (`title`, `requester`) before submit.
- Lifecycle buttons are stage-aware in UI to prevent invalid core actions.
- Friendly lifecycle labels are shown in list and detail views.
- Sent/completed dates are visible in workflow metadata.
- Error feedback is explicit for validation and lifecycle failures.

## Full Lifecycle Verified
Verified path:
1. Create Request -> `draft`
2. Send Request -> `request_sent` (+ `requestEmail.sentAt`)
3. Mark In Progress -> `waiting_response`
4. Complete Request -> `completed` (+ `response.completedOn`)

Verified error behavior:
- Invalid lifecycle request ID returns HTTP 404.
- Missing requester on create returns HTTP 400.

## API Routes Involved
- `GET /api/health`
- `GET /api/requests`
- `POST /api/requests`
- `POST /api/requests/:id/send`
- `POST /api/requests/:id/start`
- `POST /api/requests/:id/complete`
- `PUT /api/requests/:id` (save/dirty-state persistence before lifecycle actions)

## Frontend Files Involved
- `src/frontend/app.js`
- `src/frontend/api-client.js`
- `src/frontend/main.js`
- `src/frontend/styles.css`
- `tests/frontend/api-client.test.js`

## Backend and Shared Files Involved
- `src/server/app.js`
- `src/server/services/request-service.js`
- `src/server/config.js`
- `src/server/filemaker/filemaker-client.js`
- `src/server/repositories/filemaker-request-repository.js`
- `src/server/repositories/mock-request-repository.js`
- `src/shared/requests/request-model.js`
- `src/shared/requests/request-workflow.js`

## Test Coverage Summary
- Full suite status: passing.
- Current count: 28 tests passed, 0 failed.
- Coverage includes:
  - lifecycle route behavior and status transitions
  - request service transition validation and diagnostics
  - records/parents contract behavior
  - frontend API client contract checks
  - shared workflow transition behavior

## Manual UI Verification Summary
Manual browser regression in mock mode verified:
- New Request modal opens and validates required fields.
- Create Request succeeds and renders new request in list/detail.
- Send Request updates stage and sent date.
- Mark In Progress updates stage.
- Complete Request updates stage and completed date.
- Success and error flash messages are visible and accurate.
- Core lifecycle buttons are active only when valid for current stage.

## Mock-Mode Configuration
Use this configuration for stable local Phase 1 behavior:
- `APP_DATA_MODE=mock`
- `APP_ALLOW_MOCK_FALLBACK=true`
- Example launch: `APP_PORT=3100 APP_DATA_MODE=mock APP_ALLOW_MOCK_FALLBACK=true node src/server/server.js`

Health check expectation:
- `GET /api/health` returns `ready=true` in mock mode.

## Known Limitations
- Mock mode is the authoritative baseline for Phase 1; FileMaker production persistence is not yet the default verified path.
- Non-core/advanced transitions may still require additional fields and are not the primary Phase 1 acceptance path.
- Modules beyond Requests are placeholders (Records/Activity/Settings planned).
- No RBAC/auth enforcement in lifecycle actions yet.

## Intentionally Deferred
- FileMaker credential wiring and production data-path hardening.
- Role-based access control and permission model.
- Advanced dashboards/reporting and deployment hardening.
- Full attachment workflow hardening across production container/document paths.

## Phase 2 Readiness Checklist
- [x] Core lifecycle flow verified in API and UI.
- [x] Required validation and error codes verified (400/404).
- [x] Local mock-mode health and runtime stable.
- [x] Automated test suite passing.
- [x] Baseline documentation captured.
- [ ] FileMaker mode end-to-end lifecycle verification with real credentials/layouts.
- [ ] Retry/backoff and operational alerting validation for Data API failures.
- [ ] Environment/runbook validation for non-mock deployment path.

## Recommended Next Phases
1. **Phase 2: FileMaker Persistence Hardening**
   - Validate lifecycle flow in FileMaker mode with real credentials/layout mappings.
   - Confirm diagnostics/retry behavior for connectivity and layout errors.
2. **Phase 3: Request Detail Depth**
   - Harden attachment/document UX and persistence.
   - Expand response artifact handling and audit quality.
3. **Phase 4: Access, Reporting, Deploy**
   - Add RBAC, dashboards, reporting, and deployment readiness.
4. **Phase 5: WebViewer/FileMaker Integration Hardening**
   - Production hardening for integration scripts, payload contracts, and ops runbooks.
