# FileMaker Data API Integration

## Current integration model

- Backend authenticates to FileMaker Data API
- Backend reads and writes request records through a repository
- Browser never sees FileMaker credentials
- Browser never calls FileMaker scripts directly

## Server components

- [filemaker-client.js](/Users/husainaljamal/Desktop/WV_UI/src/server/filemaker/filemaker-client.js)
- [request-field-mapper.js](/Users/husainaljamal/Desktop/WV_UI/src/server/filemaker/request-field-mapper.js)
- [filemaker-request-repository.js](/Users/husainaljamal/Desktop/WV_UI/src/server/repositories/filemaker-request-repository.js)

## Configuration

- `FILEMAKER_BASE_URL`
- `FILEMAKER_DATABASE`
- `FILEMAKER_USERNAME`
- `FILEMAKER_PASSWORD`
- `FILEMAKER_SCHEMA_FILE`

## Mapping strategy

- Canonical request fields stay in app code
- FileMaker field names live in schema config
- `PayloadJson` can preserve nested request structures without leaking them into the UI
- Core searchable fields are also mapped to first-class FileMaker fields

## Current limitations

- Core request record reads and writes are implemented
- Request and response PDF uploads are wired through configured container fields
- Additional related uploads are stored canonically now and need deeper FileMaker layout or related-record mapping if you want them persisted as separate containers in FileMaker

## Recommended next FileMaker input

- Confirm the real request layout name
- Confirm the request primary key field
- Confirm container field names for request PDF and response PDF
- Decide whether notes and extra uploads live in JSON fields or related tables
