# Phase 3: Request Detail Depth

## Scope

Phase 3 deepens request detail handling while preserving the Phase 1 canonical lifecycle and Phase 2/2.5 persistence boundaries.

Preserved lifecycle stages:

- `draft`
- `request_sent`
- `waiting_response`
- `completed`

## Detail Model Additions

The request model now supports deeper detail data in a backward-compatible shape:

- `auditEvents`: array of timeline events with `{ id, type, label, timestamp, actor, notes }`
- `notes`: supports both `text` and `body` (same content) for compatibility
- `documents.placeholders`: placeholder records for files/artifacts not yet uploaded
- `response.completedBy`: explicit completion actor
- `response.artifactName`: response artifact display name
- `response.artifactStatus`: artifact state (`placeholder`, `uploaded`, `metadata_only`)

Existing fields remain in place, including:

- `history` (legacy-compatible timeline shape)
- attachment metadata under `documents.requestPdf`, `documents.responsePdf`, `documents.relatedUploads`, `documents.responseUploads`

## API Endpoints

Added/expanded endpoints:

- `GET /api/requests/:id`
- `GET /api/requests/:id/audit`
- `POST /api/requests/:id/notes`
- `GET /api/requests/:id/documents`
- `POST /api/requests/:id/documents/placeholder`
- `PATCH /api/requests/:id/response`

Document download remains:

- `GET /api/requests/:id/documents/:kind`

## Audit / Timeline Behavior

Audit events are appended automatically for lifecycle transitions and include timestamps and labels.

Lifecycle actions are idempotent at the stage level:

- repeating `send` on `request_sent` does not append duplicate transition events
- repeating `start` on `waiting_response` does not append duplicate transition events
- repeating `complete` on `completed` does not append duplicate transition events

Additional timeline events are appended for:

- note creation
- response metadata updates
- document placeholder creation

## Document / Attachment Behavior

Current behavior:

- request/response/supporting attachments continue to work in mock mode
- document placeholders can be added through API and UI
- response artifact placeholders are represented as metadata, not production-confirmed FileMaker uploads

Current boundary:

- File uploads are implemented where existing architecture already supported them
- placeholder records are used for container mappings not yet confirmed in production FileMaker

## FileMaker Mapping Implications

Phase 3 does not require new mandatory FileMaker field mappings beyond Phase 2.5 required mappings.

Phase 3 introduces optional mapping targets to confirm before production cutover:

- response artifact metadata fields if promoted from `PayloadJson` to dedicated columns
- container field mapping for placeholder-to-upload conversion
- supporting upload strategy (single container vs related table records)

Until confirmed, these remain adapter-ready and mock-ready only.

## Manual Mock Verification Checklist

1. Create a request.
2. Open request detail from list.
3. Run lifecycle actions: send -> start -> complete.
4. Verify timeline updates.
5. Add a note and verify it appears in timeline and notes.
6. Add a document placeholder and verify it appears in Documents.
7. Update response artifact metadata and verify it persists.
8. Verify `/api/health` returns mock mode `ready=true`.
