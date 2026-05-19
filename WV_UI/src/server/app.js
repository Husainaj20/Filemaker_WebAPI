import fs from "node:fs/promises";
import path from "node:path";
import { AppError, asAppError } from "./lib/errors.js";
import {
  isSafePath,
  readJsonBody,
  sendJson,
  sendStaticFile,
} from "./lib/http.js";
import { createLogger } from "./lib/logger.js";
import { loadConfig } from "./config.js";
import { FileMakerDataApiClient } from "./filemaker/filemaker-client.js";
import { createRequestFieldMapper } from "./filemaker/request-field-mapper.js";
import { FallbackRequestRepository } from "./repositories/fallback-request-repository.js";
import { FileMakerRequestRepository } from "./repositories/filemaker-request-repository.js";
import { MockRequestRepository } from "./repositories/mock-request-repository.js";
import { RequestPersistenceAdapter } from "./services/request-persistence-adapter.js";
import { RequestService } from "./services/request-service.js";

function createTraceId() {
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readBooleanQueryParam(searchParams, key) {
  const raw = searchParams.get(key);
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function sendItemResponse(response, statusCode, item, traceId) {
  return sendJson(response, statusCode, {
    ok: true,
    item,
    data: item,
    traceId,
  });
}

function sendItemsResponse(response, statusCode, items, traceId) {
  return sendJson(response, statusCode, {
    ok: true,
    items,
    data: items,
    traceId,
  });
}

function createMockRepository(config) {
  return new MockRequestRepository({
    filePath: config.mockDataFile,
    containerFields: config.filemaker.schema.containerFields,
  });
}

function createFileMakerRepository(config, logger) {
  const client = new FileMakerDataApiClient(config.filemaker, {
    logger,
  });
  const mapper = createRequestFieldMapper(config.filemaker.schema);
  return new FileMakerRequestRepository({
    client,
    mapper,
    layoutName: config.filemaker.schema.layouts.requests,
    recordsLayoutName:
      config.filemaker.schema.layouts.records ||
      config.filemaker.schema.layouts.requests,
    containerFields: config.filemaker.schema.containerFields,
    recordFields: config.filemaker.schema.recordFields,
  });
}

function createRepository(config, logger) {
  if (config.dataMode === "mock") {
    return createMockRepository(config);
  }

  if (config.dataMode === "filemaker") {
    const primaryRepository = createFileMakerRepository(config, logger);
    if (config.allowMockFallback) {
      return new FallbackRequestRepository({
        primary: primaryRepository,
        fallback: createMockRepository(config),
        logger,
        enableFallback: true,
        requestedMode: "filemaker",
      });
    }
    return primaryRepository;
  }

  throw new AppError("Unsupported APP_DATA_MODE value.", {
    statusCode: 500,
    code: "invalid_data_mode",
    details: {
      dataMode: config.dataMode,
      expected: ["mock", "filemaker"],
    },
    expose: true,
  });
}

async function routeRequest(adapter, service, request, response, url, traceId) {
  if (url.pathname === "/api/health" && request.method === "GET") {
    return sendItemResponse(response, 200, await adapter.health(), traceId);
  }

  if (url.pathname === "/api/requests" && request.method === "GET") {
    const parentRecordId = url.searchParams.get("parentRecordId") || "";
    const activeOnly = readBooleanQueryParam(url.searchParams, "activeOnly");
    return sendItemsResponse(
      response,
      200,
      await adapter.listRequests({
        parentRecordId,
        activeOnly,
      }),
      traceId,
    );
  }

  if (url.pathname === "/api/parents" && request.method === "GET") {
    const activeOnly = readBooleanQueryParam(url.searchParams, "activeOnly");
    return sendItemsResponse(response, 200, await adapter.listParents({ activeOnly }), traceId);
  }

  if (url.pathname === "/api/records" && request.method === "GET") {
    const activeOnly = readBooleanQueryParam(url.searchParams, "activeOnly");
    return sendItemResponse(response, 200, await adapter.listRecords({ activeOnly }), traceId);
  }

  if (url.pathname === "/api/requests" && request.method === "POST") {
    const body = await readJsonBody(request);
    return sendItemResponse(
      response,
      201,
      await adapter.createRequest(
        body,
        request.headers["x-user"] || "api_user",
      ),
      traceId,
    );
  }

  const requestMatch = url.pathname.match(/^\/api\/requests\/([^/]+)$/);
  if (requestMatch && request.method === "GET") {
    return sendItemResponse(response, 200, await adapter.getRequestById(requestMatch[1]), traceId);
  }

  if (requestMatch && ["PUT", "PATCH"].includes(request.method)) {
    const body = await readJsonBody(request);
    return sendItemResponse(
      response,
      200,
      await adapter.updateRequest(
        requestMatch[1],
        body,
        request.headers["x-user"] || "api_user",
      ),
      traceId,
    );
  }

  const sendMatch = url.pathname.match(/^\/api\/requests\/([^/]+)\/send$/);
  if (sendMatch && request.method === "POST") {
    return sendItemResponse(
      response,
      200,
      await adapter.sendRequest(sendMatch[1], request.headers["x-user"] || "api_user"),
      traceId,
    );
  }

  const startMatch = url.pathname.match(/^\/api\/requests\/([^/]+)\/start$/);
  if (startMatch && request.method === "POST") {
    return sendItemResponse(
      response,
      200,
      await adapter.startRequest(startMatch[1], request.headers["x-user"] || "api_user"),
      traceId,
    );
  }

  const completeMatch = url.pathname.match(/^\/api\/requests\/([^/]+)\/complete$/);
  if (completeMatch && request.method === "POST") {
    return sendItemResponse(
      response,
      200,
      await adapter.completeRequest(
        completeMatch[1],
        request.headers["x-user"] || "api_user",
      ),
      traceId,
    );
  }

  const transitionMatch = url.pathname.match(
    /^\/api\/requests\/([^/]+)\/transition$/,
  );
  if (transitionMatch && request.method === "POST") {
    const body = await readJsonBody(request);
    return sendItemResponse(
      response,
      200,
      await adapter.transitionRequest(
        transitionMatch[1],
        body.targetStage,
        request.headers["x-user"] || body.actor || "api_user",
        body.reason || "",
      ),
      traceId,
    );
  }

  const documentMatch = url.pathname.match(
    /^\/api\/requests\/([^/]+)\/documents\/([^/]+)$/,
  );
  if (documentMatch && request.method === "GET") {
    const file = await adapter.downloadDocument(documentMatch[1], documentMatch[2]);
    response.writeHead(200, {
      "content-type": file.contentType || "application/octet-stream",
      "content-disposition": `attachment; filename="${String(file.fileName || "download.bin").replace(/"/g, "")}"`,
      "cache-control": "no-store",
    });
    response.end(file.body);
    return;
  }

  if (url.pathname === "/api/diagnostics/v2-readiness" && request.method === "GET") {
    return sendItemResponse(response, 200, await adapter.v2ReadinessProbe(), traceId);
  }

  if (url.pathname === "/api/diagnostics/container-mapping" && request.method === "GET") {
    return sendItemResponse(response, 200, await adapter.containerMappingProbe(), traceId);
  }

  if (url.pathname === "/api/diagnostics/stability" && ["GET", "POST"].includes(request.method)) {
    const body = request.method === "POST" ? await readJsonBody(request) : {};
    const queryIterations = url.searchParams.get("iterations");
    const iterations =
      body.iterations ?? (queryIterations ? Number.parseInt(queryIterations, 10) : undefined);
    return sendItemResponse(response, 200, await adapter.stabilityProbe(iterations), traceId);
  }

  if (request.method !== "GET") {
    throw new AppError("Route not found.", {
      statusCode: 404,
      code: "route_not_found",
    });
  }

  const targetPath =
    url.pathname === "/"
      ? path.resolve(service.config.projectRoot, "index.html")
      : path.resolve(service.config.projectRoot, `.${url.pathname}`);

  if (!isSafePath(service.config.projectRoot, targetPath)) {
    throw new AppError("Unsafe file path.", {
      statusCode: 403,
      code: "unsafe_path",
    });
  }

  try {
    const stats = await fs.stat(targetPath);
    if (stats.isDirectory()) {
      throw new AppError("Directory listing is not allowed.", {
        statusCode: 403,
        code: "directory_not_allowed",
      });
    }
    return sendStaticFile(response, targetPath);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Static asset not found.", {
      statusCode: 404,
      code: "static_asset_not_found",
      details: { path: targetPath },
    });
  }
}

