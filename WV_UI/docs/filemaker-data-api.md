# FileMaker Data API Integration

## Current integration model

- Backend authenticates to FileMaker Data API
- Backend reads and writes request records through a repository
- Browser never sees FileMaker credentials
- Browser never calls FileMaker scripts directly
- Optional fallback repository can degrade from FileMaker to mock when explicitly enabled

## Server components

- [filemaker-client.js](/Users/husainaljamal/Desktop/WV_UI/src/server/filemaker/filemaker-client.js)
- [request-field-mapper.js](/Users/husainaljamal/Desktop/WV_UI/src/server/filemaker/request-field-mapper.js)
- [filemaker-request-repository.js](/Users/husainaljamal/Desktop/WV_UI/src/server/repositories/filemaker-request-repository.js)
- [fallback-request-repository.js](/Users/husainaljamal/Desktop/WV_UI/src/server/repositories/fallback-request-repository.js)

## Configuration

- `APP_DATA_MODE`
- `APP_ALLOW_MOCK_FALLBACK`
- `FILEMAKER_SERVER`
- `FILEMAKER_BASE_URL`
- `FILEMAKER_DATABASE`
- `FILEMAKER_USERNAME`
- `FILEMAKER_PASSWORD`
- `FILEMAKER_VERIFY_SSL`
- `FILEMAKER_TIMEOUT_MS`
- `FILEMAKER_MAX_RETRIES`
- `FILEMAKER_LAYOUT_REQUESTS`
- `FILEMAKER_LAYOUT_RECORDS`
- `FILEMAKER_LAYOUT_SESSIONS`
- `FILEMAKER_SCHEMA_FILE`

## Mapping readiness validation

- Schema validation is performed at config load time.
- Validation checks required layouts, required field mappings, required record mappings, and canonical stage map keys.
- Placeholder and unconfirmed mappings are surfaced in diagnostics.
- Mapping readiness is reported separately from connection readiness.

Checklist reference:

- `docs/phase-2-5-filemaker-mapping-checklist.md`

## Mapping strategy

- Canonical request fields stay in app code
- FileMaker field names live in schema config
- `PayloadJson` can preserve nested request structures without leaking them into the UI
- Core searchable fields are also mapped to first-class FileMaker fields
- Canonical stages (`draft`, `request_sent`, `waiting_response`, `completed`) are mapped through `stageMap`

## Current limitations

- Core request record reads and writes are implemented
- Request and response PDF uploads are wired through configured container fields
- Additional related uploads are stored canonically now and need deeper FileMaker layout or related-record mapping if you want them persisted as separate containers in FileMaker
- Request detail placeholders and response artifact metadata are persisted through canonical payload JSON until dedicated production mappings are confirmed

## Phase 3 detail-depth mapping notes

- New request detail APIs support audit events, notes, document placeholders, and response artifact metadata.
- These additions are payload-driven and do not introduce new required FileMaker mappings for normal tests.
- Before production container upload cutover, confirm:
	- response artifact container field mapping
	- supporting upload container or related-table strategy
	- whether response artifact metadata should move from payload JSON to dedicated fields

## Health and diagnostics behavior

- `/api/health` reports requested mode, active mode, ready flag, fallback status, and FileMaker connectivity diagnostics.
- `/api/health` also reports mapping readiness diagnostics (`connectionReady`, `mappingReady`, `missingMappings`, `placeholderMappings`, `schemaSource`, `layoutStatus`).
- No credential values are returned in health payloads or logs.

## Safe smoke verification

- `npm run smoke:filemaker` performs read-only checks.
- `FILEMAKER_ENABLE_MUTATION_SMOKE=true npm run smoke:filemaker` enables create/send/start/complete mutation checks.

Read-only smoke validates:

- server is running in filemaker requested mode (unless explicitly bypassed)
- mapping readiness
- connection readiness when credentials are supplied
- layout accessibility diagnostics
- list request records
- lifecycle stage field readability

## Recommended next FileMaker input

- Confirm the real request layout name
- Confirm the request primary key field
- Confirm container field names for request PDF and response PDF
- Decide whether notes and extra uploads live in JSON fields or related tables
- Confirm session layout usage (if needed)
- Confirm production stage values and `stageMap`
- Confirm record status/location source fields in records layout
- Confirm whether legacy WebViewer script hooks are in-scope or deprecated

## Troubleshooting

- `filemaker_config_incomplete`: Missing server/database/credentials.
- `filemaker_auth_failed`: Data API login failed.
- `filemaker_layout_not_found`: Incorrect layout name in env/schema.
- `filemaker_timeout`: Request timeout reached.
- `filemaker_request_failed`: Generic Data API transport error.
