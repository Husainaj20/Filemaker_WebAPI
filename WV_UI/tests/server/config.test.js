import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../src/server/config.js";

function withEnv(nextValues, callback) {
  const touchedKeys = Object.keys(nextValues);
  const original = new Map(
    touchedKeys.map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(nextValues)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const key of touchedKeys) {
      if (original.get(key) === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original.get(key);
      }
    }
  }
}

test("config resolves data mode and filemaker base from FILEMAKER_SERVER", () => {
  withEnv(
    {
      APP_DATA_MODE: "filemaker",
      FILEMAKER_SERVER: "https://fm.example.com",
      FILEMAKER_BASE_URL: "",
      FILEMAKER_VERIFY_SSL: "false",
      FILEMAKER_TIMEOUT_MS: "9876",
      FILEMAKER_MAX_RETRIES: "2",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.dataMode, "filemaker");
      assert.equal(config.filemaker.baseUrl, "https://fm.example.com");
      assert.equal(config.filemaker.verifySsl, false);
      assert.equal(config.filemaker.timeoutMs, 9876);
      assert.equal(config.filemaker.maxRetries, 2);
    },
  );
});

test("config resolves explicit mock mode", () => {
  withEnv(
    {
      APP_DATA_MODE: "mock",
      APP_ALLOW_MOCK_FALLBACK: "true",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.dataMode, "mock");
      assert.equal(config.allowMockFallback, true);
    },
  );
});
