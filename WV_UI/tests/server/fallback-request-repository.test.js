import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../src/server/lib/errors.js";
import { FallbackRequestRepository } from "../../src/server/repositories/fallback-request-repository.js";

test("fallback repository switches to mock on filemaker errors when enabled", async () => {
  const primary = {
    async list() {
      throw new AppError("timeout", {
        statusCode: 504,
        code: "filemaker_timeout",
      });
    },
    async getStatus() {
      return {
        mode: "filemaker",
        ready: false,
        filemaker: {
          configured: false,
          connectivity: "unavailable",
        },
      };
    },
  };

  const fallback = {
    async list() {
      return [{ id: "MOCK-1" }];
    },
    async getStatus() {
      return {
        mode: "mock",
        ready: true,
        mock: { dataFile: "tmp" },
      };
    },
  };

  const repository = new FallbackRequestRepository({
    primary,
    fallback,
    enableFallback: true,
    requestedMode: "filemaker",
  });

  const records = await repository.list();
  assert.equal(records.length, 1);
  assert.equal(repository.fallbackActive, true);

  const status = await repository.getStatus();
  assert.equal(status.mode, "mock");
  assert.equal(status.fallback.active, true);
});

test("fallback repository does not mask filemaker errors when disabled", async () => {
  const primary = {
    async list() {
      throw new AppError("missing config", {
        statusCode: 503,
        code: "filemaker_config_incomplete",
      });
    },
  };

  const fallback = {
    async list() {
      return [];
    },
  };

  const repository = new FallbackRequestRepository({
    primary,
    fallback,
    enableFallback: false,
    requestedMode: "filemaker",
  });

  await assert.rejects(repository.list(), (error) => {
    assert.equal(error.code, "filemaker_config_incomplete");
    return true;
  });
});
