const CANONICAL_STAGE_KEYS = [
  "draft",
  "request_sent",
  "waiting_response",
  "completed",
];

const REQUIRED_LAYOUT_KEYS = ["requests"];
const REQUIRED_FIELD_KEYS = [
  "id",
  "recordId",
  "recordLabel",
  "title",
  "stage",
  "status",
  "requestDate",
  "requestEmailSentAt",
  "responseCompletedOn",
  "payloadJson",
  "createdAt",
  "updatedAt",
];
const REQUIRED_RECORD_FIELD_KEYS = ["id", "displayName", "status"];
const OPTIONAL_CONTAINER_FIELD_KEYS = [
  "requestPdf",
  "responsePdf",
  "supportingPdf",
];

function isPlaceholderValue(value) {
  const text = String(value || "").trim();
  if (!text) return true;

  const patterns = [
    /^<.*>$/,
    /^todo$/i,
    /^tbd$/i,
    /^placeholder$/i,
    /^change[-_]?me$/i,
    /^replace[-_]?me$/i,
    /^example$/i,
    /^your[-_]/i,
    /your-filemaker-host/i,
    /example\.com/i,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function getPathValue(target, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], target);
}

function collectValidation(schema, sourceType = "custom") {
  const missingMappings = [];
  const placeholderMappings = [];
  const optionalMissing = [];
  const stageMap = schema.stageMap || {};

  for (const key of REQUIRED_LAYOUT_KEYS) {
    const path = `layouts.${key}`;
    const value = getPathValue(schema, path);
    if (!String(value || "").trim()) {
      missingMappings.push({ path, reason: "required_layout_missing" });
      continue;
    }
    if (isPlaceholderValue(value)) {
      placeholderMappings.push({ path, value: String(value) });
    }
  }

  for (const key of REQUIRED_FIELD_KEYS) {
    const path = `fields.${key}`;
    const value = getPathValue(schema, path);
    if (!String(value || "").trim()) {
      missingMappings.push({ path, reason: "required_field_mapping_missing" });
      continue;
    }
    if (isPlaceholderValue(value)) {
      placeholderMappings.push({ path, value: String(value) });
    }
  }

  for (const key of REQUIRED_RECORD_FIELD_KEYS) {
    const path = `recordFields.${key}`;
    const value = getPathValue(schema, path);
    if (!String(value || "").trim()) {
      missingMappings.push({ path, reason: "required_record_field_mapping_missing" });
      continue;
    }
    if (isPlaceholderValue(value)) {
      placeholderMappings.push({ path, value: String(value) });
    }
  }

  for (const key of OPTIONAL_CONTAINER_FIELD_KEYS) {
    const path = `containerFields.${key}`;
    const value = getPathValue(schema, path);
    if (!String(value || "").trim()) {
      optionalMissing.push({ path, reason: "optional_container_mapping_missing" });
      continue;
    }
    if (isPlaceholderValue(value)) {
      placeholderMappings.push({ path, value: String(value) });
    }
  }

  for (const key of CANONICAL_STAGE_KEYS) {
    const path = `stageMap.${key}`;
    const value = stageMap[key];
    if (!String(value || "").trim()) {
      missingMappings.push({ path, reason: "required_stage_mapping_missing" });
      continue;
    }
    if (isPlaceholderValue(value)) {
      placeholderMappings.push({ path, value: String(value) });
    }
  }

  const assumedMappings = [];
  if (["default", "example"].includes(sourceType)) {
    for (const path of [
      ...REQUIRED_LAYOUT_KEYS.map((key) => `layouts.${key}`),
      ...REQUIRED_FIELD_KEYS.map((key) => `fields.${key}`),
      ...REQUIRED_RECORD_FIELD_KEYS.map((key) => `recordFields.${key}`),
      ...CANONICAL_STAGE_KEYS.map((key) => `stageMap.${key}`),
    ]) {
      const value = getPathValue(schema, path);
      if (String(value || "").trim()) {
        assumedMappings.push({ path, value: String(value) });
      }
    }
  }

  const ready = missingMappings.length === 0;
  const confirmed = ready && placeholderMappings.length === 0 && assumedMappings.length === 0;

  return {
    ready,
    confirmed,
    missingMappings,
    placeholderMappings,
    optionalMissing,
    assumedMappings,
    required: {
      layouts: REQUIRED_LAYOUT_KEYS,
      fields: REQUIRED_FIELD_KEYS,
      recordFields: REQUIRED_RECORD_FIELD_KEYS,
      stageMap: CANONICAL_STAGE_KEYS,
      optionalContainerFields: OPTIONAL_CONTAINER_FIELD_KEYS,
    },
  };
}

export function validateFileMakerSchema(schema, options = {}) {
  const sourceType = options.sourceType || "custom";
  const source = options.source || "inline";
  return {
    source,
    sourceType,
    ...collectValidation(schema || {}, sourceType),
  };
}

export const FILEMAKER_STAGE_KEYS = Object.freeze([...CANONICAL_STAGE_KEYS]);
