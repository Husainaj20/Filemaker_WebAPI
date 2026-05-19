import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyRequest } from "../../src/shared/requests/request-model.js";
import {
  APPROVAL_STATES,
  STAGES,
  transitionRequest,
  validateStage
} from "../../src/shared/requests/request-workflow.js";

test("request_sent transition succeeds and stamps sentAt", () => {
  const request = createEmptyRequest({
    stage: STAGES.REQUEST_PDF_READY,
    typeCode: "RWE",
    subTypeCode: "RWE_STANDARD",
    recipientId: "recipient_right_of_way",
    reportingCodeId: "reporting_rw_01",
    documents: {
      requestPdf: { id: "doc1", name: "req.pdf" },
      responsePdf: null,
      relatedUploads: [],
      responseUploads: []
    }
  });

  const result = transitionRequest(request, STAGES.REQUEST_SENT, {
    actor: "test"
  });
  assert.equal(result.ok, true);
  assert.ok(request.requestEmail.sentAt);
});

test("approved transition stamps approval metadata", () => {
  const request = createEmptyRequest({
    stage: STAGES.RESPONSE_RECEIVED,
    approval: {
      state: APPROVAL_STATES.PENDING
    },
    response: {
      receivedAt: "2026-05-08"
    }
  });

  const result = transitionRequest(request, STAGES.APPROVED, {
    actor: "auditor"
  });

  assert.equal(result.ok, true);
  assert.equal(request.approval.state, APPROVAL_STATES.APPROVED);
  assert.equal(request.approval.by, "auditor");
});

test("invalid subtype fails details validation", () => {
  const request = createEmptyRequest({
    stage: STAGES.TYPE_SELECTED,
    typeCode: "RWE",
    subTypeCode: "NOT_REAL",
    recipientId: "recipient_right_of_way",
    reportingCodeId: "reporting_rw_01"
  });

  const validation = validateStage(request, STAGES.DETAILS_IN_PROGRESS);
  assert.equal(validation.valid, false);
  assert.ok(validation.missing.includes("subTypeCode(valid)"));
});
