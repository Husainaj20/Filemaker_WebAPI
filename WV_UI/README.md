# ExcessLand App

This project runs as a full-stack app with a lifecycle-focused backend.

- Frontend: native-module SPA in `src/frontend`
- Backend: Node HTTP service in `src/server`
- Shared request domain: `src/shared/requests`
- Canonical lifecycle: `draft -> request_sent -> waiting_response -> completed`

The legacy WebViewer implementation remains on disk as reference (`app.js`, `dashboard.html`, `disposal.html`, `request-workflow/`, and related files), while the active runtime entrypoint is `index.html`.

## Run locally

Default startup:

```bash
node src/server/server.js
```

Open `http://127.0.0.1:3080`.

### Mock mode (Phase 1 baseline)

```bash
APP_DATA_MODE=mock APP_ALLOW_MOCK_FALLBACK=true node src/server/server.js
```

### FileMaker mode (strict)

```bash
APP_DATA_MODE=filemaker APP_ALLOW_MOCK_FALLBACK=false node src/server/server.js
```

### FileMaker mode with safe fallback

```bash
APP_DATA_MODE=filemaker APP_ALLOW_MOCK_FALLBACK=true node src/server/server.js
```

If FileMaker connectivity/config fails and fallback is enabled, runtime degrades safely to mock mode and reports fallback in health diagnostics.

## FileMaker mode

The browser never calls FileMaker directly. Credentials remain server-side.

Required variables:

- `FILEMAKER_SERVER` (or `FILEMAKER_BASE_URL`)
- `FILEMAKER_DATABASE`
- `FILEMAKER_USERNAME`
- `FILEMAKER_PASSWORD`

Recommended:

- `FILEMAKER_VERIFY_SSL`
- `FILEMAKER_TIMEOUT_MS`
- `FILEMAKER_MAX_RETRIES`
- `FILEMAKER_SCHEMA_FILE`

## Diagnostics

- `GET /api/health`
- `GET /api/diagnostics/v2-readiness`
- `GET /api/diagnostics/container-mapping`
- `GET|POST /api/diagnostics/stability`

## Tests

```bash
npm test
```

## FileMaker smoke

Read-only smoke:

```bash
npm run smoke:filemaker
```

Mutation smoke (opt-in only):

```bash
FILEMAKER_ENABLE_MUTATION_SMOKE=true npm run smoke:filemaker
```

## Docs

- [Current State Audit](docs/current-state-audit.md)
- [Missing UI Inventory](docs/missing-ui-inventory.md)
- [Target Architecture](docs/target-architecture.md)
- [Phase 1 Audit](docs/phase-1-audit.md)
- [Phase 2 Persistence](docs/phase-2-persistence.md)
- [FileMaker Data API Integration](docs/filemaker-data-api.md)
- [Runbook](docs/runbook.md)
