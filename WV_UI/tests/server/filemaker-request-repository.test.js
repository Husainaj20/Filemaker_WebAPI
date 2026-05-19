import test from "node:test";
import assert from "node:assert/strict";
import { FileMakerRequestRepository } from "../../src/server/repositories/filemaker-request-repository.js";
import { createRequestFieldMapper } from "../../src/server/filemaker/request-field-mapper.js";
import { createEmptyRequest } from "../../src/shared/requests/request-model.js";
import { RequestService } from "../../src/server/services/request-service.js";
import { STAGES } from "../../src/shared/requests/request-workflow.js";

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
    requestPdf: "request.requestPDF",
    responsePdf: "response.responsePDF",
    supportingPdf: "viewPDF"
  }
};

function createFakeClient() {
  let createdBody = null;

  return {
    config: { schema },
    async listRecords() {
      return [];
    },
    async find() {
      return [];
    },
    async createRecord(_layout, body) {
      createdBody = body;
      return { recordId: "321" };
    },
    async editRecord() {
      return { modId: "2" };
    },
    async uploadContainer(_layout, _recordId, fieldName) {
      return { fieldName };
    },
    async getRecord() {
      return {
        recordId: "321",
        fieldData: createdBody.fieldData
      };
    },
    async downloadContainer(_layout, _recordId, fieldName) {
      return {
        fileName: `${fieldName}.pdf`,
        contentType: "application/pdf",
        body: Buffer.from(`download-${fieldName}`, "utf8")
      };
    }
  };
}

test("FileMaker repository save performs synchronous write then reread", async () => {
  const mapper = createRequestFieldMapper(schema);
  const client = createFakeClient();
  const repository = new FileMakerRequestRepository({
    client,
    mapper,
    layoutName: "requests_byproperty (API)",
    containerFields: schema.containerFields
  });

  const request = createEmptyRequest({
    id: "REQ-1000",
    recordId: "PARENT-01",
    title: "FileMaker save test",
    documents: {
      requestPdf: {
        id: "att_1",
        name: "request.pdf",
        mimeType: "application/pdf",
        size: 128,
        uploadedAt: new Date().toISOString(),
        base64: Buffer.from("pdf-bytes", "utf8").toString("base64")
      }
    }
  });

  const saved = await repository.save(request);

  assert.equal(saved.id, "REQ-1000");
  assert.equal(saved.source.system, "filemaker");
  assert.equal(saved.source.recordId, "321");
});

test("FileMaker repository document download supports request/response kinds", async () => {
  const mapper = createRequestFieldMapper(schema);
  const client = createFakeClient();
  const repository = new FileMakerRequestRepository({
    client,
    mapper,
    layoutName: "requests_byproperty (API)",
    containerFields: schema.containerFields
  });

  repository.getById = async () => ({
    id: "REQ-2000",
    source: {
      system: "filemaker",
      recordId: "777"
    }
  });

  const requestDoc = await repository.downloadDocument("REQ-2000", "requestPdf");
  const responseDoc = await repository.downloadDocument("REQ-2000", "responsePdf");

  assert.equal(requestDoc.contentType, "application/pdf");
  assert.equal(responseDoc.contentType, "application/pdf");
  assert.equal(requestDoc.body.toString("utf8"), "download-request.requestPDF");
  assert.equal(responseDoc.body.toString("utf8"), "download-response.responsePDF");
});

test("service create/save/transition runs in filemaker mode", async () => {
  const db = new Map();
  const repository = {
    async list() {
      return Array.from(db.values());
    },
    async getById(id) {
      return db.get(id) || null;
    },
    async save(request) {
      db.set(request.id, request);
      return request;
    }
  };

  const service = new RequestService({
    repository,
    logger: console,
    mode: "filemaker"
  });

  const created = await service.createRequest({
    title: "FM mode request",
    requester: "FM Tester"
  }, "tester");

  await service.updateRequest(created.id, {
    requestEmail: {
      to: "ops@example.com",
      subject: "Request",
      body: "Body",
      sentAt: "2026-05-17"
    }
  }, "tester");

  const transitioned = await service.transitionRequest(
    created.id,
    STAGES.REQUEST_SENT,
    "tester"
  );

  assert.equal(transitioned.stage, STAGES.REQUEST_SENT);
  assert.equal(service.mode, "filemaker");
});
