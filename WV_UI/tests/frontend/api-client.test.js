import test from "node:test";
import assert from "node:assert/strict";
import { apiClient } from "../../src/frontend/api-client.js";

test("frontend transition sends canonical targetStage key", async () => {
  const calls = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          data: { ok: true },
        };
      },
    };
  };

  try {
    await apiClient.transitionRequest("REQ-1", "response_files_uploaded");
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/requests/REQ-1/transition");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.targetStage, "response_files_uploaded");
  assert.notEqual(body.targetStage, "Response Files Uploaded");
});

test("frontend lifecycle helpers call canonical lifecycle routes", async () => {
  const calls = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          item: { id: "REQ-2" },
        };
      },
    };
  };

  try {
    await apiClient.sendRequest("REQ-2");
    await apiClient.startRequest("REQ-2");
    await apiClient.completeRequest("REQ-2");
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "/api/requests/REQ-2/send");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[1].url, "/api/requests/REQ-2/start");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[2].url, "/api/requests/REQ-2/complete");
  assert.equal(calls[2].options.method, "POST");
});

test("frontend detail helpers call note/document/response endpoints", async () => {
  const calls = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          item: { id: "REQ-3" },
          items: [],
        };
      },
    };
  };

  try {
    await apiClient.getRequestAudit("REQ-3");
    await apiClient.addRequestNote("REQ-3", { body: "note" });
    await apiClient.listRequestDocuments("REQ-3");
    await apiClient.addDocumentPlaceholder("REQ-3", {
      type: "supporting",
      name: "Placeholder",
    });
    await apiClient.updateResponse("REQ-3", { summary: "ok" });
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 5);
  assert.equal(calls[0].url, "/api/requests/REQ-3/audit");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[1].url, "/api/requests/REQ-3/notes");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[2].url, "/api/requests/REQ-3/documents");
  assert.equal(calls[2].options.method, "GET");
  assert.equal(calls[3].url, "/api/requests/REQ-3/documents/placeholder");
  assert.equal(calls[3].options.method, "POST");
  assert.equal(calls[4].url, "/api/requests/REQ-3/response");
  assert.equal(calls[4].options.method, "PATCH");
});

test("frontend client sends selected role header", async () => {
  const calls = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          data: { ok: true },
        };
      },
    };
  };

  try {
    apiClient.setRole("viewer");
    await apiClient.getReportSummary();
  } finally {
    apiClient.setRole("operator");
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/reports/summary");
  assert.equal(calls[0].options.headers["x-role"], "viewer");
});

test("frontend reporting helpers call summary and csv routes", async () => {
  const calls = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      headers: {
        get(name) {
          if (String(name).toLowerCase() === "content-disposition") {
            return 'attachment; filename="requests-export.csv"';
          }
          return "";
        },
      },
      async json() {
        return {
          data: { totals: { requests: 1 } },
          item: { totals: { requests: 1 } },
        };
      },
      async blob() {
        return new Blob(["id,title\n1,Sample\n"], {
          type: "text/csv",
        });
      },
    };
  };

  try {
    await apiClient.getReportSummary({ activeOnly: true });
    await apiClient.getReportSummaryJson({ parentRecordId: "REC-1" });
    await apiClient.downloadRequestsCsv({ activeOnly: true });
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "/api/reports/summary?activeOnly=true");
  assert.equal(calls[1].url, "/api/reports/summary.json?parentRecordId=REC-1");
  assert.equal(calls[2].url, "/api/reports/requests.csv?activeOnly=true");
  assert.equal(calls[2].options.method, "GET");
});

test("frontend diagnostics helper includes runtime headers", async () => {
  const calls = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          item: { runtime: { mode: "standalone" } },
        };
      },
    };
  };

  try {
    apiClient.setRole("admin");
    apiClient.setRuntimeContext({
      mode: "webviewer",
      embedded: true,
      bridgeAvailable: false,
      launchSource: "deep_link",
    });
    await apiClient.getWebViewerDiagnostics();
  } finally {
    apiClient.setRole("operator");
    apiClient.setRuntimeContext({
      mode: "standalone",
      embedded: false,
      bridgeAvailable: false,
      launchSource: "direct",
    });
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/diagnostics/webviewer");
  assert.equal(calls[0].options.headers["x-role"], "admin");
  assert.equal(calls[0].options.headers["x-runtime-mode"], "webviewer");
  assert.equal(calls[0].options.headers["x-runtime-embedded"], "true");
  assert.equal(calls[0].options.headers["x-filemaker-bridge"], "false");
});
