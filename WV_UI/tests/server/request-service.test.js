import test from "node:test";
import assert from "node:assert/strict";
import { RequestService } from "../../src/server/services/request-service.js";
import { createEmptyRequest } from "../../src/shared/requests/request-model.js";
import { STAGES } from "../../src/shared/requests/request-workflow.js";
import { AppError } from "../../src/server/lib/errors.js";

function createInMemoryRepository(seed = []) {
  const db = new Map(seed.map((item) => [item.id, item]));
  return {
    async list() {
      return Array.from(db.values());
    },
    async getById(id) {
      return db.get(id) || null;
    },
    async save(request) {
      db.set(request.id, request);
      return request;
    },
  };
}

test("service creates and updates a request", async () => {
  const repository = createInMemoryRepository();
  const service = new RequestService({
    repository,
    logger: console,
    mode: "mock",
  });

  const created = await service.createRequest(
    {
      title: "Created in service",
      requester: "Lifecycle Tester",
    },
    "tester",
  );
  assert.equal(created.title, "Created in service");

  const updated = await service.updateRequest(
    created.id,
    {
      title: "Updated title",
    },
    "tester",
  );
  assert.equal(updated.title, "Updated title");
});

test("service transitions request with validation", async () => {
  const request = createEmptyRequest({
    stage: STAGES.RESPONSE_RECEIVED,
    response: {
      receivedAt: "2026-05-08",
    },
    approval: {
      state: "pending",
    },
  });
  const repository = createInMemoryRepository([request]);
  const service = new RequestService({
    repository,
    logger: console,
    mode: "mock",
  });

  const saved = await service.transitionRequest(
    request.id,
    STAGES.APPROVED,
    "tester",
  );
  assert.equal(saved.stage, STAGES.APPROVED);
});

test("response_received can transition to response_files_uploaded when responsePdf exists", async () => {
  const request = createEmptyRequest({
    stage: STAGES.RESPONSE_RECEIVED,
    status: "Response Received",
    response: {
      receivedAt: "2026-05-17",
    },
    documents: {
      responsePdf: {
        id: "att_resp",
        name: "response.pdf",
        mimeType: "application/pdf",
        size: 3,
        uploadedAt: "2026-05-17T00:00:00.000Z",
        base64: "YWJj",
      },
    },
  });

  const repository = createInMemoryRepository([request]);
  const service = new RequestService({
    repository,
    logger: console,
    mode: "mock",
  });

  const saved = await service.transitionRequest(
    request.id,
    STAGES.RESPONSE_FILES_UPLOADED,
    "tester",
  );

  assert.equal(saved.stage, STAGES.RESPONSE_FILES_UPLOADED);
});

test("invalid source data rejects response_files_uploaded with diagnostics", async () => {
  const request = createEmptyRequest({
    stage: STAGES.REQUEST_PDF_READY,
    status: "Request Pdf Ready",
    response: {
      receivedAt: "",
    },
    documents: {
      responsePdf: null,
    },
  });

  const repository = createInMemoryRepository([request]);
  const service = new RequestService({
    repository,
    logger: console,
    mode: "mock",
  });

  await assert.rejects(
    service.transitionRequest(
      request.id,
      STAGES.RESPONSE_FILES_UPLOADED,
      "tester",
    ),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "missing_required_data");
      assert.equal(error.statusCode, 422);
      assert.equal(error.details.currentStage, STAGES.REQUEST_PDF_READY);
      assert.equal(error.details.targetStage, STAGES.RESPONSE_FILES_UPLOADED);
      assert.ok(Array.isArray(error.details.allowedTransitions));
      assert.ok(
        error.details.allowedTransitions.includes(
          STAGES.RESPONSE_FILES_UPLOADED,
        ),
      );
      assert.ok(error.details.missing.includes("response.receivedAt"));
      assert.ok(error.details.missing.includes("documents.responsePdf"));
      return true;
    },
  );
});

