# Production Go-Live Checklist

Use this checklist to drive final cutover validation from release-ready code to production-confirmed FileMaker integration.

## Repository/Release Checks

- [ ] `origin/main` points to approved release commit
- [ ] Approved release tag is present and immutable (`phase-5-webviewer-filemaker-hardening`)
- [ ] `git status` clean in deployment worktree
- [ ] Rollback tags verified and documented

## Environment Variables/Secrets

- [ ] `.env` is not committed/tracked
- [ ] Runtime env values sourced from secret manager, not plaintext docs
- [ ] `APP_HOST`, `APP_PORT`, `APP_ENV`, `APP_VERSION`, `LOG_LEVEL` set
- [ ] `APP_DATA_MODE` set to intended production mode
- [ ] `APP_ALLOW_MOCK_FALLBACK` explicitly set per policy
- [ ] `APP_DEFAULT_ROLE` set to approved default role

## FileMaker Credentials

- [ ] `FILEMAKER_SERVER` or `FILEMAKER_BASE_URL` validated
- [ ] `FILEMAKER_DATABASE` validated
- [ ] `FILEMAKER_USERNAME` and `FILEMAKER_PASSWORD` validated
- [ ] SSL verification policy (`FILEMAKER_VERIFY_SSL`) approved
- [ ] Timeout/retry policy approved (`FILEMAKER_TIMEOUT_MS`, `FILEMAKER_MAX_RETRIES`)

## FileMaker Layouts/Fields/Stage Mappings

- [ ] Requests layout name confirmed
- [ ] Records layout name confirmed
- [ ] Required request fields confirmed and mapped
- [ ] Record list fields confirmed and mapped
- [ ] Canonical stage mapping confirmed for `draft/request_sent/waiting_response/completed`
- [ ] Placeholder mappings removed or explicitly accepted with risk sign-off

## FileMaker Container/Document Mappings

- [ ] Supporting/request/response container field names confirmed
- [ ] Document placeholder flow validated against real layout fields
- [ ] Document download path validated (content-type and file name behavior)

## WebViewer Setup

- [ ] WebViewer URL points to reachable app host
- [ ] Runtime hint strategy agreed (`runtime`, `embedded`, optional ids)
- [ ] Embedded runtime tested from FileMaker host environment

## FileMaker Script Contract Confirmation

- [ ] `WV_Request_Open` script exists in FileMaker solution
- [ ] Script parameter format matches app payload contract
- [ ] Bridge execution path confirmed (`PerformScript` or `PerformScriptWithOption`)
- [ ] No-bridge fallback behavior accepted by product owner

## Smoke Testing

- [ ] `npm test` passes
- [ ] `npm run smoke:filemaker` passes in target environment
- [ ] Mutation smoke executed only if explicitly approved:
  - [ ] `FILEMAKER_ENABLE_MUTATION_SMOKE=true npm run smoke:filemaker`

## Health/Readiness Verification

- [ ] `GET /api/health` reports expected mode and healthy diagnostics
- [ ] `npm run check:ready` passes against deployed host
- [ ] `GET /api/diagnostics/deployment-readiness` reports ready
- [ ] `GET /api/diagnostics/webviewer` shows expected runtime warnings/no warnings

## Role/Reporting/Export Verification

- [ ] Viewer role validated (read-only behavior)
- [ ] Operator role validated (write + export behavior)
- [ ] Admin role validated (deployment diagnostics access)
- [ ] Summary/report CSV export validated with representative data

## Monitoring/Logging

- [ ] Structured logs retained and searchable
- [ ] `x-trace-id` used in operational playbook
- [ ] Alert thresholds set for auth/timeouts/layout failures
- [ ] Fallback activation alerts configured if fallback is allowed

## Backup/Rollback

- [ ] Rollback plan references phase tags
- [ ] Operator knows rollback command path and owner escalation
- [ ] Backup/restore procedures validated for FileMaker data domain

## Sign-Off

- [ ] Engineering sign-off
- [ ] FileMaker admin sign-off
- [ ] Product/operations sign-off
- [ ] Go-live window approved
- [ ] Hypercare owner assigned

## Stash Preservation Note

A local Desktop `stash@{0}` remains intentionally preserved and untouched during this go-live checklist pass. It should be manually reviewed and dropped only after confirming it contains no unique work.
