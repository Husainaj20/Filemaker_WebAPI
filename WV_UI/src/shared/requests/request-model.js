const DEFAULT_STAGE = "draft";

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix = "req") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function humanizeStage(stage) {
  return String(stage || DEFAULT_STAGE)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeAttachment(file) {
  if (!file) return null;
  return {
    id: file.id || createId("att"),
    name: file.name || "attachment",
    mimeType: file.mimeType || "application/octet-stream",
    size: Number.isFinite(file.size) ? file.size : 0,
    uploadedAt: file.uploadedAt || nowIso(),
    base64: file.base64 || "",
    fieldKey: file.fieldKey || ""
  };
}

export function sanitizeAttachment(file) {
  if (!file) return null;
  const normalized = normalizeAttachment(file);
  return {
    id: normalized.id,
    name: normalized.name,
    mimeType: normalized.mimeType,
    size: normalized.size,
    uploadedAt: normalized.uploadedAt,
    fieldKey: normalized.fieldKey
  };
}

export function createEmptyRequest(seed = {}) {
  const resolvedId = seed.id || createId("req");
  const derivedRequestNumber =
    seed.requestNumber ||
    `ELR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(
      resolvedId,
    ).slice(-6).toUpperCase()}`;

  return {
    id: resolvedId,
    requestNumber: derivedRequestNumber,
    recordId: seed.recordId || "",
    recordLabel: seed.recordLabel || "",
    title: seed.title || "Untitled Request",
    requester: seed.requester || seed.requestDetails?.requester || "",
    district: seed.district || seed.requestDetails?.district || "",
    county: seed.county || seed.requestDetails?.county || "",
    location: seed.location || seed.requestDetails?.location || "",
    parcel: seed.parcel || seed.requestDetails?.parcel || "",
    ea: seed.ea || seed.requestDetails?.ea || "",
    route: seed.route || seed.requestDetails?.route || "",
    pm: seed.pm || seed.requestDetails?.pm || "",
    stage: seed.stage || seed.status || DEFAULT_STAGE,
    status: seed.status || humanizeStage(seed.stage || DEFAULT_STAGE),
    priority: seed.priority || "medium",
    assignedTo: seed.assignedTo || "",
    typeCode: seed.typeCode || "",
    subTypeCode: seed.subTypeCode || "",
    recipientId: seed.recipientId || "",
    reportingCodeId: seed.reportingCodeId || "",
    requestDate: seed.requestDate || new Date().toISOString().slice(0, 10),
    dueDate: seed.dueDate || "",
    description: seed.description || "",
    requestDetails: seed.requestDetails || {},
    requestEmail: {
      to: seed.requestEmail?.to || "",
      cc: seed.requestEmail?.cc || "",
      subject: seed.requestEmail?.subject || "",
      body: seed.requestEmail?.body || "",
      sentAt: seed.requestEmail?.sentAt || ""
    },
    response: {
      status: seed.response?.status || "",
      receivedAt: seed.response?.receivedAt || "",
      completedOn: seed.response?.completedOn || "",
      responder: seed.response?.responder || "",
      summary: seed.response?.summary || "",
      notes: seed.response?.notes || "",
      decision: seed.response?.decision || "",
      value: seed.response?.value || ""
    },
    documents: {
      requestPdf: normalizeAttachment(seed.documents?.requestPdf || null),
      responsePdf: normalizeAttachment(seed.documents?.responsePdf || null),
      relatedUploads: Array.isArray(seed.documents?.relatedUploads)
        ? seed.documents.relatedUploads.map(normalizeAttachment)
        : [],
      responseUploads: Array.isArray(seed.documents?.responseUploads)
        ? seed.documents.responseUploads.map(normalizeAttachment)
        : []
    },
    notes: Array.isArray(seed.notes)
      ? seed.notes.map((note) => ({
          id: note.id || createId("note"),
          category: note.category || "general",
          text: note.text || "",
          author: note.author || "system",
          createdAt: note.createdAt || nowIso()
        }))
      : [],
    history: Array.isArray(seed.history)
      ? seed.history.map((entry) => ({
          id: entry.id || createId("evt"),
          kind: entry.kind || entry.eventType || "event",
          message: entry.message || entry.summary || "",
          actor: entry.actor || "system",
          meta: entry.meta || entry.patch || null,
          createdAt: entry.createdAt || entry.at || nowIso()
        }))
      : [],
    approval: {
      state: seed.approval?.state || "pending",
      by: seed.approval?.by || "",
      at: seed.approval?.at || "",
      notes: seed.approval?.notes || ""
    },
    source: {
      system: seed.source?.system || "app",
      recordId: seed.source?.recordId || ""
    },
    createdAt: seed.createdAt || nowIso(),
    updatedAt: seed.updatedAt || nowIso()
  };
}

export function normalizeRequest(raw = {}) {
  return createEmptyRequest(raw);
}

export function appendHistory(request, entry) {
  request.history = request.history || [];
  request.history.unshift({
    id: entry.id || createId("evt"),
    kind: entry.kind || "event",
    message: entry.message || "",
    actor: entry.actor || "system",
    meta: entry.meta || null,
    createdAt: entry.createdAt || nowIso()
  });
  request.updatedAt = nowIso();
  return request;
}

export function addNote(request, note) {
  request.notes = request.notes || [];
  request.notes.unshift({
    id: note.id || createId("note"),
    category: note.category || "general",
    text: note.text || "",
    author: note.author || "system",
    createdAt: note.createdAt || nowIso()
  });
  request.updatedAt = nowIso();
  return request;
}

export function stripAttachmentPayloads(request) {
  const cloned = clone(request);
  cloned.documents.requestPdf = sanitizeAttachment(cloned.documents.requestPdf);
  cloned.documents.responsePdf = sanitizeAttachment(cloned.documents.responsePdf);
  cloned.documents.relatedUploads = cloned.documents.relatedUploads.map(sanitizeAttachment);
  cloned.documents.responseUploads = cloned.documents.responseUploads.map(sanitizeAttachment);
  return cloned;
}
