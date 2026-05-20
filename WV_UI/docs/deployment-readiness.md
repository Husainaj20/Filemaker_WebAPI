# Deployment Readiness

## Purpose

Deployment readiness confirms that runtime health, role controls, and reporting/export contracts are all operational before release.

## Preconditions

- backend is running
- expected environment variables are set
- role policy is configured via `APP_DEFAULT_ROLE`

## Check command

```bash
npm run check:ready
```

Optional overrides:

- `CHECK_READY_BASE_URL` (default: `http://127.0.0.1:3080`)
- `CHECK_READY_ROLE` (default: `admin`)

## What is validated

- `GET /api/health`
- `GET /api/reports/summary`
- `GET /api/diagnostics/deployment-readiness`

## Exit behavior

- success: all checks pass and readiness reports `ready=true`
- failure: any route fails or readiness reports `ready=false`

## Troubleshooting

- `403 forbidden` on readiness endpoint:
  - run with `CHECK_READY_ROLE=admin` or configure role policy
- report endpoint fails:
  - verify API role headers and request repository initialization
- health not ready:
  - inspect `/api/health` diagnostics and filemaker mapping flags
