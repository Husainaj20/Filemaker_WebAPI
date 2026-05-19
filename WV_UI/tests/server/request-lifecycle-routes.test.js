import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createApplication } from "../../src/server/app.js";

async function withServer(fn) {
  const tmpFile = path.join(os.tmpdir(), `excessland-lifecycle-${Date.now()}.json`);
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
          containerFields: {}
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

test("GET /api/requests returns list in ok/items format", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.ok(Array.isArray(payload.items));
  });
});

test("POST /api/requests creates a draft request", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Lifecycle Request",
        requester: "Tester"
      })
    });

    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.item.stage, "draft");
  });
});

test("POST /api/requests/:id/send marks request as sent and sets sentAt", async () => {
  await withServer(async (baseUrl) => {
    const createdResponse = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Send Route",
        requester: "Tester"
      })
    });
    const created = await createdResponse.json();

    const sendResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.item.id)}/send`,
      { method: "POST" }
    );

    assert.equal(sendResponse.status, 200);
    const sendPayload = await sendResponse.json();
    assert.equal(sendPayload.item.stage, "request_sent");
    assert.ok(sendPayload.item.requestEmail.sentAt);
  });
});

test("POST /api/requests/:id/complete marks request as completed and sets completedAt", async () => {
  await withServer(async (baseUrl) => {
    const createdResponse = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Complete Route",
        requester: "Tester"
      })
    });
    const created = await createdResponse.json();

    await fetch(`${baseUrl}/api/requests/${encodeURIComponent(created.item.id)}/send`, {
      method: "POST"
    });
    await fetch(`${baseUrl}/api/requests/${encodeURIComponent(created.item.id)}/start`, {
      method: "POST"
    });

    const completeResponse = await fetch(
      `${baseUrl}/api/requests/${encodeURIComponent(created.item.id)}/complete`,
      { method: "POST" }
    );

    assert.equal(completeResponse.status, 200);
    const completePayload = await completeResponse.json();
    assert.equal(completePayload.item.stage, "completed");
    assert.ok(completePayload.item.response.completedOn);
  });
});

test("invalid request IDs return 404", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests/not-found-id/send`, {
      method: "POST"
    });
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload.ok, false);
  });
});

test("missing required fields return 400", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Missing requester" })
    });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.ok, false);
  });
});
