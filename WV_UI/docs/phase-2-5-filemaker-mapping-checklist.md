# Phase 2.5 FileMaker Mapping Checklist

## Purpose
This checklist captures all current FileMaker mapping assumptions found in code/docs and marks each mapping as confirmed, assumed, or missing.

Validation statuses used:
- confirmed: explicitly validated against live FileMaker (not yet done in this repo)
- assumed: implemented in code/docs but not yet live-validated
- missing: mapping not yet provided

## Required Layouts

| App canonical name | FileMaker layout/table/field name | Required | Current value or placeholder | Validation status | Notes |
|---|---|---|---|---|---|
| requestsLayout | layouts.requests | yes | ExcessLandRequests | assumed | Primary request layout used by repository/client. |
| recordsLayout | layouts.records | yes for parent listing | empty | missing | If blank, service falls back to deriving parents from requests. |
| sessionsLayout | layouts.sessions | no | empty | missing | Optional for script/session audit workflows. |

## Required Request Fields

| App canonical name | FileMaker layout/table/field name | Required | Current value or placeholder | Validation status | Notes |
|---|---|---|---|---|---|
| id | fields.id | yes | PrimaryKey | assumed | Used for getById/find and payload save. |
| recordId | fields.recordId | yes | MainRecordId | assumed | Parent record identifier in app domain. |
| recordLabel | fields.recordLabel | yes | RecordLabel | assumed | Parent display text in app domain. |
| title | fields.title | yes | Title | assumed | Request title. |
| stage | fields.stage | yes | WorkflowStage | assumed | Canonical stage through stageMap. |
| status | fields.status | yes | StatusLabel | assumed | Human-readable stage/status label. |
| requestDate | fields.requestDate | yes | RequestDate | assumed | Base request timing metadata. |
| requestEmailSentAt | fields.requestEmailSentAt | yes | RequestEmailSentAt | assumed | Used in Send flow and stage checks. |
| responseCompletedOn | fields.responseCompletedOn | yes | ResponseCompletedOn | assumed | Used in Complete flow checks. |
| payloadJson | fields.payloadJson | yes | PayloadJson | assumed | Canonical nested payload persistence. |
| createdAt | fields.createdAt | yes | CreatedAt | assumed | Persistence metadata. |
| updatedAt | fields.updatedAt | yes | UpdatedAt | assumed | Persistence metadata. |

## Optional Request Fields

| App canonical name | FileMaker layout/table/field name | Required | Current value or placeholder | Validation status | Notes |
|---|---|---|---|---|---|
| priority | fields.priority | no | Priority | assumed | Optional metadata. |
| typeCode | fields.typeCode | no | RequestType | assumed | Optional workflow metadata. |
| subTypeCode | fields.subTypeCode | no | SubRequestType | assumed | Optional workflow metadata. |
| recipientId | fields.recipientId | no | RecipientId | assumed | Optional workflow metadata. |
| reportingCodeId | fields.reportingCodeId | no | ReportingCodeId | assumed | Optional workflow metadata. |
| responseStatus | fields.responseStatus | no | ResponseStatus | assumed | Optional response metadata. |
| responseResponder | fields.responseResponder | no | ResponseResponder | assumed | Optional response metadata. |
| responseSummary | fields.responseSummary | no | ResponseSummary | assumed | Optional response metadata. |
| responseNotes | fields.responseNotes | no | ResponseNotes | assumed | Optional response metadata. |
| responseDecision | fields.responseDecision | no | ResponseDecision | assumed | Optional response metadata. |

## Lifecycle Stage Mappings

| App canonical name | FileMaker layout/table/field name | Required | Current value or placeholder | Validation status | Notes |
|---|---|---|---|---|---|
| draft | stageMap.draft | yes | draft | assumed | Canonical stage preserved. |
| request_sent | stageMap.request_sent | yes | request_sent | assumed | Canonical stage preserved. |
| waiting_response | stageMap.waiting_response | yes | waiting_response | assumed | Canonical stage preserved. |
| completed | stageMap.completed | yes | completed | assumed | Canonical stage preserved. |

## Record ID / Display / Status / Location Mappings

