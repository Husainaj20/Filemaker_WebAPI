const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3080";
const enableMutation =
  String(process.env.FILEMAKER_ENABLE_MUTATION_SMOKE || "false").toLowerCase() ===
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

async function runReadOnlySmoke() {
  const health = await request("GET", "/api/health");
  assertOk(health, "health");

  const mode = health.payload?.item?.requestedMode || health.payload?.item?.mode || "unknown";
  console.log(`[smoke:filemaker] health ok mode=${mode}`);

  const list = await request("GET", "/api/requests");
  assertOk(list, "list requests");
  const count = Array.isArray(list.payload?.items)
    ? list.payload.items.length
    : Array.isArray(list.payload?.data)
      ? list.payload.data.length
      : 0;
  console.log(`[smoke:filemaker] list requests ok count=${count}`);
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

  const send = await request("POST", `/api/requests/${encodeURIComponent(requestId)}/send`);
  assertOk(send, "send request");

  const start = await request("POST", `/api/requests/${encodeURIComponent(requestId)}/start`);
  assertOk(start, "start request");

  const complete = await request("POST", `/api/requests/${encodeURIComponent(requestId)}/complete`);
  assertOk(complete, "complete request");

  console.log(`[smoke:filemaker] mutation lifecycle ok requestId=${requestId}`);
}

async function main() {
  console.log(`[smoke:filemaker] baseUrl=${baseUrl}`);
  await runReadOnlySmoke();

  if (!enableMutation) {
    console.log("[smoke:filemaker] mutation smoke skipped (set FILEMAKER_ENABLE_MUTATION_SMOKE=true to enable)");
    return;
  }

  await runMutationSmoke();
}

main().catch((error) => {
  console.error(`[smoke:filemaker] failed: ${error.message}`);
  process.exitCode = 1;
});
