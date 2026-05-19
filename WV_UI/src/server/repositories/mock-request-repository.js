import fs from "node:fs/promises";
import { AppError } from "../lib/errors.js";
import { normalizeRequest } from "../../shared/requests/request-model.js";

export class MockRequestRepository {
  constructor(options) {
    this.filePath = options.filePath;
    this.containerFields = options.containerFields || {};
  }

  async readAll() {
    const raw = await fs.readFile(this.filePath, "utf8");
    const payload = JSON.parse(raw);
    return payload.map((entry) => normalizeRequest(entry));
  }

  async writeAll(records) {
    await fs.writeFile(
      this.filePath,
      `${JSON.stringify(records, null, 2)}\n`,
      "utf8",
    );
  }

  async list() {
    return this.readAll();
  }

  async getById(id) {
    const records = await this.readAll();
    return records.find((record) => String(record.id) === String(id)) || null;
  }

  async save(request) {
    const records = await this.readAll();
    const index = records.findIndex(
      (record) => String(record.id) === String(request.id),
    );
    const normalized = normalizeRequest({
      ...request,
      source: {
        system: "mock",
        recordId: request.source?.recordId || "",
      },
    });

    if (index === -1) {
      records.unshift(normalized);
    } else {
      records[index] = normalized;
    }

    await this.writeAll(records);
    return normalized;
  }

  async listParentRecords() {
    const requests = await this.readAll();
    const index = new Map();

    for (const request of requests) {
      const id = String(request.recordId || "").trim();
      if (!id) continue;
      const displayName = String(request.recordLabel || id);
      if (!index.has(id)) {
        index.set(id, {
          id,
          displayName,
          raw: {
            recordId: id,
            recordLabel: displayName,
          },
          normalized: {
            id,
            displayName,
            status: "",
            location: "",
          },
        });
      }
    }

    return {
      records: Array.from(index.values()),
      source: "mock",
      diagnostics: {
        layout: "mock-requests-derived",
        elapsedMs: 0,
        recordCount: index.size,
      },
    };
  }

  async getStatus() {
    return {
      mode: "mock",
      ready: true,
      fallback: {
        allowed: false,
        active: false,
      },
      mock: {
        dataFile: this.filePath,
      },
      filemaker: {
        configured: false,
        connectivity: "not_applicable",
      },
    };
  }

  getContainerMapping() {
    return {
      ...this.containerFields,
    };
  }

  async downloadDocument(requestId, kind) {
    const request = await this.getById(requestId);
    if (!request) {
      throw new AppError(`Request ${requestId} was not found.`, {
        statusCode: 404,
        code: "request_not_found",
      });
    }

    const attachment =
      kind === "supportingPdf"
        ? request.documents?.relatedUploads?.[0] || null
        : request.documents?.[kind] || null;

    if (!attachment) {
      throw new AppError("Document was not found for this request.", {
        statusCode: 404,
        code: "document_not_found",
        details: { requestId, kind },
      });
    }

    if (!attachment.base64) {
      throw new AppError("Document content is unavailable for download.", {
        statusCode: 409,
        code: "document_content_unavailable",
        details: { requestId, kind },
      });
    }

    return {
      fileName: attachment.name || `${kind}.bin`,
      contentType: attachment.mimeType || "application/octet-stream",
      body: Buffer.from(attachment.base64, "base64"),
    };
  }
}
