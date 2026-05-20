function asBoolean(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value || "").trim().toLowerCase(),
  );
}

function getScope() {
  if (typeof window !== "undefined") return window;
  return globalThis;
}

function getSearchParams(explicitUrl) {
  const scope = getScope();

  if (explicitUrl) {
    try {
      return new URL(explicitUrl, "http://localhost").searchParams;
    } catch (error) {
      return new URLSearchParams();
    }
  }

  const href = scope?.location?.href;
  if (typeof href === "string" && href.length) {
    try {
      return new URL(href).searchParams;
    } catch (error) {
      return new URLSearchParams();
    }
  }

  return new URLSearchParams();
}

function sortPayload(value) {
  if (Array.isArray(value)) {
    return value.map(sortPayload);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .reduce((accumulator, key) => {
        accumulator[key] = sortPayload(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function stringifyPayload(payload) {
  return JSON.stringify(sortPayload(payload ?? {}));
}

function normalizeScriptName(scriptName) {
  return String(scriptName || "").trim();
}

function isValidScriptName(scriptName) {
  return /^[A-Za-z0-9_:-]{2,80}$/.test(normalizeScriptName(scriptName));
}

function getBridge() {
  const scope = getScope();
  return scope?.FileMaker || null;
}

export function isFileMakerBridgeAvailable() {
  const bridge = getBridge();
  if (!bridge) return false;

  return (
    typeof bridge.PerformScript === "function" ||
    typeof bridge.PerformScriptWithOption === "function"
  );
}

export function getRuntimeContext(options = {}) {
  const params = getSearchParams(options.url);
  const runtimeHint = String(
    params.get("runtime") || params.get("wvRuntime") || "",
  ).toLowerCase();
  const requestId = String(
    params.get("requestId") || params.get("wvRequestId") || "",
  ).trim();
  const recordId = String(
    params.get("recordId") || params.get("wvRecordId") || "",
  ).trim();
  const embeddedHint =
    asBoolean(params.get("embedded")) ||
    asBoolean(params.get("wvEmbedded")) ||
    ["filemaker", "webviewer", "embedded"].includes(runtimeHint);
  const bridgeAvailable = isFileMakerBridgeAvailable();
  const embedded = Boolean(embeddedHint || bridgeAvailable);
  const mode = embedded ? "webviewer" : "standalone";

  return {
    mode,
    embedded,
    runtimeHint,
    requestId,
    recordId,
    launchSource: String(params.get("launch") || params.get("wvLaunch") || "direct"),
    bridgeAvailable,
  };
}

export function buildFileMakerPayload(action, requestId = "", metadata = {}) {
  const normalizedAction = String(action || "").trim();
  if (!normalizedAction) {
    throw new Error("action is required");
  }

  const normalizedMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata
      : {};

  return {
    action: normalizedAction,
    requestId: String(requestId || ""),
    metadata: normalizedMetadata,
    emittedAt: new Date().toISOString(),
  };
}

export function buildFileMakerUrl(scriptName, payload) {
  const normalizedScriptName = normalizeScriptName(scriptName);
  if (!isValidScriptName(normalizedScriptName)) {
    throw new Error("Invalid FileMaker script name");
  }

  const serialized = stringifyPayload(payload);
  return `fmp://$/${encodeURIComponent(normalizedScriptName)}?script.param=${encodeURIComponent(serialized)}`;
}

export function callFileMakerScript(scriptName, payload = {}, options = {}) {
  const normalizedScriptName = normalizeScriptName(scriptName);
  if (!isValidScriptName(normalizedScriptName)) {
    return {
      ok: false,
      skipped: true,
      code: "invalid_script_name",
      message: "Invalid FileMaker script name.",
    };
  }

  const serializedPayload = stringifyPayload(payload);
  const bridge = getBridge();

  try {
    if (bridge && typeof bridge.PerformScript === "function") {
      bridge.PerformScript(normalizedScriptName, serializedPayload);
      return {
        ok: true,
        skipped: false,
        transport: "PerformScript",
        scriptName: normalizedScriptName,
      };
    }

    if (bridge && typeof bridge.PerformScriptWithOption === "function") {
      const option = Number.isFinite(options.option)
        ? Number(options.option)
        : 0;
      bridge.PerformScriptWithOption(
        normalizedScriptName,
        serializedPayload,
        option,
      );
      return {
        ok: true,
        skipped: false,
        transport: "PerformScriptWithOption",
        scriptName: normalizedScriptName,
      };
    }

    if (options.allowFmpUrlFallback) {
      const scope = getScope();
      const url = buildFileMakerUrl(normalizedScriptName, payload);
      if (scope?.location && typeof scope.location.assign === "function") {
        scope.location.assign(url);
        return {
          ok: true,
          skipped: false,
          transport: "fmp_url",
          scriptName: normalizedScriptName,
        };
      }
    }

    return {
      ok: false,
      skipped: true,
      code: "bridge_unavailable",
      message: "FileMaker bridge is not available in this runtime.",
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      code: "bridge_call_failed",
      message: error instanceof Error ? error.message : String(error),
      scriptName: normalizedScriptName,
    };
  }
}

export function getBridgeDiagnostics() {
  const runtime = getRuntimeContext();
  const bridge = getBridge();

  return {
    runtimeMode: runtime.mode,
    embedded: runtime.embedded,
    launchSource: runtime.launchSource,
    requestId: runtime.requestId,
    recordId: runtime.recordId,
    bridgeAvailable: runtime.bridgeAvailable,
    transports: {
      performScript: Boolean(bridge && typeof bridge.PerformScript === "function"),
      performScriptWithOption: Boolean(
        bridge && typeof bridge.PerformScriptWithOption === "function",
      ),
      fmpUrlFallback: true,
    },
  };
}
