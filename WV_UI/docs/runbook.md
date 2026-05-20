# Runbook

## Local development

```bash
node src/server/server.js
```

Open `http://127.0.0.1:3080`.

## Runtime modes

Mock baseline:

```bash
APP_DATA_MODE=mock APP_ALLOW_MOCK_FALLBACK=true node src/server/server.js
```

FileMaker strict mode:

```bash
APP_DATA_MODE=filemaker APP_ALLOW_MOCK_FALLBACK=false node src/server/server.js
```

FileMaker safe-fallback mode:

```bash
APP_DATA_MODE=filemaker APP_ALLOW_MOCK_FALLBACK=true node src/server/server.js
```

In safe-fallback mode, FileMaker failures switch runtime persistence to mock and expose fallback state in health diagnostics.

## Debugging

- Each backend response includes `x-trace-id`
- Errors include a structured code and trace id
- Server logs are emitted as structured JSON lines
- Mock mode persists to `data/mock-requests.json`
- Diagnostics endpoints:
  - `/api/diagnostics/v2-readiness`
  - `/api/diagnostics/container-mapping`
  - `/api/diagnostics/stability?iterations=10`
  - `/api/health`

## Switching to FileMaker

1. Set FileMaker env vars.
2. Point `FILEMAKER_SCHEMA_FILE` at the correct field mapping.
3. Restart the server.
4. Verify `/api/health` and then list/create/update requests from the UI.

## Mapping confirmation workflow (Phase 2.5)

1. Use `config/filemaker-schema.example.json` as the mapping template.
2. Confirm layout names (`requests`, `records`, optional `sessions`).
3. Confirm required request field mappings (`id`, `stage`, `status`, timing fields, `payloadJson`).
4. Confirm record list mappings (`record id`, `display`, `status`, optional `location`).
5. Confirm canonical stage values map correctly via `stageMap`.
6. Confirm optional container field mappings before attachment expansion.
7. Verify mapping diagnostics in `/api/health`:
  - `connectionReady`
  - `mappingReady`
  - `missingMappings`
  - `placeholderMappings`
  - `schemaSource`
  - `layoutStatus`

Checklist:

- `docs/phase-2-5-filemaker-mapping-checklist.md`

Recommended FileMaker env vars:

- `FILEMAKER_SERVER` (or `FILEMAKER_BASE_URL`)
- `FILEMAKER_DATABASE`
- `FILEMAKER_USERNAME`
- `FILEMAKER_PASSWORD`
- `FILEMAKER_VERIFY_SSL`
- `FILEMAKER_TIMEOUT_MS`
- `FILEMAKER_MAX_RETRIES`

## Smoke tests

Read-only FileMaker smoke:

```bash
npm run smoke:filemaker
```

Read-only smoke is expected to validate mapping readiness and stage readability.

Mutation FileMaker smoke (opt-in):

```bash
FILEMAKER_ENABLE_MUTATION_SMOKE=true npm run smoke:filemaker
```

Only run mutation smoke against a safe environment.

Do not run mutation smoke unless both of the following are true:

- mapping checklist is completed for the target environment
- environment is explicitly approved for mutation testing

## Common failures

- `filemaker_config_incomplete`: Missing server/database/credentials.
- `filemaker_auth_failed`: Login failed for Data API user.
- `filemaker_layout_not_found`: Layout name mismatch in env/schema.
- `filemaker_timeout`: Network/SSL issue or timeout too short.
- `filemaker_request_failed`: Inspect response `details` and `x-trace-id`.
- `mappingReady=false`: Required layout/field/stage mappings are not complete.
- `placeholderMappings` non-empty: mappings are still unconfirmed placeholders.

## Extending the app

- Add new modules under `src/frontend`
- Reuse shared domain code under `src/shared`
- Add new backend services and repositories under `src/server`
- Keep FileMaker-specific behavior isolated to repository and mapper code