test("send/start/complete are idempotent and do not duplicate transition history", async () => {
  const request = createEmptyRequest({
    title: "Lifecycle Idempotency",
    requester: "Tester",
  });
  const repository = createInMemoryRepository([request]);
  const service = new RequestService({
    repository,
    logger: console,
    mode: "mock",
  });

  const afterSend = await service.sendRequest(request.id, "tester");
  const afterRepeatSend = await service.sendRequest(request.id, "tester");
  assert.equal(afterSend.history.length, afterRepeatSend.history.length);

  const afterStart = await service.startRequest(request.id, "tester");
  const afterRepeatStart = await service.startRequest(request.id, "tester");
  assert.equal(afterStart.history.length, afterRepeatStart.history.length);

  const afterComplete = await service.completeRequest(request.id, "tester");
  const afterRepeatComplete = await service.completeRequest(request.id, "tester");
  assert.equal(afterComplete.history.length, afterRepeatComplete.history.length);
});

test("notes, document placeholders, and response metadata update through service APIs", async () => {
  const request = createEmptyRequest({
    title: "Phase 3 Detail APIs",
    requester: "Tester",
  });
  const repository = createInMemoryRepository([request]);
  const service = new RequestService({
    repository,
    logger: console,
    mode: "mock",
  });
  service.config = {
    filemaker: {
      schema: {
        containerFields: {
          requestPdf: "RequestPdf",
          responsePdf: "ResponsePdf",
          supportingPdf: "SupportingPdf",
        },
      },
    },
  };

  const noted = await service.addRequestNote(
    request.id,
    { category: "workflow", body: "Detail note" },
    "tester",
  );
  assert.equal(noted.notes[0].text, "Detail note");

  await service.addDocumentPlaceholder(
    request.id,
    {
      type: "response",
      name: "Response Artifact Placeholder",
      status: "placeholder",
      source: "adapter-ready",
      containerField: "<RESPONSE_CONTAINER_FIELD>",
    },
    "tester",
  );
  const documents = await service.listRequestDocuments(request.id);
  assert.ok(
    documents.some(
      (document) =>
        document.type === "response" && document.status === "placeholder",
    ),
  );

  const updated = await service.updateResponse(
    request.id,
    {
      summary: "Response captured",
      completedBy: "tester",
      artifactName: "response.pdf",
      artifactStatus: "placeholder",
    },
    "tester",
  );
  assert.equal(updated.response.summary, "Response captured");
  assert.equal(updated.response.completedBy, "tester");
  assert.equal(updated.response.artifactName, "response.pdf");
  assert.equal(updated.response.artifactStatus, "placeholder");
});

test("service builds operational summary report", async () => {
  const requestA = createEmptyRequest({
    id: "REQ-A",
    stage: STAGES.DRAFT,
    priority: "high",
    assignedTo: "ops_a",
    dueDate: "2001-01-01",
  });
  const requestB = createEmptyRequest({
    id: "REQ-B",
    stage: STAGES.COMPLETED,
    priority: "low",
    assignedTo: "ops_b",
  });

  const repository = createInMemoryRepository([requestA, requestB]);
  const service = new RequestService({
    repository,
    logger: console,
    mode: "mock",
  });

  const summary = await service.getReportSummary();
  assert.equal(summary.totals.requests, 2);
  assert.equal(summary.totals.activeRequests, 1);
  assert.equal(summary.totals.completedRequests, 1);
  assert.equal(summary.stageCounts.draft, 1);
  assert.equal(summary.stageCounts.completed, 1);
  assert.equal(summary.priorityCounts.high, 1);
  assert.equal(summary.priorityCounts.low, 1);
  assert.equal(summary.assigneeCounts.ops_a, 1);
});

test("deployment readiness probe returns checks", async () => {
  const repository = createInMemoryRepository();
  const service = new RequestService({
    repository,
    logger: console,
    mode: "mock",
  });
  service.config = {
    defaultRole: "operator",
    allowMockFallback: true,
    filemaker: {
      schemaValidation: {
        ready: false,
      },
    },
  };

  const readiness = await service.deploymentReadinessProbe();
  assert.equal(typeof readiness.ready, "boolean");
  assert.ok(Array.isArray(readiness.checks));
  assert.equal(typeof readiness.summary.requests, "number");
});
