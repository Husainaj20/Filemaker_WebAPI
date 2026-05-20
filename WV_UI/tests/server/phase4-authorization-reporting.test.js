import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createApplication } from "../../src/server/app.js";

async function withServer(fn) {
  const tmpFile = path.join(os.tmpdir(), `excessland-phase4-${Date.now()}.json`);
  const seedFile = path.resolve(process.cwd(), "data/mock-requests.json");
  await fs.copyFile(seedFile, tmpFile);

  const app = createApplication({
    config: {
      host: "127.0.0.1",
      port: 0,
      logLevel: "error",
      defaultRole: "operator",
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

function roleHeaders(role, withJson = false) {
  return {
    "x-role": role,
    "x-user": `${role}_tester`,
    ...(withJson ? { "content-type": "application/json" } : {}),
  };
}

test("viewer role cannot mutate requests but can read summary report", async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: roleHeaders("viewer", true),
      body: JSON.stringify({
        title: "Blocked create",
        requester: "Viewer",
      }),
    });

    assert.equal(createResponse.status, 403);
    const createPayload = await createResponse.json();
    assert.equal(createPayload.errorCode, "forbidden");

    const summaryResponse = await fetch(`${baseUrl}/api/reports/summary`, {
      headers: roleHeaders("viewer"),
    });
    assert.equal(summaryResponse.status, 200);
    const summaryPayload = await summaryResponse.json();
    assert.ok(summaryPayload.item.totals.requests >= 0);
  });
});

test("viewer role cannot export csv while operator can", async () => {
  await withServer(async (baseUrl) => {
    const forbiddenExportResponse = await fetch(
      `${baseUrl}/api/reports/requests.csv`,
      {
        headers: roleHeaders("viewer"),
      },
    );
    assert.equal(forbiddenExportResponse.status, 403);

    const allowedExportResponse = await fetch(`${baseUrl}/api/reports/requests.csv`, {
      headers: roleHeaders("operator"),
    });
    assert.equal(allowedExportResponse.status, 200);
    assert.equal(
      String(allowedExportResponse.headers.get("content-type") || "").startsWith(
        "text/csv",
      ),
      true,
    );

    const body = await allowedExportResponse.text();
    assert.ok(body.includes("requestNumber"));
  });
});

test("admin role can access deployment-readiness diagnostics", async () => {
  await withServer(async (baseUrl) => {
    const operatorResponse = await fetch(
      `${baseUrl}/api/diagnostics/deployment-readiness`,
      {
        headers: roleHeaders("operator"),
      },
    );
    assert.equal(operatorResponse.status, 403);

    const adminResponse = await fetch(
      `${baseUrl}/api/diagnostics/deployment-readiness`,
      {
        headers: roleHeaders("admin"),
      },
    );
    assert.equal(adminResponse.status, 200);

    const payload = await adminResponse.json();
    assert.equal(typeof payload.item.ready, "boolean");
    assert.ok(Array.isArray(payload.item.checks));
  });
});

test("webviewer diagnostics returns safe runtime fields for viewer role", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/diagnostics/webviewer?runtime=webviewer&embedded=true&requestId=REQ-77&recordId=REC-10`,
      {
        headers: roleHeaders("viewer"),
      },
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.item.role, "viewer");
    assert.equal(payload.item.runtime.mode, "webviewer");
    assert.equal(payload.item.runtime.embedded, true);
    assert.equal(payload.item.runtime.requestId, "REQ-77");
    assert.equal(payload.item.runtime.recordId, "REC-10");
    assert.equal(typeof payload.item.backend.activeMode, "string");
    assert.equal(payload.item.backend.password, undefined);
    assert.equal(payload.item.backend.username, undefined);

    const serialized = JSON.stringify(payload.item).toLowerCase();
    assert.equal(serialized.includes("filemaker_password"), false);
    assert.equal(serialized.includes("password"), false);
  });
});
