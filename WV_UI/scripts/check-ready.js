const baseUrl = process.env.CHECK_READY_BASE_URL || "http://127.0.0.1:3080";

function headers() {
  return {
    "content-type": "application/json",
    "x-user": "check_ready",
    "x-role": process.env.CHECK_READY_ROLE || "admin",
  };
}

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: headers(),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  return {
    status: response.status,
    payload,
  };
}

function assertOk(result, label) {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${label} failed (${result.status}) ${JSON.stringify(result.payload)}`);
  }
}

async function main() {
  console.log(`[check:ready] baseUrl=${baseUrl}`);

  const health = await request("/api/health");
  assertOk(health, "health");

  const summary = await request("/api/reports/summary");
  assertOk(summary, "reports summary");

  const readiness = await request("/api/diagnostics/deployment-readiness");
  assertOk(readiness, "deployment readiness");

  const readinessItem = readiness.payload?.item || readiness.payload?.data || {};
  const checks = Array.isArray(readinessItem.checks) ? readinessItem.checks : [];

  console.log(`[check:ready] health.ready=${Boolean(health.payload?.item?.ready)}`);
  console.log(
    `[check:ready] summary.total=${Number(summary.payload?.item?.totals?.requests || 0)}`,
  );

  for (const check of checks) {
    console.log(
      `[check:ready] ${check.key} ok=${Boolean(check.ok)} detail=${String(check.detail || "")}`,
    );
  }

  if (!readinessItem.ready) {
    throw new Error("deployment readiness reported ready=false");
  }

  console.log("[check:ready] readiness checks passed");
}

main().catch((error) => {
  console.error(`[check:ready] failed: ${error.message}`);
  process.exitCode = 1;
});
