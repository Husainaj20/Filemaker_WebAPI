# Phase 2 Persistence Hardening

## Scope

Phase 2 hardens persistence boundaries while preserving the Phase 1 lifecycle baseline.

- Phase 1 baseline remains valid in mock mode.
- FileMaker mode is configurable and guarded.
- Fallback to mock is allowed only when `APP_ALLOW_MOCK_FALLBACK=true`.

## Data Modes

### Mock mode (baseline)

```bash
APP_DATA_MODE=mock \
APP_ALLOW_MOCK_FALLBACK=true \
node src/server/server.js
```

### FileMaker mode (strict)

```bash
APP_DATA_MODE=filemaker \
APP_ALLOW_MOCK_FALLBACK=false \
node src/server/server.js
```

### FileMaker mode with safe fallback

```bash
APP_DATA_MODE=filemaker \
APP_ALLOW_MOCK_FALLBACK=true \
node src/server/server.js
```

If FileMaker connectivity/config fails and fallback is enabled, runtime automatically degrades to mock repository mode and reports fallback diagnostics in health.

## Environment Variables

Core app:

- `APP_DATA_MODE=mock|filemaker`
- `APP_ALLOW_MOCK_FALLBACK=true|false`
- `APP_HOST`
- `APP_PORT`
- `LOG_LEVEL`

FileMaker transport:

- `FILEMAKER_SERVER`
- `FILEMAKER_BASE_URL` (optional explicit override)
- `FILEMAKER_DATABASE`
- `FILEMAKER_USERNAME`
- `FILEMAKER_PASSWORD`
- `FILEMAKER_API_VERSION`
- `FILEMAKER_VERIFY_SSL=true|false`
- `FILEMAKER_TIMEOUT_MS`
- `FILEMAKER_MAX_RETRIES`

Layouts/schema:

- `FILEMAKER_LAYOUT_REQUESTS`
- `FILEMAKER_LAYOUT_RECORDS`
- `FILEMAKER_LAYOUT_SESSIONS`
- `FILEMAKER_SCHEMA_FILE`
- `FILEMAKER_RECORD_FIELD_ID`
- `FILEMAKER_RECORD_FIELD_DISPLAY`
- `FILEMAKER_RECORD_FIELD_STATUS`
- `FILEMAKER_RECORD_FIELD_LOCATION`
- `FILEMAKER_CONTAINER_SUPPORTING_PDF`

Smoke guard:

- `FILEMAKER_ENABLE_MUTATION_SMOKE=true|false`

## Health and Readiness

`GET /api/health` now reports:

- requested mode
- active mode
- ready
- fallback active status
- FileMaker connectivity/config diagnostics (without secrets)
- FileMaker mapping diagnostics:
	- `connectionReady`
	- `mappingReady`
	- `missingMappings`
	- `placeholderMappings`
	- `schemaSource`
	- `layoutStatus`

## Field Mapping Notes

Canonical lifecycle stages remain:

- `draft`
- `request_sent`
- `waiting_response`
- `completed`

Mapping file:

- `config/filemaker-schema.example.json`

If production FileMaker stage values differ from canonical values, map them in `stageMap`.

Phase 2.5 confirmation checklist:

- `docs/phase-2-5-filemaker-mapping-checklist.md`

## Opt-in Smoke Test

Read-only smoke:

```bash
npm run smoke:filemaker
```

Read-only smoke verifies mode, mapping readiness, layout accessibility, list/read operations, and stage readability.

Mutation smoke (explicitly enabled only):

```bash
FILEMAKER_ENABLE_MUTATION_SMOKE=true npm run smoke:filemaker
```

Mutation smoke performs create/send/start/complete and should only be run against a safe environment.

## Troubleshooting

- `filemaker_config_incomplete`: missing required credentials or server settings.
- `filemaker_auth_failed`: API login failed (user/password or privilege issue).
- `filemaker_layout_not_found`: layout name mismatch.
- `filemaker_timeout`: timeout too low or connectivity issue.
- `filemaker_request_failed`: generic Data API error; inspect `details` and trace id.

## Known TODOs

- Complete mapping checklist with environment-specific confirmed values.
- Record final stage map and any non-canonical stage labels.
- Confirm production container field names before attachment expansion.
- Confirm whether notes/related uploads should stay in payload JSON or move to related tables.
