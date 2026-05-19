import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createApplication } from "../../src/server/app.js";
import { createId } from "../../src/shared/requests/request-model.js";

async function withServer(fn) {
  const tmpFile = path.join(os.tmpdir(), `excessland-test-${Date.now()}.json`);
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
            supportingPdf: "viewPDF"
          }
        }
      }
    }
  });

  const server = http.createServer(app.handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await fs.unlink(tmpFile);
  }
}

test("health and create request routes work", async () => {
  await withServer(async (baseUrl) => {
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const healthPayload = await healthResponse.json();
    assert.equal(healthPayload.data.mode, "mock");

    const createResponse = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: "Created from route test",
        requester: "Route Tester"
      })
    });
    const createPayload = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createPayload.data.title, "Created from route test");
  });
});

test("parent list and active-request filtering work through backend contract", async () => {
  await withServer(async (baseUrl) => {
    const activeParentId = `REC-${createId("a")}`;
    const closedParentId = `REC-${createId("c")}`;

    const createActive = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Active request",
        requester: "Ops User",
        recordId: activeParentId,
        recordLabel: "Parent Active",
        stage: "draft"
      })
    });
    assert.equal(createActive.status, 201);

    const createClosed = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Closed request",
        requester: "Ops User",
        recordId: closedParentId,
        recordLabel: "Parent Closed",
        stage: "closed"
      })
    });
    assert.equal(createClosed.status, 201);

    const parentsResponse = await fetch(`${baseUrl}/api/parents?activeOnly=true`);
    assert.equal(parentsResponse.status, 200);
    const parentsPayload = await parentsResponse.json();
    assert.ok(Array.isArray(parentsPayload.data));
    assert.ok(parentsPayload.data.some((parent) => parent.recordId === activeParentId));
    assert.ok(!parentsPayload.data.some((parent) => parent.recordId === closedParentId));

    const filteredResponse = await fetch(
      `${baseUrl}/api/requests?activeOnly=true&parentRecordId=${encodeURIComponent(activeParentId)}`,
    );
    assert.equal(filteredResponse.status, 200);
    const filteredPayload = await filteredResponse.json();
    assert.ok(filteredPayload.data.length >= 1);
    assert.ok(
      filteredPayload.data.every(
        (item) => item.recordId === activeParentId && item.stage !== "closed",
      ),
    );
  });
});

test("request and response document downloads return binary payloads", async () => {
  await withServer(async (baseUrl) => {
    const requestPdfBase64 = Buffer.from("request-pdf-content", "utf8").toString("base64");
    const responsePdfBase64 = Buffer.from("response-pdf-content", "utf8").toString("base64");

    const createResponse = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Document request",
        requester: "Ops User",
        documents: {
          requestPdf: {
            id: "att_req",
            name: "request.pdf",
            mimeType: "application/pdf",
            size: 19,
            uploadedAt: new Date().toISOString(),
            base64: requestPdfBase64
          },
          responsePdf: {
            id: "att_resp",
            name: "response.pdf",
            mimeType: "application/pdf",
            size: 20,
            uploadedAt: new Date().toISOString(),
            base64: responsePdfBase64
          }
        }
      })
    });
    const createdPayload = await createResponse.json();
    const requestId = createdPayload.data.id;

    const requestDocResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(requestId)}/documents/requestPdf`,
    );
    assert.equal(requestDocResponse.status, 200);
    const requestDocBody = Buffer.from(await requestDocResponse.arrayBuffer()).toString("utf8");
    assert.equal(requestDocBody, "request-pdf-content");

    const responseDocResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(requestId)}/documents/responsePdf`,
    );
    assert.equal(responseDocResponse.status, 200);
    const responseDocBody = Buffer.from(await responseDocResponse.arrayBuffer()).toString("utf8");
    assert.equal(responseDocBody, "response-pdf-content");
  });
});

test("diagnostics endpoints expose readiness and container probes", async () => {
  await withServer(async (baseUrl) => {
    const readinessResponse = await fetch(`${baseUrl}/api/diagnostics/v2-readiness`);
    assert.equal(readinessResponse.status, 200);
    const readinessPayload = await readinessResponse.json();
    assert.ok(Array.isArray(readinessPayload.data.checks));

    const mappingResponse = await fetch(`${baseUrl}/api/diagnostics/container-mapping`);
    assert.equal(mappingResponse.status, 200);
    const mappingPayload = await mappingResponse.json();
    assert.equal(mappingPayload.data.containerFields.supportingPdf, "viewPDF");

    const stabilityResponse = await fetch(`${baseUrl}/api/diagnostics/stability?iterations=2`);
    assert.equal(stabilityResponse.status, 200);
    const stabilityPayload = await stabilityResponse.json();
    assert.equal(stabilityPayload.data.iterations, 2);
  });
});

test("records endpoint returns normalized records contract", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/records?activeOnly=true`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(Array.isArray(payload.data.records));
    assert.equal(payload.data.mode, "mock");
    assert.ok(typeof payload.data.source === "string");
    assert.ok(payload.data.diagnostics);

    if (payload.data.records[0]) {
      assert.ok(typeof payload.data.records[0].id === "string");
      assert.ok(typeof payload.data.records[0].displayName === "string");
      assert.ok(typeof payload.data.records[0].activeRequestCount === "number");
      assert.ok(typeof payload.data.records[0].totalRequestCount === "number");
    }
  });
});
