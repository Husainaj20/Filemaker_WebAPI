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
          data: { ok: true }
        };
      }
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
          item: { id: "REQ-2" }
        };
      }
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