export function createApplication(overrides = {}) {
  const config = overrides.config || loadConfig();
  const logger =
    overrides.logger ||
    createLogger({
      level: config.logLevel,
      namespace: "excessland",
    });
  const repository = overrides.repository || createRepository(config, logger);
  const service =
    overrides.service ||
    new RequestService({
      repository,
      logger,
      mode: config.dataMode,
    });
  const adapter = overrides.adapter || new RequestPersistenceAdapter({ service });
  service.config = config;

  async function handler(request, response) {
    const traceId = createTraceId();
    const startedAt = Date.now();
    const url = new URL(
      request.url,
      `http://${request.headers.host || "localhost"}`,
    );
    response.setHeader("x-trace-id", traceId);

    try {
      await routeRequest(adapter, service, request, response, url, traceId);
      logger.info("request.completed", {
        traceId,
        method: request.method,
        path: url.pathname,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const appError = asAppError(error);
      logger.error("request.failed", {
        traceId,
        method: request.method,
        path: url.pathname,
        statusCode: appError.statusCode,
        errorCode: appError.code,
        details: appError.details,
        durationMs: Date.now() - startedAt,
      });
      sendJson(response, appError.statusCode, {
        ok: false,
        error: appError.expose
          ? appError.message
          : "Unexpected server error.",
        errorCode: appError.code,
        details: appError.expose ? appError.details : null,
        legacyError: {
          code: appError.code,
          message: appError.expose
            ? appError.message
            : "Unexpected server error.",
          details: appError.expose ? appError.details : null,
        },
        traceId,
      });
    }
  }

  return {
    config,
    logger,
    repository,
    service,
    adapter,
    handler,
  };
}
