import { AppError } from "../lib/errors.js";
import {
  normalizeRequest,
  stripAttachmentPayloads,
} from "../../shared/requests/request-model.js";

export class FileMakerRequestRepository {
  constructor(options) {
    this.client = options.client;
    this.mapper = options.mapper;
    this.layoutName = options.layoutName;
    this.containerFields = options.containerFields || {};
    this.recordsLayoutName = options.recordsLayoutName || this.layoutName;
    this.recordFields = options.recordFields || {};
  }

  readRecordField(fieldData, key) {
    const fieldName = this.recordFields?.[key] || "";
    if (!fieldName) return "";
    return fieldData?.[fieldName] ?? "";
  }

  async list() {
    const records = await this.client.listRecords(this.layoutName, {
      limit: 200,
    });
    return records.map((record) => this.mapper.fromFileMakerRecord(record));
  }

  async getById(id) {
    const fieldName = this.client.config.schema.fields.id;
    const records = await this.client.find(
      this.layoutName,
      {
        [fieldName]: `==${id}`,
      },
      { limit: 1 },
    );
    return records[0] ? this.mapper.fromFileMakerRecord(records[0]) : null;
  }

  async save(request) {
    const payload = this.mapper.toFileMakerPayload(request);
    const existing = await this.getById(request.id);
    let filemakerRecordId =
      existing?.source?.recordId || request.source?.recordId || "";

    if (filemakerRecordId) {
      await this.client.editRecord(this.layoutName, filemakerRecordId, payload);
    } else {
      const created = await this.client.createRecord(this.layoutName, payload);
      filemakerRecordId = String(created.recordId || "");
    }

    if (!filemakerRecordId) {
      throw new AppError("FileMaker did not return a recordId after save.", {
        statusCode: 502,
        code: "filemaker_record_id_missing",
      });
    }

    for (const upload of this.mapper.extractContainerUploads(request)) {
      await this.client.uploadContainer(
        this.layoutName,
        filemakerRecordId,
        upload.fieldName,
        upload.file,
      );
    }

    const fresh = await this.client.getRecord(
      this.layoutName,
      filemakerRecordId,
    );
    if (!fresh) {
      return normalizeRequest({
        ...stripAttachmentPayloads(request),
        source: {
          system: "filemaker",
          recordId: filemakerRecordId,
        },
      });
    }

    return this.mapper.fromFileMakerRecord(fresh);
  }

  async listParentRecords() {
    const startedAt = Date.now();
    const layout = this.recordsLayoutName || this.layoutName;
    const records = await this.client.listRecords(layout, {
      limit: 500,
    });

    const normalized = records.map((record) => {
      const fieldData = record?.fieldData || {};
      const id =
        String(this.readRecordField(fieldData, "id") || record.recordId || "") ||
        "";
      const displayName =
        String(this.readRecordField(fieldData, "displayName") || id || "") ||
        "";
      const status = String(this.readRecordField(fieldData, "status") || "");
      const location = String(this.readRecordField(fieldData, "location") || "");

      return {
        id,
        displayName,
        raw: {
          ...fieldData,
          recordId: String(record?.recordId || ""),
        },
        normalized: {
          id,
          displayName,
          status,
          location,
        },
      };
    });

    return {
      records: normalized,
      source: "filemaker-data-api",
      diagnostics: {
        layout,
        elapsedMs: Date.now() - startedAt,
        recordCount: normalized.length,
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

    const recordId = String(request.source?.recordId || "");
    if (!recordId) {
      throw new AppError("FileMaker record id is missing for this request.", {
        statusCode: 409,
        code: "filemaker_record_id_missing",
        details: { requestId },
      });
    }

    const fieldName = this.containerFields[kind] || "";
    if (!fieldName) {
      throw new AppError("Container field is not configured for document kind.", {
        statusCode: 404,
        code: "document_kind_not_supported",
        details: { kind },
      });
    }

    return this.client.downloadContainer(this.layoutName, recordId, fieldName);
  }
}
