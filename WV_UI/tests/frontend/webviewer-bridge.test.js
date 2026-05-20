import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFileMakerPayload,
  buildFileMakerUrl,
  callFileMakerScript,
  getBridgeDiagnostics,
  getRuntimeContext,
  isFileMakerBridgeAvailable,
} from "../../src/frontend/webviewer-bridge.js";

test("bridge helper detects standalone mode safely", () => {
  const runtime = getRuntimeContext({
    url: "http://127.0.0.1:3080/?requestId=REQ-1",
  });

  assert.equal(runtime.mode, "standalone");
  assert.equal(runtime.embedded, false);
  assert.equal(runtime.requestId, "REQ-1");
  assert.equal(runtime.bridgeAvailable, false);
  assert.equal(isFileMakerBridgeAvailable(), false);
});

test("callFileMakerScript no-ops when bridge unavailable", () => {
  const original = globalThis.FileMaker;
  delete globalThis.FileMaker;

  try {
    const result = callFileMakerScript("WV_Request_Open", {
      requestId: "REQ-2",
    });
    assert.equal(result.ok, false);
    assert.equal(result.skipped, true);
    assert.equal(result.code, "bridge_unavailable");
  } finally {
    if (original) {
      globalThis.FileMaker = original;
    }
  }
});

test("bridge helper validates script names", () => {
  const result = callFileMakerScript("", {});
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_script_name");
});

test("bridge helper serializes payload deterministically", () => {
  const calls = [];
  const original = globalThis.FileMaker;
  globalThis.FileMaker = {
    PerformScript(scriptName, payload) {
      calls.push({ scriptName, payload });
    },
  };

  try {
    const result = callFileMakerScript("WV_Request_Sync", {
      b: 2,
      a: 1,
      nested: {
        z: "last",
        m: "mid",
      },
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].scriptName, "WV_Request_Sync");
    assert.equal(
      calls[0].payload,
      '{"a":1,"b":2,"nested":{"m":"mid","z":"last"}}',
    );
  } finally {
    if (original) {
      globalThis.FileMaker = original;
    } else {
      delete globalThis.FileMaker;
    }
  }
});

test("fmp url builder encodes payload safely", () => {
  const url = buildFileMakerUrl(
    "WV_Request_Open",
    buildFileMakerPayload("request_open", "REQ #1/2", {
      source: "deep_link",
    }),
  );

  assert.ok(url.startsWith("fmp://$/WV_Request_Open?script.param="));
  assert.ok(url.includes("REQ%20%231%2F2"));
});

test("bridge diagnostics surface safe transport status", () => {
  const original = globalThis.FileMaker;
  globalThis.FileMaker = {
    PerformScript() {},
  };

  try {
    const diagnostics = getBridgeDiagnostics();
    assert.equal(diagnostics.bridgeAvailable, true);
    assert.equal(diagnostics.transports.performScript, true);
    assert.equal(diagnostics.transports.fmpUrlFallback, true);
  } finally {
    if (original) {
      globalThis.FileMaker = original;
    } else {
      delete globalThis.FileMaker;
    }
  }
});
