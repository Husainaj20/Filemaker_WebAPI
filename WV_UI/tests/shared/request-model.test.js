import test from "node:test";
import assert from "node:assert/strict";
import {
  addNote,
  createEmptyRequest,
  stripAttachmentPayloads
} from "../../src/shared/requests/request-model.js";

test("stripAttachmentPayloads removes base64 fields", () => {
  const request = createEmptyRequest({
    documents: {
      requestPdf: {
        id: "reqpdf",
        name: "req.pdf",
        mimeType: "application/pdf",
        base64: "abcd"
      },
      responsePdf: null,
      relatedUploads: [
        {
          id: "att1",
          name: "map.pdf",
          mimeType: "application/pdf",
          base64: "efgh"
        }
      ],
      responseUploads: []
    }
  });

  const sanitized = stripAttachmentPayloads(request);
  assert.equal("base64" in sanitized.documents.requestPdf, false);
  assert.equal("base64" in sanitized.documents.relatedUploads[0], false);
});

test("addNote appends a note entry", () => {
  const request = createEmptyRequest();
  addNote(request, {
    category: "workflow",
    text: "Need district response",
    author: "tester"
  });
  assert.equal(request.notes.length, 1);
  assert.equal(request.notes[0].author, "tester");
});
