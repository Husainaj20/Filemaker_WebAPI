export class ApiError extends Error {
  constructor(message, payload = {}) {
    super(message);
    this.name = "ApiError";
    this.code = payload.code || "api_error";
    this.details = payload.details || null;
    this.traceId = payload.traceId || "";
  }
}

let activeRole = "operator";
let runtimeContext = {
  runtimeMode: "standalone",
  embedded: false,
  bridgeAvailable: false,
  launchSource: "direct",
};

function buildRuntimeHeaders() {
  return {
    "x-runtime-mode": String(runtimeContext.runtimeMode || "standalone"),
    "x-runtime-embedded": String(Boolean(runtimeContext.embedded)),
    "x-filemaker-bridge": String(Boolean(runtimeContext.bridgeAvailable)),
    "x-runtime-launch-source": String(runtimeContext.launchSource || "direct"),
  };
}

function buildHeaders() {
  return {
    "content-type": "application/json",
    "x-user": "web_operator",
    "x-role": activeRole,
    ...buildRuntimeHeaders(),
  };
}

async function request(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: buildHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json();
  if (!response.ok) {
    const message =
      payload.error ||
      payload.legacyError?.message ||
      payload.error?.message ||
      "API request failed.";
    throw new ApiError(message, {
      code:
        payload.errorCode || payload.legacyError?.code || payload.error?.code,
      details:
        payload.details ||
        payload.legacyError?.details ||
        payload.error?.details,
      traceId: payload.traceId,
    });
  }

  if (payload.data !== undefined) return payload.data;
  if (payload.item !== undefined) return payload.item;
  if (payload.items !== undefined) return payload.items;
  return payload;
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const apiClient = {
  setRole(role) {
    activeRole = String(role || "operator").trim().toLowerCase() || "operator";
  },
  getRole() {
    return activeRole;
  },
  setRuntimeContext(nextContext = {}) {
    runtimeContext = {
      ...runtimeContext,
      runtimeMode: String(nextContext.mode || nextContext.runtimeMode || runtimeContext.runtimeMode || "standalone"),
      embedded: Boolean(nextContext.embedded),
      bridgeAvailable: Boolean(
        nextContext.bridgeAvailable ?? nextContext.fileMakerBridgeAvailable,
      ),
      launchSource: String(
        nextContext.launchSource || runtimeContext.launchSource || "direct",
      ),
    };
  },
  getRuntimeContext() {
    return {
      ...runtimeContext,
    };
  },
  getHealth() {
    return request("GET", "/api/health");
  },
  getWebViewerDiagnostics() {
    return request("GET", "/api/diagnostics/webviewer");
  },
  getReportSummary(filters = {}) {
    return request("GET", `/api/reports/summary${buildQuery(filters)}`);
  },
  getReportSummaryJson(filters = {}) {
    return request("GET", `/api/reports/summary.json${buildQuery(filters)}`);
  },
  listRequests(filters = {}) {
    return request("GET", `/api/requests${buildQuery(filters)}`);
  },
  getRequestById(requestId) {
    return request("GET", `/api/requests/${encodeURIComponent(requestId)}`);
  },
  getRequestAudit(requestId) {
    return request(
      "GET",
      `/api/requests/${encodeURIComponent(requestId)}/audit`,
    );
  },
  addRequestNote(requestId, input) {
    return request(
      "POST",
      `/api/requests/${encodeURIComponent(requestId)}/notes`,
      input,
    );
  },
  listRequestDocuments(requestId) {
    return request(
      "GET",
      `/api/requests/${encodeURIComponent(requestId)}/documents`,
    );
  },
  addDocumentPlaceholder(requestId, input) {
    return request(
      "POST",
      `/api/requests/${encodeURIComponent(requestId)}/documents/placeholder`,
      input,
    );
  },
  updateResponse(requestId, patch) {
    return request(
      "PATCH",
      `/api/requests/${encodeURIComponent(requestId)}/response`,
      patch,
    );
  },
  listParents(filters = {}) {
    return request("GET", `/api/parents${buildQuery(filters)}`);
  },
  listRecords(filters = {}) {
    return request("GET", `/api/records${buildQuery(filters)}`);
  },
  createRequest(input) {
    return request("POST", "/api/requests", input);
  },
  updateRequest(requestId, input) {
    return request(
      "PUT",
      `/api/requests/${encodeURIComponent(requestId)}`,
      input,
    );
  },
  transitionRequest(requestId, targetStage, reason = "") {
    return request(
      "POST",
      `/api/requests/${encodeURIComponent(requestId)}/transition`,
      { targetStage, reason },
    );
  },
  sendRequest(requestId) {
    return request(
      "POST",
      `/api/requests/${encodeURIComponent(requestId)}/send`,
    );
  },
  startRequest(requestId) {
    return request(
      "POST",
      `/api/requests/${encodeURIComponent(requestId)}/start`,
    );
  },
  completeRequest(requestId) {
    return request(
      "POST",
      `/api/requests/${encodeURIComponent(requestId)}/complete`,
    );
  },
  async downloadDocument(requestId, kind) {
    const response = await fetch(
      `/api/requests/${encodeURIComponent(requestId)}/documents/${encodeURIComponent(kind)}`,
      {
        method: "GET",
        headers: {
          "x-user": "web_operator",
          "x-role": activeRole,
          ...buildRuntimeHeaders(),
        },
      },
    );

    if (!response.ok) {
      let message = "Document download failed.";
      try {
        const payload = await response.json();
        message = payload.error?.message || message;
      } catch (error) {
        // Best-effort parse only.
      }
      throw new ApiError(message, {
        code: "document_download_failed",
      });
    }

    const fileName =
      response.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/i)?.[1] || `${kind}.bin`;
    const blob = await response.blob();
    return {
      fileName,
      blob,
    };
  },
  async downloadRequestsCsv(filters = {}) {
    const response = await fetch(
      `/api/reports/requests.csv${buildQuery(filters)}`,
      {
        method: "GET",
        headers: {
          "x-user": "web_operator",
          "x-role": activeRole,
          ...buildRuntimeHeaders(),
        },
      },
    );

    if (!response.ok) {
      let message = "CSV export failed.";
      try {
        const payload = await response.json();
        message = payload.error || payload.error?.message || message;
      } catch (error) {
        // Best-effort parse only.
      }
      throw new ApiError(message, {
        code: "csv_export_failed",
      });
    }

    const fileName =
      response.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/i)?.[1] || "requests-export.csv";
    const blob = await response.blob();

    return {
      fileName,
      blob,
    };
  },
};