| App canonical name | FileMaker layout/table/field name | Required | Current value or placeholder | Validation status | Notes |
|---|---|---|---|---|---|
| parentRecordId | recordFields.id | yes | MainRecordId | assumed | Parent list aggregation key. |
| parentDisplayName | recordFields.displayName | yes | RecordLabel | assumed | Parent list display text. |
| parentStatus | recordFields.status | yes | StatusLabel | assumed | Required by schema validator in Phase 2.5. |
| parentLocation | recordFields.location | no | empty | missing | Optional location enrichment. |

## Container / Document Field Mappings

| App canonical name | FileMaker layout/table/field name | Required | Current value or placeholder | Validation status | Notes |
|---|---|---|---|---|---|
| requestPdf | containerFields.requestPdf | no (Phase 2.5) | RequestPdf | assumed | Currently optional for mapping readiness; will become required if Phase 3 attachment scope requires. |
| responsePdf | containerFields.responsePdf | no (Phase 2.5) | ResponsePdf | assumed | Same as above. |
| supportingPdf | containerFields.supportingPdf | no (Phase 2.5) | empty | missing | Confirm only when supporting upload persistence path is finalized. |

## Script Names (Legacy / Integration References)

| App canonical name | FileMaker layout/table/field name | Required | Current value or placeholder | Validation status | Notes |
|---|---|---|---|---|---|
| sendMailScript | window.FileMaker.PerformScript('WV_SendMail') | no (legacy) | WV_SendMail | assumed | Found in legacy WebViewer file index.requests.html. |
| updateRequestScript | window.FileMaker.PerformScript('WV_UpdateRequest') | no (legacy) | WV_UpdateRequest | assumed | Found in legacy WebViewer file index.requests.html. |
| bridgeDispatchScript | WebViewer_Bridge_Dispatch | no (legacy) | WebViewer_Bridge_Dispatch | assumed | Documented in all other files/FileMaker_Scripts/README.txt. |
| bridgeRespondScript | WebViewer_Bridge_Respond | no (legacy) | WebViewer_Bridge_Respond | assumed | Documented in all other files/FileMaker_Scripts/README.txt. |
| actionRegistryScripts | WV_Action_* / WV_Push_* | no (legacy) | multiple names | assumed | Documented under all other files/FileMaker_Scripts. |

## WebViewer / FileMaker Script Integration Points

| App canonical name | FileMaker layout/table/field name | Required | Current value or placeholder | Validation status | Notes |
|---|---|---|---|---|---|
| legacyPerformScriptHook | window.FileMaker.PerformScript | no (legacy) | used in all other files/index.requests.html | assumed | Legacy FMP WebViewer bridge; not part of active Phase 2 runtime routes. |
| legacyPerformScriptWithOptionHook | window.FileMaker.PerformScriptWithOption | no (legacy) | used in all other files/index.requests.html | assumed | Legacy fallback for script calls. |
| legacyFmpUrlFallback | fmp:// URL fallback | no (legacy) | present in all other files/index.requests.html | assumed | Legacy fallback transport when PerformScript not available. |
| activeRuntimePath | Node backend Data API routes | yes | src/server/* + /api/* | assumed | Current active integration path for web app runtime. |

## Open Questions for FileMaker Admin / Developer
1. What is the exact production requests layout name and table occurrence?
2. What is the exact records listing layout name and table occurrence?
3. Is a dedicated sessions layout required for this web runtime, and if so what is the name?
4. Confirm exact field names for id, stage, status, requestEmailSentAt, responseCompletedOn, payloadJson.
5. Confirm stage storage values in FileMaker for draft/request_sent/waiting_response/completed.
6. Confirm whether stageMap should translate to non-canonical FileMaker values.
7. Confirm recordFields.status and recordFields.location source fields in records layout.
8. Confirm container field names for requestPdf, responsePdf, supportingPdf.
9. Confirm whether supporting files should remain single container or move to related table records.
10. Confirm whether legacy WebViewer scripts (WV_SendMail, WV_UpdateRequest, WV_Action_*) remain in scope or are officially deprecated for active runtime.
11. Confirm required FileMaker privilege set for Data API user (read/list/find/create/edit/container upload/download).
12. Confirm TLS/SSL expectations for FILEMAKER_VERIFY_SSL in each environment.
