import test from "node:test";
import assert from "node:assert/strict";
import { validateFileMakerSchema } from "../../src/server/filemaker/schema-validation.js";

function createValidSchema() {
  return {
    layouts: {
      requests: "RequestsAPI",
      records: "RecordsAPI",
      sessions: "SessionsAPI",
    },
    fields: {
      id: "PrimaryKey",
      recordId: "MainRecordId",
      recordLabel: "RecordLabel",
      title: "Title",
      stage: "WorkflowStage",
      status: "StatusLabel",
      requestDate: "RequestDate",
      requestEmailSentAt: "RequestEmailSentAt",
      responseCompletedOn: "ResponseCompletedOn",
      payloadJson: "PayloadJson",
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
    },
    recordFields: {
      id: "MainRecordId",
      displayName: "RecordLabel",
      status: "StatusLabel",
      location: "LocationText",
    },
    containerFields: {
      requestPdf: "RequestPdf",
      responsePdf: "ResponsePdf",
      supportingPdf: "SupportingPdf",
    },
    stageMap: {
      draft: "draft",
      request_sent: "request_sent",
      waiting_response: "waiting_response",
      completed: "completed",
    },
  };
}

test("valid schema passes validation", () => {
  const result = validateFileMakerSchema(createValidSchema(), {
    source: "test-schema",
    sourceType: "custom",
  });

  assert.equal(result.ready, true);
  assert.equal(result.missingMappings.length, 0);
});

test("missing required layout fails validation", () => {
  const schema = createValidSchema();
  schema.layouts.requests = "";

  const result = validateFileMakerSchema(schema, {
    source: "test-schema",
    sourceType: "custom",
  });

  assert.equal(result.ready, false);
  assert.ok(result.missingMappings.some((entry) => entry.path === "layouts.requests"));
});

test("missing required field mapping fails validation", () => {
  const schema = createValidSchema();
  schema.fields.stage = "";

  const result = validateFileMakerSchema(schema, {
    source: "test-schema",
    sourceType: "custom",
  });

  assert.equal(result.ready, false);
  assert.ok(result.missingMappings.some((entry) => entry.path === "fields.stage"));
});

test("incomplete stage map fails validation", () => {
  const schema = createValidSchema();
  delete schema.stageMap.waiting_response;

  const result = validateFileMakerSchema(schema, {
    source: "test-schema",
    sourceType: "custom",
  });

  assert.equal(result.ready, false);
  assert.ok(
    result.missingMappings.some((entry) => entry.path === "stageMap.waiting_response"),
  );
});

test("placeholder values are detected as unconfirmed", () => {
  const schema = createValidSchema();
  schema.layouts.requests = "<REQUESTS_LAYOUT>";

  const result = validateFileMakerSchema(schema, {
    source: "schema.example.json",
    sourceType: "example",
  });

  assert.equal(result.ready, true);
  assert.equal(result.confirmed, false);
  assert.ok(
    result.placeholderMappings.some((entry) => entry.path === "layouts.requests"),
  );
});
