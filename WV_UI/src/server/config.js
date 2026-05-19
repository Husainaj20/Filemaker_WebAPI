import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDir, "../..");

const defaultSchema = {
  layouts: {
    requests: process.env.FILEMAKER_LAYOUT_REQUESTS || "ExcessLandRequests",
    records: process.env.FILEMAKER_LAYOUT_RECORDS || ""
  },
  fields: {
    id: "PrimaryKey",
    recordId: "MainRecordId",
    recordLabel: "RecordLabel",
    title: "Title",
    stage: "WorkflowStage",
    status: "StatusLabel",
    priority: "Priority",
    typeCode: "RequestType",
    subTypeCode: "SubRequestType",
    recipientId: "RecipientId",
    recipientLabel: "RecipientLabel",
    reportingCodeId: "ReportingCodeId",
    requestDate: "RequestDate",
    dueDate: "DueDate",
    description: "Description",
    approvalState: "ApprovalState",
    requestEmailTo: "RequestEmailTo",
    requestEmailCc: "RequestEmailCc",
    requestEmailSubject: "RequestEmailSubject",
    requestEmailBody: "RequestEmailBody",
    requestEmailSentAt: "RequestEmailSentAt",
    responseStatus: "ResponseStatus",
    responseReceivedAt: "ResponseReceivedAt",
    responseCompletedOn: "ResponseCompletedOn",
    responseResponder: "ResponseResponder",
    responseSummary: "ResponseSummary",
    responseNotes: "ResponseNotes",
    responseDecision: "ResponseDecision",
    payloadJson: "PayloadJson",
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt"
  },
  containerFields: {
    requestPdf: "RequestPdf",
    responsePdf: "ResponsePdf",
    supportingPdf: process.env.FILEMAKER_CONTAINER_SUPPORTING_PDF || ""
  },
  recordFields: {
    id: process.env.FILEMAKER_RECORD_FIELD_ID || "MainRecordId",
    displayName: process.env.FILEMAKER_RECORD_FIELD_DISPLAY || "RecordLabel",
    status: process.env.FILEMAKER_RECORD_FIELD_STATUS || "",
    location: process.env.FILEMAKER_RECORD_FIELD_LOCATION || ""
  }
};

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function resolveSchema() {
  const schemaFile = process.env.FILEMAKER_SCHEMA_FILE;
  if (!schemaFile) return defaultSchema;

  const absolutePath = path.resolve(projectRoot, schemaFile);
  return readJsonFile(absolutePath) || defaultSchema;
}

function resolveDataMode() {
  if (process.env.APP_DATA_MODE) {
    return String(process.env.APP_DATA_MODE).toLowerCase();
  }

  if (process.env.FILEMAKER_BASE_URL || process.env.FILEMAKER_DATABASE) {
    return "filemaker";
  }

  // Default to filemaker so mock is an explicit choice only.
  return "filemaker";
}

function resolveAllowMockFallback() {
  return String(process.env.APP_ALLOW_MOCK_FALLBACK || "false").toLowerCase() === "true";
}

export function loadConfig() {
  const filemakerSchema = resolveSchema();

  return {
    host: process.env.APP_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.APP_PORT || "3080", 10),
    logLevel: process.env.LOG_LEVEL || "info",
    dataMode: resolveDataMode(),
    allowMockFallback: resolveAllowMockFallback(),
    projectRoot,
    mockDataFile: path.resolve(projectRoot, "data/mock-requests.json"),
    filemaker: {
      baseUrl: process.env.FILEMAKER_BASE_URL || "",
      database: process.env.FILEMAKER_DATABASE || "",
      username: process.env.FILEMAKER_USERNAME || "",
      password: process.env.FILEMAKER_PASSWORD || "",
      apiVersion: process.env.FILEMAKER_API_VERSION || "vLatest",
      schema: filemakerSchema
    }
  };
}
