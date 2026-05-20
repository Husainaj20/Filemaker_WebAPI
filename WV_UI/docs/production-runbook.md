# Production Runbook

## Deployment Topology

- Node backend serves static frontend and `/api/*` routes.
- Browser/WebViewer calls backend only.
- Backend owns FileMaker Data API credentials and transport.
- Runtime modes:
  - `APP_DATA_MODE=mock`
  - `APP_DATA_MODE=filemaker`

## Environment Variables by Environment

Common:

- `APP_HOST`
- `APP_PORT`
- `LOG_LEVEL`
- `APP_DEFAULT_ROLE`
- `APP_ENV`
- `APP_VERSION`

FileMaker mode:

- `FILEMAKER_SERVER` or `FILEMAKER_BASE_URL`
- `FILEMAKER_DATABASE`
- `FILEMAKER_USERNAME`
- `FILEMAKER_PASSWORD`
- `FILEMAKER_VERIFY_SSL`
- `FILEMAKER_TIMEOUT_MS`
- `FILEMAKER_MAX_RETRIES`
- `FILEMAKER_SCHEMA_FILE`

Fallback control:

- `APP_ALLOW_MOCK_FALLBACK`

Readiness script controls:

- `CHECK_READY_BASE_URL`
- `CHECK_READY_ROLE`

## Mock vs FileMaker Mode Rules

- Mock mode is valid for development/testing and should not be used for real production workloads.
- Strict FileMaker mode should be used for production intent validation.
- Fallback mode can improve resilience but may mask FileMaker outages in production.

## WebViewer Setup Steps

1. Host backend where FileMaker WebViewer can reach it.
2. Configure WebViewer URL with optional runtime hints (`runtime`, `embedded`, `requestId`, `recordId`).
3. Confirm FileMaker script names from [docs/webviewer-integration.md](docs/webviewer-integration.md).
4. Validate bridge behavior in embedded runtime and no-op safety in standalone runtime.

## FileMaker Script and Mapping Checklists

- Script contract placeholders: [docs/webviewer-integration.md](docs/webviewer-integration.md)
- Mapping checklist: [docs/phase-2-5-filemaker-mapping-checklist.md](docs/phase-2-5-filemaker-mapping-checklist.md)

## Health and Diagnostics Endpoints

- `GET /api/health`
- `GET /api/diagnostics/v2-readiness`
- `GET /api/diagnostics/container-mapping`
- `GET /api/diagnostics/stability`
- `GET /api/diagnostics/deployment-readiness`
- `GET /api/diagnostics/webviewer`
- `GET /api/reports/summary`

## Smoke and Readiness Procedure

1. Run tests:
   - `npm test`
2. Run readiness:
   - `npm run check:ready`
3. Optional FileMaker smoke (safe environment only):
   - `npm run smoke:filemaker`
4. Optional mutation smoke (approved environment only):
   - `FILEMAKER_ENABLE_MUTATION_SMOKE=true npm run smoke:filemaker`

## Rollback Procedure

Use phase tags to rollback safely:

- `phase-1-lifecycle-mvp`
- `phase-2-filemaker-persistence`
- `phase-2-5-filemaker-mapping`
- `phase-3-request-detail-depth`
- `phase-4-operational-readiness`
- `phase-5-webviewer-filemaker-hardening`

Rollback approach:

1. Create a new hotfix/recovery branch from target rollback tag.
2. Validate runtime and tests.
3. Deploy recovered branch.
4. Avoid rewriting published history and tags.

## Logging and Monitoring Checklist

- Verify structured backend logs include trace IDs.
- Monitor error codes and fallback activation indicators.
- Monitor readiness endpoint status over time.
- Alert on repeated FileMaker connectivity failures.

## Secrets Handling Checklist

- Never commit `.env`.
- Keep `.env.example` placeholder-only.
- Do not log credentials, access tokens, or private hostnames.
- Restrict FileMaker credentials to backend runtime environment only.

## Known Limitations

- FileMaker script contract remains proposed until confirmed by FileMaker developer.
- WebViewer callback semantics are implementation-dependent across deployments.
- Mapping readiness depends on environment-specific schema confirmation.

## Final Go-Live Checklist

1. `npm test` passes.
2. `npm run check:ready` passes in deployment environment.
3. FileMaker schema mapping checklist confirmed.
4. WebViewer script names and payload contract confirmed.
5. Roles and permissions validated (`viewer`, `operator`, `admin`).
6. Diagnostics reviewed for warnings.
7. Rollback path and tags documented with on-call owner.
