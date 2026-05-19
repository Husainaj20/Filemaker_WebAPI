# Phase 2 Persistence Audit: FileMaker Hardening

## Executive Summary
Phase 2 is complete for persistence hardening. The application now has a clean persistence adapter boundary, safe FileMaker integration behavior, and explicit fallback controls while preserving the Phase 1 mock-mode lifecycle baseline.

## What Changed in Phase 2
- Added a request persistence adapter boundary used by API routes.
- Kept lifecycle rules centralized in the request service.
- Added FileMaker-aware repository/client hardening with timeout, re-auth handling, and diagnostics.
- Added fallback repository wrapper to switch from FileMaker to mock only when explicitly allowed.
- Expanded health diagnostics with requested mode, active mode, fallback state, readiness, and FileMaker connectivity status.
- Added mode and fallback-focused tests and an opt-in FileMaker smoke script.
- Updated runbook and FileMaker docs for configuration and troubleshooting.

## Persistence Adapter Architecture
- Route layer delegates to the persistence adapter.
- Persistence adapter delegates to request service methods.
- Request service remains the single lifecycle authority for create/send/start/complete logic.
- Repository implementations provide storage behavior:
  - mock repository
  - filemaker repository
  - fallback wrapper repository (filemaker primary, mock fallback)

This preserves consistent lifecycle behavior across all data modes.

## Data Mode Behavior
### mock mode
- Uses mock repository directly.
- Ready in local baseline mode.

### filemaker mode (strict)
- Uses filemaker repository directly.
- Missing/invalid FileMaker config produces not-ready health and request errors (for example 503 with config-incomplete error).
- No automatic mock fallback.

### filemaker mode with fallback
- Uses fallback wrapper with filemaker primary and mock fallback.
- FileMaker transport/config failures activate fallback only when APP_ALLOW_MOCK_FALLBACK=true.
- Health reports fallback active and active mode switches to mock.

## FileMaker Client and Repository Behavior
- Session token login and reuse.
- Re-login on session expiration.
- Configurable request timeout.
- Safe retries for read operations only.
- Structured error codes and diagnostic details.
- No credentials included in response payloads or logs.
- Mapper-based field conversion between canonical request shape and FileMaker fields.
- Stage mapping support via schema stageMap for canonical stages:
  - draft
  - request_sent
  - waiting_response
  - completed

## Health and Readiness Behavior
Health now reports:
- requestedMode
- activeMode
- ready
- fallbackActive and fallback details
- filemaker configured/connectivity diagnostics

Strict filemaker mode with incomplete config reports ready=false and request failures.
Fallback-enabled filemaker mode degrades safely to mock mode when filemaker is unavailable.

## Environment Variables Added or Expanded
- APP_DATA_MODE
- APP_ALLOW_MOCK_FALLBACK
- FILEMAKER_SERVER
- FILEMAKER_BASE_URL
- FILEMAKER_DATABASE
- FILEMAKER_USERNAME
- FILEMAKER_PASSWORD
- FILEMAKER_VERIFY_SSL
- FILEMAKER_TIMEOUT_MS
- FILEMAKER_MAX_RETRIES
- FILEMAKER_LAYOUT_REQUESTS
- FILEMAKER_LAYOUT_RECORDS
- FILEMAKER_LAYOUT_SESSIONS
- FILEMAKER_SCHEMA_FILE
- FILEMAKER_RECORD_FIELD_ID
- FILEMAKER_RECORD_FIELD_DISPLAY
- FILEMAKER_RECORD_FIELD_STATUS
- FILEMAKER_RECORD_FIELD_LOCATION
- FILEMAKER_CONTAINER_SUPPORTING_PDF
- FILEMAKER_ENABLE_MUTATION_SMOKE

## Test Coverage Summary
- All automated tests passing at closeout.
- Added tests for:
  - config mode/setting resolution
  - fallback wrapper behavior (enabled vs disabled)
  - filemaker fallback/strict behavior via API
  - mock lifecycle behavior retained under updated persistence wiring

## Smoke Test Instructions
Read-only FileMaker smoke:
- npm run smoke:filemaker

Mutation smoke (explicitly guarded):
- FILEMAKER_ENABLE_MUTATION_SMOKE=true npm run smoke:filemaker

Mutation smoke remains opt-in and should only run against a safe non-production environment.

## Real FileMaker Cutover Checklist
- Confirm real requests layout name.
- Confirm records layout name.
- Confirm lifecycle stage storage field and stage values.
- Confirm request/response/supporting container field names.
- Confirm primary key and required mapped fields.
- Validate read-only smoke in filemaker strict mode.
- Validate guarded mutation smoke in a safe environment.
- Confirm fallback policy for production (enabled or disabled).

## Known Blockers
- Real production FileMaker layouts/field names/stage values/container fields are not yet confirmed.
- Production cutover remains blocked until those mapping details are validated.

## Risks Before Production Use
- Mapping mismatch risk between canonical fields and live FileMaker layout.
- Stage value mismatch risk without confirmed production stage mapping.
- Container field mismatch for supporting uploads.
- Operational ambiguity if fallback policy is enabled without monitoring/alerting.

## Recommended Next Phases
1. Complete real FileMaker mapping confirmation and run strict-mode cutover validation.
2. Then proceed to Phase 3 domain expansion work (attachments/audit timeline/response artifacts) only after persistence mappings are confirmed stable.
