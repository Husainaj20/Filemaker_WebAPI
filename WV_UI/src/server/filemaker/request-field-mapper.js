import {
  clone,
  normalizeRequest,
  stripAttachmentPayloads
} from "../../shared/requests/request-model.js";

function safeParseJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function readField(fieldData, fieldName) {
  if (!fieldName) return "";
  return fieldData?.[fieldName] ?? "";
}

export function createRequestFieldMapper(schema) {
  const fields = schema.fields || {};
  const containerFields = schema.containerFields || {};

  function fromFileMakerRecord(record) {
    const fieldData = record?.fieldData || {};
    const payload = safeParseJson(readField(fieldData, fields.payloadJson)) || {};

    return normalizeRequest({
      ...payload,
      id: readField(fieldData, fields.id) || payload.id,
      recordId: readField(fieldData, fields.recordId) || payload.recordId,
      recordLabel: readField(fieldData, fields.recordLabel) || payload.recordLabel,
      title: readField(fieldData, fields.title) || payload.title,
      stage: readField(fieldData, fields.stage) || payload.stage,
      status: readField(fieldData, fields.status) || payload.status,
      priority: readField(fieldData, fields.priority) || payload.priority,
      typeCode: readField(fieldData, fields.typeCode) || payload.typeCode,
      subTypeCode: readField(fieldData, fields.subTypeCode) || payload.subTypeCode,
      recipientId: readField(fieldData, fields.recipientId) || payload.recipientId,
      reportingCodeId:
        readField(fieldData, fields.reportingCodeId) || payload.reportingCodeId,
      requestDate: readField(fieldData, fields.requestDate) || payload.requestDate,
      dueDate: readField(fieldData, fields.dueDate) || payload.dueDate,
      description: readField(fieldData, fields.description) || payload.description,
      requestEmail: {
        ...(payload.requestEmail || {}),
        to: readField(fieldData, fields.requestEmailTo) || payload.requestEmail?.to,
        cc: readField(fieldData, fields.requestEmailCc) || payload.requestEmail?.cc,
        subject:
          readField(fieldData, fields.requestEmailSubject) ||
          payload.requestEmail?.subject,
        body:
          readField(fieldData, fields.requestEmailBody) || payload.requestEmail?.body,
        sentAt:
          readField(fieldData, fields.requestEmailSentAt) ||
          payload.requestEmail?.sentAt
      },
      response: {
        ...(payload.response || {}),
        status:
          readField(fieldData, fields.responseStatus) || payload.response?.status,
        receivedAt:
          readField(fieldData, fields.responseReceivedAt) ||
          payload.response?.receivedAt,
        completedOn:
          readField(fieldData, fields.responseCompletedOn) ||
          payload.response?.completedOn,
        responder:
          readField(fieldData, fields.responseResponder) ||
          payload.response?.responder,
        summary:
          readField(fieldData, fields.responseSummary) || payload.response?.summary,
        notes:
          readField(fieldData, fields.responseNotes) || payload.response?.notes,
        decision:
          readField(fieldData, fields.responseDecision) ||
          payload.response?.decision
      },
      approval: {
        ...(payload.approval || {}),
        state: readField(fieldData, fields.approvalState) || payload.approval?.state
      },
      source: {
        system: "filemaker",
        recordId: String(record?.recordId || payload.source?.recordId || "")
      },
      createdAt: readField(fieldData, fields.createdAt) || payload.createdAt,
      updatedAt: readField(fieldData, fields.updatedAt) || payload.updatedAt
    });
  }

  function toFileMakerPayload(request) {
    const clean = stripAttachmentPayloads(request);
    const payload = clone(clean);

    return {
      fieldData: {
        [fields.id]: payload.id,
        [fields.recordId]: payload.recordId,
        [fields.recordLabel]: payload.recordLabel,
        [fields.title]: payload.title,
        [fields.stage]: payload.stage,
        [fields.status]: payload.status,
        [fields.priority]: payload.priority,
        [fields.typeCode]: payload.typeCode,
        [fields.subTypeCode]: payload.subTypeCode,
        [fields.recipientId]: payload.recipientId,
        [fields.reportingCodeId]: payload.reportingCodeId,
        [fields.requestDate]: payload.requestDate,
        [fields.dueDate]: payload.dueDate,
        [fields.description]: payload.description,
        [fields.approvalState]: payload.approval.state,
        [fields.requestEmailTo]: payload.requestEmail.to,
        [fields.requestEmailCc]: payload.requestEmail.cc,
        [fields.requestEmailSubject]: payload.requestEmail.subject,
        [fields.requestEmailBody]: payload.requestEmail.body,
        [fields.requestEmailSentAt]: payload.requestEmail.sentAt,
        [fields.responseStatus]: payload.response.status,
        [fields.responseReceivedAt]: payload.response.receivedAt,
        [fields.responseCompletedOn]: payload.response.completedOn,
        [fields.responseResponder]: payload.response.responder,
        [fields.responseSummary]: payload.response.summary,
        [fields.responseNotes]: payload.response.notes,
        [fields.responseDecision]: payload.response.decision,
        [fields.payloadJson]: JSON.stringify(payload),
        [fields.createdAt]: payload.createdAt,
        [fields.updatedAt]: payload.updatedAt
      }
    };
  }

  function extractContainerUploads(request) {
    const supportingFile =
      request.documents?.supportingPdf || request.documents?.relatedUploads?.[0] || null;

    return [
      {
        fieldName: containerFields.requestPdf,
        file: request.documents?.requestPdf || null
      },
      {
        fieldName: containerFields.responsePdf,
        file: request.documents?.responsePdf || null
      },
      {
        fieldName: containerFields.supportingPdf,
        file: supportingFile
      }
    ].filter((entry) => entry.fieldName && entry.file?.base64);
  }

  return {
    fromFileMakerRecord,
    toFileMakerPayload,
    extractContainerUploads
  };
}
