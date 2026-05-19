import test from "node:test";
import assert from "node:assert/strict";
import { RequestService } from "../../src/server/services/request-service.js";

function createRepository() {
  const requests = [
    {
      id: "REQ-1",
      recordId: "REC-100",
      recordLabel: "DD 100-01",
      stage: "draft",
      status: "Draft"
    },
    {
      id: "REQ-2",
      recordId: "REC-100",
      recordLabel: "DD 100-01",
      stage: "closed",
      status: "Closed"
    },
    {
      id: "REQ-3",
      recordId: "REC-200",
      recordLabel: "DD 200-01",
      stage: "waiting_response",
      status: "Waiting Response"
    }
  ];

  return {
    async list() {
      return requests;
    },
    async listParentRecords() {
      return {
        records: [
          {
            id: "REC-100",
            displayName: "DD 100-01",
            raw: { MainRecordId: "REC-100" },
            normalized: { id: "REC-100", displayName: "DD 100-01" }
          },
          {
            id: "REC-200",
            displayName: "DD 200-01",
            raw: { MainRecordId: "REC-200" },
            normalized: { id: "REC-200", displayName: "DD 200-01" }
          }
        ],
        source: "filemaker-data-api",
        diagnostics: {
          layout: "records_byproperty",
          elapsedMs: 4,
          recordCount: 2
        }
      };
    }
  };
}

test("records service returns parent records with active/total request counts", async () => {
  const service = new RequestService({
    repository: createRepository(),
    logger: console,
    mode: "filemaker"
  });

  const payload = await service.listRecords({ activeOnly: false });
  assert.equal(payload.mode, "filemaker");
  assert.equal(payload.source, "filemaker-data-api");
  assert.equal(payload.records.length, 2);

  const rec100 = payload.records.find((record) => record.id === "REC-100");
  assert.ok(rec100);
  assert.equal(rec100.totalRequestCount, 2);
  assert.equal(rec100.activeRequestCount, 1);
});

test("records service supports activeOnly filtering", async () => {
  const service = new RequestService({
    repository: createRepository(),
    logger: console,
    mode: "filemaker"
  });

  const payload = await service.listRecords({ activeOnly: true });
  assert.equal(payload.records.length, 2);
  assert.ok(payload.records.every((record) => record.activeRequestCount > 0));
});
