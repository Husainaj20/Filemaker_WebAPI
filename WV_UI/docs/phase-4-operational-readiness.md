# Phase 4: Operational Roles, Reporting, Export, Deployment Readiness

## Scope

Phase 4 adds operational safeguards and reporting capability on top of the Phase 3 request-detail baseline.

Delivered areas:

- role-based access control for API routes
- operational summary reporting endpoint
- export endpoints for JSON/CSV summaries
- deployment readiness diagnostic probe and script
- role-aware frontend controls and exports

## Role model

Supported roles:

- `viewer`
- `operator`
- `admin`

Permission matrix:

- `viewer`: `requests:read`, `reports:view`
- `operator`: viewer permissions + `requests:write`, `reports:export`
- `admin`: operator permissions + `diagnostics:view`

Request context headers:

- `x-role` selects role (fallback: `APP_DEFAULT_ROLE`)
- `x-user` identifies actor for audit/history

## API additions

Reporting:

- `GET /api/reports/summary`
- `GET /api/reports/summary.json`
- `GET /api/reports/requests.csv`

Readiness:

- `GET /api/diagnostics/deployment-readiness`

Authorization behavior:

- mutating request routes enforce `requests:write`
- report summary enforces `reports:view`
- export routes enforce `reports:export`
- deployment readiness diagnostic enforces `diagnostics:view`

Forbidden responses return HTTP `403` with `errorCode=forbidden`.

## Frontend behavior

Phase 4 frontend updates include:

- role selector for simulation (`viewer`, `operator`, `admin`)
- disabled mutation controls in read-only roles
- operational report panel with totals and stage breakdown
- export buttons for summary JSON and request CSV

## Deployment readiness

Use the readiness script:

```bash
npm run check:ready
```

It validates:

- API health endpoint response
- report summary route accessibility
- deployment readiness diagnostic checks

If readiness returns `ready=false`, script exits with failure.
