import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createApplication } from "../../src/server/app.js";

async function withServer(configOverrides, fn) {
  const tmpFile = path.join(
    os.tmpdir(),
    `excessland-persistence-${Date.now()}.json`,
  );
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
        server: "",
        database: "",
        username: "",
        password: "",
        apiVersion: "vLatest",
        verifySsl: true,
        timeoutMs: 100,
        maxRetries: 0,
        schema: {
          layouts: {
            requests: "ExcessLandRequests",
            records: "",
            sessions: "",
          },
          fields: {},
          containerFields: {},
          recordFields: {},
          stageMap: {
            draft: "draft",
            request_sent: "request_sent",
            waiting_response: "waiting_response",
            completed: "completed",
          },
        },
      },
      ...configOverrides,
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

test("filemaker mode falls back to mock when enabled and filemaker config is incomplete", async () => {
  await withServer(
    {
      dataMode: "filemaker",
      allowMockFallback: true,
    },
    async (baseUrl) => {
      const healthResponse = await fetch(`${baseUrl}/api/health`);
      assert.equal(healthResponse.status, 200);
      const healthPayload = await healthResponse.json();
      assert.equal(healthPayload.item.requestedMode, "filemaker");
      assert.equal(healthPayload.item.activeMode, "mock");
      assert.equal(healthPayload.item.fallbackActive, true);
      assert.equal(healthPayload.item.ready, true);
      assert.ok(healthPayload.item.diagnostics.filemaker);
      assert.equal(
        typeof healthPayload.item.diagnostics.filemaker.mappingReady,
        "boolean",
      );
      assert.ok(Array.isArray(healthPayload.item.diagnostics.filemaker.missingMappings));

      const listResponse = await fetch(`${baseUrl}/api/requests`);
      assert.equal(listResponse.status, 200);
      const listPayload = await listResponse.json();
      assert.ok(Array.isArray(listPayload.items));
    },
  );
});

test("filemaker mode without fallback reports not ready and returns config error", async () => {
  await withServer(
    {
      dataMode: "filemaker",
      allowMockFallback: false,
    },
    async (baseUrl) => {
      const healthResponse = await fetch(`${baseUrl}/api/health`);
      assert.equal(healthResponse.status, 200);
      const healthPayload = await healthResponse.json();
      assert.equal(healthPayload.item.requestedMode, "filemaker");
      assert.equal(healthPayload.item.ready, false);
      assert.equal(healthPayload.item.fallbackActive, false);
      assert.equal(healthPayload.item.diagnostics.filemaker.connectionReady, false);

      const listResponse = await fetch(`${baseUrl}/api/requests`);
      assert.equal(listResponse.status, 503);
      const listPayload = await listResponse.json();
      assert.equal(listPayload.errorCode, "filemaker_config_incomplete");
    },
  );
});

test("mock mode lifecycle remains functional", async () => {
  await withServer(
    {
      dataMode: "mock",
      allowMockFallback: false,
    },
    async (baseUrl) => {
      const createResponse = await fetch(`${baseUrl}/api/requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Mock lifecycle",
          requester: "Tester",
        }),
      });
      assert.equal(createResponse.status, 201);
      const created = await createResponse.json();
      const requestId = created.item.id;

      const sendResponse = await fetch(
        `${baseUrl}/api/requests/${encodeURIComponent(requestId)}/send`,
        {
          method: "POST",
        },
      );
      assert.equal(sendResponse.status, 200);

      const startResponse = await fetch(
        `${baseUrl}/api/requests/${encodeURIComponent(requestId)}/start`,
        {
          method: "POST",
        },
      );
      assert.equal(startResponse.status, 200);

      const completeResponse = await fetch(
        `${baseUrl}/api/requests/${encodeURIComponent(requestId)}/complete`,
        {
          method: "POST",
        },
      );
      assert.equal(completeResponse.status, 200);
      const completed = await completeResponse.json();
      assert.equal(completed.item.stage, "completed");

      const healthResponse = await fetch(`${baseUrl}/api/health`);
      const healthPayload = await healthResponse.json();
      assert.equal(healthPayload.item.mode, "mock");
      assert.equal(healthPayload.item.ready, true);
    },
  );
});
