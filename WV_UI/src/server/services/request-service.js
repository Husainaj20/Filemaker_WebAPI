import { AppError } from "../lib/errors.js";
import {
  appendHistory,
  createEmptyRequest,
  normalizeRequest,
  nowIso,
} from "../../shared/requests/request-model.js";
import {
  getAvailableTransitions,
  STAGES,
  transitionRequest,
} from "../../shared/requests/request-workflow.js";

const TERMINAL_STAGES = new Set([
  "approved",
  "denied",
  "completed",
  "closed",
  "cancelled",
]);

function isActiveRequest(request) {
  return !TERMINAL_STAGES.has(String(request.stage || "").toLowerCase());
}

function normalizeDocumentKind(kind) {
  if (kind === "request" || kind === "requestPdf") return "requestPdf";
  if (kind === "response" || kind === "responsePdf") return "responsePdf";
  if (kind === "supporting" || kind === "supportingPdf") return "supportingPdf";
  return "";
}

function createRequestNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ELR-${stamp}-${suffix}`;
}

function normalizeCreateInput(input = {}) {
  const requester = String(input.requester || input.requestDetails?.requester || "").trim();
  const title = String(input.title || input.projectName || "").trim();

  if (!title) {
    throw new AppError("Title is required.", {
      statusCode: 400,
      code: "request_title_required",
      expose: true,
    });
  }

  if (!requester) {
    throw new AppError("Requester is required.", {
      statusCode: 400,
      code: "request_requester_required",
      expose: true,
    });
  }

  return {
    ...input,
    title,
    requester,
    requestNumber: input.requestNumber || createRequestNumber(),
    stage: input.stage || STAGES.DRAFT,
  };
}

async function applyTransitionOrThrow(service, request, targetStage, actor, reason) {
  const result = transitionRequest(request, targetStage, {
    actor,
    reason,
  });

  if (!result.ok) {
    const allowedTransitions = getAvailableTransitions(request).map(
      (transition) => transition.stage,
    );
    throw new AppError(result.message || "Request transition failed.", {
      statusCode: 422,
      code: result.code || "request_transition_failed",
      details: {
        requestId: request.id,
        currentStage: request.stage,
        currentStatus: request.status,
        targetStage,
        allowedTransitions,
        missing: result.missing || [],
      },
      expose: true,
    });
  }

  return service.repository.save(request);
}

function mergeRequest(existing, incoming) {
  const normalizedIncoming = normalizeRequest(incoming);
  return normalizeRequest({
    ...existing,
    ...normalizedIncoming,
    requestDetails: {
      ...existing.requestDetails,
      ...normalizedIncoming.requestDetails,
    },
    requestEmail: {
      ...existing.requestEmail,
      ...normalizedIncoming.requestEmail,
    },
    response: {
      ...existing.response,
      ...normalizedIncoming.response,
    },
    documents: {
      ...existing.documents,
      ...normalizedIncoming.documents,
      relatedUploads: normalizedIncoming.documents?.relatedUploads?.length
        ? normalizedIncoming.documents.relatedUploads
        : existing.documents.relatedUploads,
      responseUploads: normalizedIncoming.documents?.responseUploads?.length
        ? normalizedIncoming.documents.responseUploads
        : existing.documents.responseUploads,
    },
    approval: {
      ...existing.approval,
      ...normalizedIncoming.approval,
    },
    notes: normalizedIncoming.notes?.length
      ? normalizedIncoming.notes
      : existing.notes,
    history: normalizedIncoming.history?.length
      ? normalizedIncoming.history
      : existing.history,
    source: {
      ...existing.source,
      ...normalizedIncoming.source,
    },
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  });
}

export class RequestService {
  constructor(options) {
    this.repository = options.repository;
    this.logger = options.logger;
    this.mode = options.mode;
    this.requestedMode = options.mode;
  }

  getActiveMode() {
    if (typeof this.repository.getRuntimeMode === "function") {
      return this.repository.getRuntimeMode();
    }
    return this.mode;
  }

  async health() {
    const hasFileMakerConfig = Boolean(
      this.config?.filemaker?.baseUrl &&
        this.config?.filemaker?.database &&
        this.config?.filemaker?.username &&
        this.config?.filemaker?.password,
    );

    const repositoryStatus =
      typeof this.repository.getStatus === "function"
        ? await this.repository.getStatus()
        : null;

    const activeMode = repositoryStatus?.mode || this.getActiveMode();
    const fallback = repositoryStatus?.fallback || {
      allowed: Boolean(this.config?.allowMockFallback),
      active: false,
      reason: null,
    };

    const filemaker = repositoryStatus?.filemaker || {
      configured: hasFileMakerConfig,
      connectivity:
        this.requestedMode === "filemaker" ? "unknown" : "not_applicable",
      missing: [],
      errorCode: "",
      errorMessage: "",
    };

    const ready =
      repositoryStatus?.ready ??
      (this.requestedMode !== "filemaker"
        ? true
        : hasFileMakerConfig && filemaker.connectivity !== "unavailable");

    return {
      mode: activeMode,
      requestedMode: this.requestedMode,
      activeMode,
      ready,
      fallbackActive: Boolean(fallback.active),
      fallback,
      diagnostics: {
        filemakerConfigured: hasFileMakerConfig,
        filemakerConnectivity: filemaker.connectivity,
        filemakerMissing: filemaker.missing || [],
        filemakerErrorCode: filemaker.errorCode || "",
        filemakerErrorMessage: filemaker.errorMessage || "",
      },
    };
  }

  async listRecords(filters = {}) {
    const activeOnly = Boolean(filters.activeOnly);
    const requests = await this.listRequestsFiltered({ activeOnly: false });

    const counts = new Map();
    for (const request of requests) {
      const recordId = String(request.recordId || "").trim();
      if (!recordId) continue;
      const entry = counts.get(recordId) || {
        totalRequestCount: 0,
        activeRequestCount: 0,
      };
      entry.totalRequestCount += 1;
      if (isActiveRequest(request)) {
        entry.activeRequestCount += 1;
      }
      counts.set(recordId, entry);
    }

    const parentPayload =
      typeof this.repository.listParentRecords === "function"
        ? await this.repository.listParentRecords()
        : { records: [], source: this.mode, diagnostics: {} };

    const sourceRecords = Array.isArray(parentPayload.records)
      ? parentPayload.records
      : [];

    const merged = new Map();

    for (const record of sourceRecords) {
      const id = String(record.id || record.normalized?.id || "").trim();
      if (!id) continue;
      const count = counts.get(id) || {
        totalRequestCount: 0,
        activeRequestCount: 0,
      };
      if (activeOnly && count.activeRequestCount === 0) continue;

      merged.set(id, {
        id,
        displayName: String(record.displayName || record.normalized?.displayName || id),
        raw: record.raw || {},
        normalized: {
          ...(record.normalized || {}),
          id,
          displayName: String(record.displayName || record.normalized?.displayName || id),
        },
        activeRequestCount: count.activeRequestCount,
        totalRequestCount: count.totalRequestCount,
      });
    }

    // Backward-compatible fallback when parent records layout is missing/empty.
    for (const [recordId, count] of counts.entries()) {
      if (merged.has(recordId)) continue;
      if (activeOnly && count.activeRequestCount === 0) continue;
      const requestSample = requests.find(
        (request) => String(request.recordId || "") === recordId,
      );
      const displayName = String(requestSample?.recordLabel || recordId);
      merged.set(recordId, {
        id: recordId,
        displayName,
        raw: {
          recordId,
          recordLabel: displayName,
        },
        normalized: {
          id: recordId,
          displayName,
        },
        activeRequestCount: count.activeRequestCount,
        totalRequestCount: count.totalRequestCount,
      });
    }

    return {
      records: Array.from(merged.values()).sort((a, b) =>
        String(a.displayName).localeCompare(String(b.displayName)),
      ),
      mode: this.getActiveMode(),
      activeMode: this.getActiveMode(),
      source:
        parentPayload.source || (this.getActiveMode() === "filemaker" ? "filemaker-data-api" : "mock"),
      diagnostics: {
        ...(parentPayload.diagnostics || {}),
        recordCount: merged.size,
      },
    };
  }

  async listRequests() {
    const records = await this.repository.list();
    return records;
  }

  async listRequestsFiltered(filters = {}) {
    const records = await this.repository.list();
    const parentRecordId = String(filters.parentRecordId || "").trim();
    const activeOnly = Boolean(filters.activeOnly);

    return records.filter((request) => {
      const matchesParent = !parentRecordId || String(request.recordId || "") === parentRecordId;
      const matchesActive = !activeOnly || isActiveRequest(request);
      return matchesParent && matchesActive;
    });
  }

  async listParents(filters = {}) {
    const requests = await this.listRequestsFiltered({
      activeOnly: Boolean(filters.activeOnly),
    });
    const parentIndex = new Map();

    for (const request of requests) {
      const recordId = String(request.recordId || "").trim();
      if (!recordId) continue;
      const key = recordId;
      const entry =
        parentIndex.get(key) || {
          recordId,
          recordLabel: request.recordLabel || recordId,
          totalCount: 0,
          activeCount: 0,
        };

      entry.totalCount += 1;
      if (isActiveRequest(request)) {
        entry.activeCount += 1;
      }
      if (!entry.recordLabel && request.recordLabel) {
        entry.recordLabel = request.recordLabel;
      }

      parentIndex.set(key, entry);
    }

    return Array.from(parentIndex.values()).sort((a, b) =>
      String(a.recordLabel).localeCompare(String(b.recordLabel)),
    );
  }

  async getRequest(requestId) {
    const request = await this.repository.getById(requestId);
    if (!request) {
      throw new AppError(`Request ${requestId} was not found.`, {
        statusCode: 404,
        code: "request_not_found",
      });
    }

    return request;
  }

  async createRequest(input, actor = "system") {
    const normalizedInput = normalizeCreateInput(input);
    const request = createEmptyRequest(normalizedInput);
    appendHistory(request, {
      kind: "created",
      message: "Request created in API workspace.",
      actor,
    });
    request.updatedAt = nowIso();
    return this.repository.save(request);
  }

  async updateRequest(requestId, input, actor = "system") {
    const existing = await this.getRequest(requestId);
    const request = mergeRequest(existing, { ...input, id: requestId });
    appendHistory(request, {
      kind: "saved",
      message: "Request saved via API.",
      actor,
    });
    return this.repository.save(request);
  }

  async transitionRequest(
    requestId,
    targetStage,
    actor = "system",
    reason = "",
  ) {
    const request = await this.getRequest(requestId);
    return applyTransitionOrThrow(this, request, targetStage, actor, reason);
  }

  async sendRequest(requestId, actor = "system") {
    const request = await this.getRequest(requestId);
    if (!request.requestEmail.sentAt) {
      request.requestEmail.sentAt = new Date().toISOString().slice(0, 10);
    }
    return applyTransitionOrThrow(
      this,
      request,
      STAGES.REQUEST_SENT,
      actor,
      "send_request",
    );
  }

  async startRequest(requestId, actor = "system") {
    const request = await this.getRequest(requestId);
    if (
      ![
        STAGES.REQUEST_SENT,
        STAGES.WAITING_RESPONSE,
        STAGES.RESPONSE_RECEIVED,
      ].includes(request.stage)
    ) {
      throw new AppError("Request must be sent before it can be marked in progress.", {
        statusCode: 422,
        code: "invalid_lifecycle_transition",
        details: {
          requestId,
          currentStage: request.stage,
          targetStage: STAGES.WAITING_RESPONSE,
        },
        expose: true,
      });
    }

    if (!request.requestEmail.sentAt) {
      request.requestEmail.sentAt = new Date().toISOString().slice(0, 10);
    }

    return applyTransitionOrThrow(
      this,
      request,
      STAGES.WAITING_RESPONSE,
      actor,
      "start_request",
    );
  }

  async completeRequest(requestId, actor = "system") {
    const request = await this.getRequest(requestId);
    if (
      [STAGES.DRAFT, STAGES.TYPE_SELECTED, STAGES.DETAILS_IN_PROGRESS].includes(
        request.stage,
      )
    ) {
      throw new AppError("Request must be sent or in progress before completion.", {
        statusCode: 422,
        code: "invalid_lifecycle_transition",
        details: {
          requestId,
          currentStage: request.stage,
          targetStage: STAGES.COMPLETED,
        },
        expose: true,
      });
    }

    if (!request.response.completedOn) {
      request.response.completedOn = new Date().toISOString().slice(0, 10);
    }

    return applyTransitionOrThrow(
      this,
      request,
      STAGES.COMPLETED,
      actor,
      "complete_request",
    );
  }

  async downloadDocument(requestId, kind) {
    const normalizedKind = normalizeDocumentKind(kind);
    if (!normalizedKind) {
      throw new AppError("Unsupported document kind.", {
        statusCode: 400,
        code: "document_kind_invalid",
        details: { kind },
      });
    }

    if (typeof this.repository.downloadDocument === "function") {
      return this.repository.downloadDocument(requestId, normalizedKind);
    }

    const request = await this.getRequest(requestId);
    const attachment =
      normalizedKind === "supportingPdf"
        ? request.documents?.relatedUploads?.[0] || null
        : request.documents?.[normalizedKind] || null;

    if (!attachment) {
      throw new AppError("Document was not found for this request.", {
        statusCode: 404,
        code: "document_not_found",
        details: { requestId, kind: normalizedKind },
      });
    }

    if (!attachment.base64) {
      throw new AppError("Document content is unavailable for download.", {
        statusCode: 409,
        code: "document_content_unavailable",
        details: { requestId, kind: normalizedKind },
      });
    }

    return {
      fileName: attachment.name || `${normalizedKind}.bin`,
      contentType: attachment.mimeType || "application/octet-stream",
      body: Buffer.from(attachment.base64, "base64"),
    };
  }

  async v2ReadinessProbe() {
    const hasCredentials = Boolean(
      this.config?.filemaker?.baseUrl &&
        this.config?.filemaker?.database &&
        this.config?.filemaker?.username &&
        this.config?.filemaker?.password,
    );
    const checks = [
      {
        key: "data_mode_filemaker",
        ok: this.requestedMode === "filemaker",
        detail: this.requestedMode,
      },
      {
        key: "mock_fallback_disabled",
        ok: !this.config?.allowMockFallback,
        detail: this.config?.allowMockFallback ? "enabled" : "disabled",
      },
      {
        key: "filemaker_credentials_present",
        ok: hasCredentials,
        detail: hasCredentials ? "present" : "missing",
      },
      {
        key: "repository_supports_download",
        ok: typeof this.repository.downloadDocument === "function",
        detail: typeof this.repository.downloadDocument === "function" ? "yes" : "no",
      },
    ];

    return {
      mode: this.getActiveMode(),
      requestedMode: this.requestedMode,
      ready: checks.every((check) => check.ok),
      checks,
    };
  }

  async containerMappingProbe() {
    const mapping = {
      ...(this.config?.filemaker?.schema?.containerFields || {}),
    };

    return {
      layout: this.config?.filemaker?.schema?.layouts?.requests || "",
      containerFields: mapping,
      checks: {
        requestPdfConfigured: Boolean(mapping.requestPdf),
        responsePdfConfigured: Boolean(mapping.responsePdf),
        supportingPdfConfigured: Boolean(mapping.supportingPdf),
        supportingPdfUsesInvalidLegacyField:
          String(mapping.supportingPdf || "").toLowerCase() ===
          "supporting.supportingpdf",
      },
    };
  }

  async stabilityProbe(iterations = 10) {
    const count = Math.max(1, Math.min(50, Number.parseInt(String(iterations), 10) || 10));
    const startedAt = Date.now();
    const passes = [];

    for (let index = 0; index < count; index += 1) {
      const cycleStarted = Date.now();
      const requests = await this.listRequestsFiltered({ activeOnly: true });
      if (requests[0]?.id) {
        await this.getRequest(requests[0].id);
      }
      passes.push({
        iteration: index + 1,
        durationMs: Date.now() - cycleStarted,
        requestCount: requests.length,
      });
    }

    return {
      iterations: count,
      totalDurationMs: Date.now() - startedAt,
      averageDurationMs: Math.round(passes.reduce((sum, pass) => sum + pass.durationMs, 0) / count),
      maxDurationMs: Math.max(...passes.map((pass) => pass.durationMs)),
      sample: passes.slice(0, 5),
    };
  }
}
