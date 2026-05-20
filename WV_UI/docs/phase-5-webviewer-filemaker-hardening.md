# Phase 5: WebViewer/FileMaker Integration Hardening

## Scope

Phase 5 hardens standalone and embedded WebViewer operation without requiring live FileMaker for normal tests.

Delivered focus:

- frontend WebViewer runtime and bridge helper
- safe FileMaker script invocation contract and payload structure
- deep-link and request-open hardening
- embedded runtime diagnostics endpoint and UI panel
- production runbook and WebViewer integration documentation
- tests for bridge behavior and diagnostics safety

## Audit Summary (Phase 5.A)

Audit of current runtime integration points before changes:

- active runtime did not call `window.FileMaker.PerformScript` directly
- active runtime did not use direct `fmp://` navigation in current frontend modules
- legacy WebViewer references existed in docs/checklists as assumed placeholders
- active frontend request selection used local detail view only
- backend diagnostics existed for health/mapping/readiness but not embedded runtime context
- query parameter handling existed for backend filters and API calls, but no hardened embedded deep-link contract in active frontend runtime

Files reviewed during audit:

- `src/frontend/app.js`
- `src/frontend/api-client.js`
- `src/server/app.js`
- `docs/filemaker-data-api.md`
- `docs/phase-2-5-filemaker-mapping-checklist.md`
- `docs/runbook.md`

## Implemented Hardening

### Runtime/bridge helper

Added:

- `src/frontend/webviewer-bridge.js`

Key APIs:

- `getRuntimeContext()`
- `isFileMakerBridgeAvailable()`
- `callFileMakerScript(scriptName, payload, options)`
- `buildFileMakerPayload(action, requestId, metadata)`
- `getBridgeDiagnostics()`
- `buildFileMakerUrl(scriptName, payload)`

Behavior:

- safely detects standalone vs embedded mode
- safely detects FileMaker bridge methods if present
- validates script names before invocation
- deterministically serializes payload JSON
- no-ops with structured error if bridge is unavailable
- optional fallback to `fmp://` transport using centralized URL builder

### Deep-link and request-open hardening

Frontend request open now:

- preserves local detail view behavior
- supports deep-link request selection via runtime context query params
- calls FileMaker script contract (`WV_Request_Open`) when embedded runtime is detected
- gracefully falls back to local view with user message when bridge is unavailable

### Embedded diagnostics

Added backend endpoint:

- `GET /api/diagnostics/webviewer`

Returns safe fields only:

- runtime mode and embedded flags
- bridge availability hints
- active role and backend mode
- mapping readiness summary
- app version/environment
- warnings for production-risk combinations

Warnings include:

- mock mode in production
- fallback masking FileMaker outages in production
- embedded runtime without bridge

## Validation

Bridge and diagnostics are covered by Phase 5 tests and continue to run in mock mode without live FileMaker.

See:

- `tests/frontend/webviewer-bridge.test.js`
- `tests/frontend/api-client.test.js`
- `tests/server/phase4-authorization-reporting.test.js`
