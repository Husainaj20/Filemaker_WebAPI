# Runbook

## Local development

```bash
node src/server/server.js
```

Open `http://127.0.0.1:3080`.

The runtime defaults to `filemaker` mode. To run in mock mode for local-only debugging,
set both `APP_DATA_MODE=mock` and `APP_ALLOW_MOCK_FALLBACK=true`.

## Debugging

- Each backend response includes `x-trace-id`
- Errors include a structured code and trace id
- Server logs are emitted as structured JSON lines
- Mock mode persists to [mock-requests.json](/Users/husainaljamal/Desktop/WV_UI/data/mock-requests.json)
- Diagnostics endpoints:
	- `/api/diagnostics/v2-readiness`
	- `/api/diagnostics/container-mapping`
	- `/api/diagnostics/stability?iterations=10`

## Switching to FileMaker

1. Set FileMaker env vars.
2. Point `FILEMAKER_SCHEMA_FILE` at the correct field mapping.
3. Restart the server.
4. Verify `/api/health` and then list/create/update requests from the UI.

## Extending the app

- Add new modules under `src/frontend`
- Reuse shared domain code under `src/shared`
- Add new backend services and repositories under `src/server`
- Keep FileMaker-specific behavior isolated to repository and mapper code
