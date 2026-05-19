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

## Health and diagnostics behavior

- `/api/health` reports requested mode, active mode, ready flag, fallback status, and FileMaker connectivity diagnostics.
- No credential values are returned in health payloads or logs.

## Safe smoke verification

- `npm run smoke:filemaker` performs read-only checks.
- `FILEMAKER_ENABLE_MUTATION_SMOKE=true npm run smoke:filemaker` enables create/send/start/complete mutation checks.

## Recommended next FileMaker input

- Confirm the real request layout name
- Confirm the request primary key field
- Confirm container field names for request PDF and response PDF
- Decide whether notes and extra uploads live in JSON fields or related tables
- Confirm session layout usage (if needed)
- Confirm production stage values and `stageMap`

## Troubleshooting

- `filemaker_config_incomplete`: Missing server/database/credentials.
- `filemaker_auth_failed`: Data API login failed.
- `filemaker_layout_not_found`: Incorrect layout name in env/schema.
- `filemaker_timeout`: Request timeout reached.
- `filemaker_request_failed`: Generic Data API transport error.
