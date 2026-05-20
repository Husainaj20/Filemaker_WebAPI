import { getRequestTypeByCode, getSubTypes } from "./request-types.js";
import { appendHistory, humanizeStage, nowIso } from "./request-model.js";

export const STAGES = Object.freeze({
  DRAFT: "draft",
  TYPE_SELECTED: "type_selected",
  DETAILS_IN_PROGRESS: "details_in_progress",
  REQUEST_PDF_READY: "request_pdf_ready",
  REQUEST_SENT: "request_sent",
  WAITING_RESPONSE: "waiting_response",
  RESPONSE_RECEIVED: "response_received",
  RESPONSE_FILES_UPLOADED: "response_files_uploaded",
  APPROVED: "approved",
  DENIED: "denied",
  COMPLETED: "completed",
  CLOSED: "closed",
  CANCELLED: "cancelled",
});

export const APPROVAL_STATES = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  DENIED: "denied",
  HOLD: "hold",
});

export const TRANSITION_DEFINITIONS = [
  { stage: STAGES.TYPE_SELECTED, label: "Type Selected" },
  { stage: STAGES.DETAILS_IN_PROGRESS, label: "Details Ready" },
  { stage: STAGES.REQUEST_PDF_READY, label: "Request PDF Ready" },
  { stage: STAGES.REQUEST_SENT, label: "Request Sent" },
  { stage: STAGES.WAITING_RESPONSE, label: "Waiting Response" },
  { stage: STAGES.RESPONSE_RECEIVED, label: "Response Received" },
  { stage: STAGES.RESPONSE_FILES_UPLOADED, label: "Response Files Uploaded" },
  { stage: STAGES.APPROVED, label: "Approve" },
  { stage: STAGES.DENIED, label: "Deny" },
  { stage: STAGES.COMPLETED, label: "Complete" },
  { stage: STAGES.CLOSED, label: "Close" },
  { stage: STAGES.CANCELLED, label: "Cancel" },
];

export const STAGE_REQUIREMENTS = {
  [STAGES.TYPE_SELECTED]: ["typeCode"],
  [STAGES.DETAILS_IN_PROGRESS]: [
    "typeCode",
    "subTypeCode",
    "recipientId",
    "reportingCodeId",
  ],
  [STAGES.REQUEST_PDF_READY]: [
    "typeCode",
    "subTypeCode",
    "recipientId",
    "reportingCodeId",
    "documents.requestPdf",
  ],
  [STAGES.REQUEST_SENT]: [],
  [STAGES.WAITING_RESPONSE]: ["requestEmail.sentAt"],
  [STAGES.RESPONSE_RECEIVED]: ["response.receivedAt"],
  [STAGES.RESPONSE_FILES_UPLOADED]: [
    "response.receivedAt",
    "documents.responsePdf",
  ],
  [STAGES.APPROVED]: ["response.receivedAt", "approval.state"],
  [STAGES.DENIED]: ["response.receivedAt", "approval.state"],
  [STAGES.COMPLETED]: ["approval.state", "response.completedOn"],
  [STAGES.CLOSED]: ["approval.state", "response.completedOn"],
};

function readPath(source, path) {
  return path
    .split(".")
    .reduce((accumulator, key) => accumulator?.[key], source);
}

function isFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function validateStage(request, targetStage) {
  const missing = [];
  const required = STAGE_REQUIREMENTS[targetStage] || [];

  for (const path of required) {
    if (!isFilled(readPath(request, path))) {
      missing.push(path);
    }
  }

  if (request.typeCode) {
    const type = getRequestTypeByCode(request.typeCode);
    if (!type) {
      missing.push("typeCode(valid)");
    } else if (request.subTypeCode) {
      const validSubtype = getSubTypes(request.typeCode).some(
        (subType) => subType.code === request.subTypeCode,
      );
      if (!validSubtype) {
        missing.push("subTypeCode(valid)");
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function getAvailableTransitions(request) {
  const currentStage = request.stage || STAGES.DRAFT;
  const currentIndex = TRANSITION_DEFINITIONS.findIndex(
    (definition) => definition.stage === currentStage,
  );

  return TRANSITION_DEFINITIONS.filter((definition, index) => {
    if (definition.stage === STAGES.CANCELLED) {
      return ![STAGES.CANCELLED, STAGES.CLOSED].includes(currentStage);
    }

    if (currentStage === STAGES.CLOSED || currentStage === STAGES.CANCELLED) {
      return false;
    }

    return index > currentIndex;
  });
}

export function transitionRequest(request, targetStage, options = {}) {
  if (String(request.stage || "") === String(targetStage || "")) {
    return {
      ok: true,
      request,
    };
  }

  const isKnownTarget = TRANSITION_DEFINITIONS.some(
    (definition) => definition.stage === targetStage,
  );
  if (!isKnownTarget) {
    return {
      ok: false,
      code: "invalid_target_stage",
      message: `Unknown target stage: ${String(targetStage || "")}.`,
    };
  }

  if ([STAGES.CLOSED, STAGES.CANCELLED].includes(request.stage)) {
    return {
      ok: false,
      code: "terminal_stage",
      message: "Closed or cancelled requests cannot transition further.",
    };
  }

  const validation = validateStage(request, targetStage);
  if (!validation.valid) {
    return {
      ok: false,
      code: "missing_required_data",
      message: `Cannot move to ${humanizeStage(targetStage)}.`,
      missing: validation.missing,
    };
  }

  request.stage = targetStage;
  request.status = humanizeStage(targetStage);
  request.updatedAt = nowIso();

  if (targetStage === STAGES.APPROVED) {
    request.approval.state = APPROVAL_STATES.APPROVED;
    request.approval.by = request.approval.by || options.actor || "system";
    request.approval.at = request.approval.at || nowIso();
  }

  if (targetStage === STAGES.DENIED) {
    request.approval.state = APPROVAL_STATES.DENIED;
    request.approval.by = request.approval.by || options.actor || "system";
    request.approval.at = request.approval.at || nowIso();
  }

  if (targetStage === STAGES.REQUEST_SENT && !request.requestEmail.sentAt) {
    request.requestEmail.sentAt = new Date().toISOString().slice(0, 10);
  }

  if (targetStage === STAGES.COMPLETED && !request.response.completedOn) {
    request.response.completedOn = new Date().toISOString().slice(0, 10);
  }

  appendHistory(request, {
    kind: "transition",
    message: `Stage changed to ${humanizeStage(targetStage)}.`,
    actor: options.actor || "system",
    meta: {
      targetStage,
      reason: options.reason || "",
    },
  });

  return {
    ok: true,
    request,
  };
}
