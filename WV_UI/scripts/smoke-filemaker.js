const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3080";
const enableMutation =
  String(
    process.env.FILEMAKER_ENABLE_MUTATION_SMOKE || "false",
  ).toLowerCase() === "true";
const allowNonFileMakerMode =
  String(process.env.SMOKE_ALLOW_NON_FILEMAKER || "false").toLowerCase() ===
  "true";
const allowFallbackActive =
  String(process.env.SMOKE_ALLOW_FALLBACK_ACTIVE || "false").toLowerCase() ===
  "true";

function buildHeaders() {
  return {
    "content-type": "application/json",
    "x-user": "smoke_filemaker",
  };
}

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: buildHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  return {
    status: response.status,
    payload,
  };
}

function assertOk(result, label) {
  if (result.status < 200 || result.status >= 300) {
    const details = JSON.stringify(result.payload);
    throw new Error(`${label} failed (${result.status}): ${details}`);
  }
}

function envConfigPresence() {
  const required = [
    "FILEMAKER_SERVER",
    "FILEMAKER_BASE_URL",
    "FILEMAKER_DATABASE",
    "FILEMAKER_USERNAME",
    "FILEMAKER_PASSWORD",
  ];

  const provided = {
    endpoint: Boolean(process.env.FILEMAKER_SERVER || process.env.FILEMAKER_BASE_URL),
    database: Boolean(process.env.FILEMAKER_DATABASE),
    username: Boolean(process.env.FILEMAKER_USERNAME),
    password: Boolean(process.env.FILEMAKER_PASSWORD),
  };

  return {
    required,
    provided,
    hasCredentials:
      provided.endpoint &&
      provided.database &&
      provided.username &&
      provided.password,
  };
}

async function runReadOnlySmoke() {
  const health = await request("GET", "/api/health");
  assertOk(health, "health");

  const item = health.payload?.item || health.payload?.data || {};
  const requestedMode = item.requestedMode || item.mode || "unknown";
  const activeMode = item.activeMode || item.mode || "unknown";
  const fallbackActive = Boolean(item.fallbackActive || item.fallback?.active);
  const filemakerDiagnostics = item.diagnostics?.filemaker || {};

  if (!allowNonFileMakerMode && requestedMode !== "filemaker") {
    throw new Error(
      `server is not in filemaker mode (requestedMode=${requestedMode}). ` +
        "Set APP_DATA_MODE=filemaker or SMOKE_ALLOW_NON_FILEMAKER=true.",
    );
  }

  if (fallbackActive && !allowFallbackActive) {
    throw new Error(
      "filemaker fallback is active; strict mapping/connectivity smoke cannot continue. " +
        "Set SMOKE_ALLOW_FALLBACK_ACTIVE=true to bypass.",
    );
  }

  if (!filemakerDiagnostics || typeof filemakerDiagnostics !== "object") {
    throw new Error("filemaker diagnostics are missing from /api/health response");
  }

  if (!filemakerDiagnostics.mappingReady) {
    throw new Error(
      `mapping is not ready. missing=${JSON.stringify(filemakerDiagnostics.missingMappings || [])} ` +
        `placeholders=${JSON.stringify(filemakerDiagnostics.placeholderMappings || [])}`,
    );
  }

  const envStatus = envConfigPresence();
  if (envStatus.hasCredentials && !filemakerDiagnostics.connectionReady) {
    throw new Error("credentials were supplied but filemaker connection is not ready");
  }

  const layoutStatus = filemakerDiagnostics.layoutStatus || {};
  const requestLayout = layoutStatus.requests || {};
  if (!requestLayout.configured) {
    throw new Error("requests layout mapping is not configured");
  }
  if (envStatus.hasCredentials && requestLayout.accessible === false) {
    throw new Error("requests layout is configured but not accessible");
  }

  console.log(
    `[smoke:filemaker] health ok requestedMode=${requestedMode} activeMode=${activeMode} fallbackActive=${fallbackActive}`,
  );

  const list = await request("GET", "/api/requests");
  assertOk(list, "list requests");
  const items = Array.isArray(list.payload?.items)
    ? list.payload.items
    : Array.isArray(list.payload?.data)
      ? list.payload.data
      : [];
  const count = items.length;

  const stageErrors = items
    .slice(0, 25)
    .filter((item) => typeof item?.stage !== "string" || !item.stage.trim())
    .map((item) => item?.id || "unknown");

  if (stageErrors.length) {
    throw new Error(
      `stage field readability check failed for request ids: ${stageErrors.join(",")}`,
    );
  }

  console.log(`[smoke:filemaker] list requests ok count=${count}`);
  console.log("[smoke:filemaker] stage readability check passed");
}

async function runMutationSmoke() {
  const title = `FM Smoke ${Date.now()}`;
  const create = await request("POST", "/api/requests", {
    title,
    requester: "FileMaker Smoke",
  });
  assertOk(create, "create request");

  const requestId = create.payload?.item?.id || create.payload?.data?.id;
  if (!requestId) {
    throw new Error("create request did not return request id");
  }

  const send = await request(
    "POST",
    `/api/requests/${encodeURIComponent(requestId)}/send`,
  );
  assertOk(send, "send request");

  const start = await request(
    "POST",
    `/api/requests/${encodeURIComponent(requestId)}/start`,
  );
  assertOk(start, "start request");

  const complete = await request(
    "POST",
    `/api/requests/${encodeURIComponent(requestId)}/complete`,
  );
  assertOk(complete, "complete request");

  console.log(`[smoke:filemaker] mutation lifecycle ok requestId=${requestId}`);
}

async function main() {
  console.log(`[smoke:filemaker] baseUrl=${baseUrl}`);
  const envStatus = envConfigPresence();
  console.log(
    `[smoke:filemaker] env config present endpoint=${envStatus.provided.endpoint} database=${envStatus.provided.database} username=${envStatus.provided.username} password=${envStatus.provided.password}`,
  );
  await runReadOnlySmoke();

  if (!enableMutation) {
    console.log(
      "[smoke:filemaker] mutation smoke skipped (set FILEMAKER_ENABLE_MUTATION_SMOKE=true to enable)",
    );
    return;
  }

  await runMutationSmoke();
}

main().catch((error) => {
  console.error(`[smoke:filemaker] failed: ${error.message}`);
  process.exitCode = 1;
});
