# Target Architecture

## Runtime shape

Frontend -> Backend API -> Request service -> Repository -> FileMaker Data API

## Frontend responsibilities

- Render app shell and request workspace
- Manage local view state, filtering, and edit drafts
- Send canonical request payloads to backend APIs
- Show loading, error, dirty, and transition states
- Stay independent of FileMaker field names and script assumptions

## Backend responsibilities

- Own request routes and JSON contracts
- Validate lifecycle transitions
- Normalize and merge request payloads
- Append history events
- Classify and report persistence failures
- Keep FileMaker credentials server-side only

## Domain services and repositories

- `src/shared/requests`: canonical request shape, request types, workflow rules
- `src/server/services/request-service.js`: business operations for create, update, transition
- `src/server/repositories/*`: persistence implementations behind one contract

## FileMaker anti-corruption boundary

- `src/server/filemaker/filemaker-client.js`: token/session handling and Data API transport
- `src/server/filemaker/request-field-mapper.js`: central field and payload mapping
- `config/filemaker-schema.example.json`: explicit mapping contract

## Migration path away from FileMaker

- Keep the frontend on canonical API models only
- Keep lifecycle logic in shared domain code and backend service code
- Keep FileMaker-specific field names inside the mapper only
- Replace `FileMakerRequestRepository` later with another repository implementation without rewriting the request UI
