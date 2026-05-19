import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDir, "../..");

function readBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function resolveFileMakerBaseUrl() {
  if (process.env.FILEMAKER_BASE_URL) {
    return String(process.env.FILEMAKER_BASE_URL).trim();
  }
  if (process.env.FILEMAKER_SERVER) {
    return String(process.env.FILEMAKER_SERVER).trim();
  }
  return "";
}

const defaultSchema = {
  layouts: {
    requests: process.env.FILEMAKER_LAYOUT_REQUESTS || "ExcessLandRequests",
    records: process.env.FILEMAKER_LAYOUT_RECORDS || "",
    sessions: process.env.FILEMAKER_LAYOUT_SESSIONS || ""
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
  return readBoolean(process.env.APP_ALLOW_MOCK_FALLBACK, false);
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
      baseUrl: resolveFileMakerBaseUrl(),
      server: process.env.FILEMAKER_SERVER || "",
      database: process.env.FILEMAKER_DATABASE || "",
      username: process.env.FILEMAKER_USERNAME || "",
      password: process.env.FILEMAKER_PASSWORD || "",
      apiVersion: process.env.FILEMAKER_API_VERSION || "vLatest",
      verifySsl: readBoolean(process.env.FILEMAKER_VERIFY_SSL, true),
      timeoutMs: Number.parseInt(process.env.FILEMAKER_TIMEOUT_MS || "15000", 10),
      maxRetries: Number.parseInt(process.env.FILEMAKER_MAX_RETRIES || "1", 10),
      schema: filemakerSchema
    }
  };
}
