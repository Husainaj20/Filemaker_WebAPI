import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createApplication } from "../../src/server/app.js";

async function withServer(fn) {
  const tmpFile = path.join(os.tmpdir(), `excessland-details-${Date.now()}.json`);
  const seedFile = path.resolve(process.cwd(), "data/mock-requests.json");
  await fs.copyFile(seedFile, tmpFile);

  const app = createApplication({
    config: {
      host: "127.0.0.1",
      port: 0,
      logLevel: "error",
      dataMode: "mock",
      allowMockFallback: true,
      projectRoot: process.cwd(),
      mockDataFile: tmpFile,
      filemaker: {
        baseUrl: "",
        database: "",
        username: "",
        password: "",
        apiVersion: "vLatest",
        schema: {
          layouts: { requests: "ExcessLandRequests" },
          fields: {},
          containerFields: {
            requestPdf: "RequestPdf",
            responsePdf: "ResponsePdf",
            supportingPdf: "SupportingPdf",
          },
        },
      },
    },
  });

  const server = http.createServer(app.handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await fs.unlink(tmpFile);
  }
}

async function createRequest(baseUrl, title = "Detail Request") {
  const response = await fetch(`${baseUrl}/api/requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      requester: "Detail Tester",
    }),
  });
  assert.equal(response.status, 201);
  const payload = await response.json();
  return payload.item;
}

test("GET /api/requests/:id returns request detail", async () => {
  await withServer(async (baseUrl) => {
    const created = await createRequest(baseUrl);

    const detailResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.id)}`,
    );
    assert.equal(detailResponse.status, 200);

    const detailPayload = await detailResponse.json();
    assert.equal(detailPayload.item.id, created.id);
    assert.equal(detailPayload.item.title, "Detail Request");
  });
});

test("GET /api/requests/:id returns 404 for missing request", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests/not-found-id`);
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.errorCode, "request_not_found");
  });
});

test("lifecycle actions append audit events and repeated send is idempotent", async () => {
  await withServer(async (baseUrl) => {
    const created = await createRequest(baseUrl, "Audit Lifecycle");

    const initialAuditResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.id)}/audit`,
    );
    const initialAuditPayload = await initialAuditResponse.json();
    const initialCount = initialAuditPayload.items.length;

    const sendResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.id)}/send`,
      { method: "POST" },
    );
    assert.equal(sendResponse.status, 200);

    const repeatedSendResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.id)}/send`,
      { method: "POST" },
    );
    assert.equal(repeatedSendResponse.status, 200);

    const startResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.id)}/start`,
      { method: "POST" },
    );
    assert.equal(startResponse.status, 200);

    const completeResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.id)}/complete`,
      { method: "POST" },
    );
    assert.equal(completeResponse.status, 200);

    const auditResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.id)}/audit`,
    );
    assert.equal(auditResponse.status, 200);
    const auditPayload = await auditResponse.json();

    const labels = auditPayload.items.map((event) => event.label);
    assert.ok(labels.some((label) => String(label).includes("Request Sent")));
    assert.ok(
      labels.some((label) => String(label).includes("Waiting Response")),
    );
    assert.ok(labels.some((label) => String(label).includes("Completed")));
    assert.equal(auditPayload.items.length, initialCount + 3);
  });
});

test("POST /api/requests/:id/notes adds a note and audit entry", async () => {
  await withServer(async (baseUrl) => {
    const created = await createRequest(baseUrl, "Notes Request");

    const noteResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.id)}/notes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: "workflow",
          body: "Initial review note",
        }),
      },
    );

    assert.equal(noteResponse.status, 200);
    const notePayload = await noteResponse.json();
    assert.equal(notePayload.item.notes[0].text, "Initial review note");

    const auditResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.id)}/audit`,
    );
    const auditPayload = await auditResponse.json();
    assert.ok(
      auditPayload.items.some((event) => event.type === "note_added"),
    );
  });
});

test("document placeholders can be added and listed", async () => {
  await withServer(async (baseUrl) => {
    const created = await createRequest(baseUrl, "Documents Request");

    const addResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.id)}/documents/placeholder`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "response",
          name: "Response Artifact Placeholder",
          status: "placeholder",
          source: "adapter-ready",
          containerField: "<RESPONSE_CONTAINER_FIELD>",
        }),
      },
    );
    assert.equal(addResponse.status, 200);

    const listResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.id)}/documents`,
    );
    assert.equal(listResponse.status, 200);
    const listPayload = await listResponse.json();

    assert.ok(
      listPayload.items.some(
        (item) =>
          item.type === "response" &&
          item.status === "placeholder" &&
          item.name === "Response Artifact Placeholder",
      ),
    );
  });
});

test("PATCH /api/requests/:id/response updates response metadata", async () => {
  await withServer(async (baseUrl) => {
    const created = await createRequest(baseUrl, "Response Patch Request");

    const patchResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.id)}/response`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          summary: "Response metadata captured",
          completedBy: "ops_user",
          artifactName: "response-package.pdf",
          artifactStatus: "placeholder",
        }),
      },
    );

    assert.equal(patchResponse.status, 200);
    const patchPayload = await patchResponse.json();
    assert.equal(patchPayload.item.response.summary, "Response metadata captured");
    assert.equal(patchPayload.item.response.completedBy, "ops_user");
    assert.equal(patchPayload.item.response.artifactName, "response-package.pdf");
    assert.equal(patchPayload.item.response.artifactStatus, "placeholder");
  });
});

test("mock mode health remains ready", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.item.mode, "mock");
    assert.equal(payload.item.ready, true);
  });
});
