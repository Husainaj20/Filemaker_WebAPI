import test from "node:test";
import assert from "node:assert/strict";
import { createRequestFieldMapper } from "../../src/server/filemaker/request-field-mapper.js";
import { createEmptyRequest } from "../../src/shared/requests/request-model.js";

const schema = {
  fields: {
    id: "PrimaryKey",
    recordId: "MainRecordId",
    recordLabel: "RecordLabel",
    title: "Title",
    stage: "WorkflowStage",
    status: "StatusLabel",
    priority: "Priority",
    typeCode: "RequestType",
    subTypeCode: "SubRequestType",
    recipientId: "RecipientId",
    reportingCodeId: "ReportingCodeId",
    requestDate: "RequestDate",
    dueDate: "DueDate",
    description: "Description",
    approvalState: "ApprovalState",
    requestEmailTo: "RequestEmailTo",
    requestEmailCc: "RequestEmailCc",
    requestEmailSubject: "RequestEmailSubject",
    requestEmailBody: "RequestEmailBody",
    requestEmailSentAt: "RequestEmailSentAt",
    responseStatus: "ResponseStatus",
    responseReceivedAt: "ResponseReceivedAt",
    responseCompletedOn: "ResponseCompletedOn",
    responseResponder: "ResponseResponder",
    responseSummary: "ResponseSummary",
    responseNotes: "ResponseNotes",
    responseDecision: "ResponseDecision",
    payloadJson: "PayloadJson",
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt"
  },
  containerFields: {
    requestPdf: "RequestPdf",
    responsePdf: "ResponsePdf"
  }
};

test("mapper round-trips canonical request fields", () => {
  const mapper = createRequestFieldMapper(schema);
  const request = createEmptyRequest({
    id: "REQ-9000",
    recordId: "REC-1",
    recordLabel: "DD 1",
    title: "Test request",
    typeCode: "RWE",
    subTypeCode: "RWE_STANDARD",
    requestEmail: {
      to: "person@example.gov",
      cc: "",
      subject: "Hello",
      body: "World",
      sentAt: "2026-05-08"
    }
  });

  const payload = mapper.toFileMakerPayload(request);
  const restored = mapper.fromFileMakerRecord({
    recordId: "55",
    fieldData: payload.fieldData
  });

  assert.equal(restored.id, "REQ-9000");
  assert.equal(restored.recordLabel, "DD 1");
  assert.equal(restored.requestEmail.to, "person@example.gov");
  assert.equal(restored.source.recordId, "55");
});
