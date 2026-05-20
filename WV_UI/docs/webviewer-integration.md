# WebViewer Integration Contract

## Runtime Modes

- `standalone`: normal browser runtime
- `webviewer`: embedded FileMaker WebViewer runtime

Bridge detection in frontend:

- checks `window.FileMaker.PerformScript`
- checks `window.FileMaker.PerformScriptWithOption`
- falls back safely when bridge is unavailable

## Proposed FileMaker Script Contract

The scripts below are placeholders for implementation alignment.
They are not production-confirmed unless explicitly marked confirmed by FileMaker development.

| Script Name | Purpose | Triggered By Web App | Payload Shape | Expected FileMaker Callback | MVP Required | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `WV_Request_Open` | Open/sync selected request in FileMaker context | request selected/deep-linked in embedded runtime | `{ action, requestId, metadata, emittedAt }` | optional callback script (none required for UI continuity) | yes (embedded mode) | proposed |
| `WV_Request_Sync` | Push current request context for synchronization | explicit sync action or lifecycle save in embedded mode | `{ action, requestId, metadata, emittedAt }` | optional callback script | no | proposed |
| `WV_Request_Lifecycle_Action` | Notify lifecycle transitions from web app | send/start/complete transition action | `{ action, requestId, metadata, emittedAt }` | optional callback script | no | proposed |
| `WV_Request_Document_Open` | Open request document context in FileMaker | document open action in embedded mode | `{ action, requestId, metadata, emittedAt }` | optional callback script | no | proposed |
| `WV_App_Ready` | Signal app ready in embedded runtime | app startup/init complete | `{ action, requestId, metadata, emittedAt }` | optional callback script | no | proposed |
| `WV_App_Error` | Report runtime errors to FileMaker script layer | bridge/runtime integration errors | `{ action, requestId, metadata, emittedAt }` | optional callback script | no | proposed |

## Payload Contract

Recommended payload object:

```json
{
  "action": "request_open",
  "requestId": "REQ-123",
  "metadata": {
    "source": "request_list",
    "recordId": "REC-10",
    "role": "operator"
  },
  "emittedAt": "2026-05-19T12:34:56.789Z"
}
```

Serialization rules:

- JSON payload is deterministically serialized
- script names are validated before invocation
- invalid script names are rejected without bridge execution

## Confirmation Checklist

Before production cutover, confirm with FileMaker developer:

1. Script names and spelling in production file.
2. Required script parameter format and encoding.
3. Whether callbacks are required and by which transport.
4. Error-handling behavior expected by FileMaker scripts.
5. Which scripts are mandatory for go-live versus deferred.

## Safe Fallback Behavior

When embedded mode is detected but bridge is missing:

- app continues with local detail behavior
- bridge call returns structured no-op result
- diagnostics report warning without leaking secrets
