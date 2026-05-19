import { AppError } from "../lib/errors.js";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 1;

function buildDataApiBase(config) {
  const base = config.baseUrl.replace(/\/$/, "");
  return `${base}/fmi/data/${config.apiVersion}/databases/${encodeURIComponent(config.database)}`;
}

function parseDispositionFilename(disposition) {
  if (!disposition) return "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch (error) {
      return utf8Match[1];
    }
  }
  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const plainMatch = disposition.match(/filename=([^;]+)/i);
  return plainMatch?.[1] || "";
}

export class FileMakerDataApiClient {
  constructor(config, options = {}) {
    this.config = config;
    this.sessionToken = "";
    this.logger = options.logger || null;
    this.timeoutMs = Number.isFinite(config.timeoutMs)
      ? Number(config.timeoutMs)
      : DEFAULT_TIMEOUT_MS;
    this.maxRetries = Number.isFinite(config.maxRetries)
      ? Math.max(0, Number(config.maxRetries))
      : DEFAULT_MAX_RETRIES;
  }

  logDiagnostic(level, event, meta = {}) {
    if (!this.logger || typeof this.logger[level] !== "function") return;
    this.logger[level](`filemaker.${event}`, meta);
  }

  hasCredentials() {
    return Boolean(
      this.config.baseUrl &&
      this.config.database &&
      this.config.username &&
      this.config.password,
    );
  }

  getMissingCredentialKeys() {
    const missing = [];
    if (!this.config.baseUrl) missing.push("FILEMAKER_SERVER or FILEMAKER_BASE_URL");
    if (!this.config.database) missing.push("FILEMAKER_DATABASE");
    if (!this.config.username) missing.push("FILEMAKER_USERNAME");
    if (!this.config.password) missing.push("FILEMAKER_PASSWORD");
    return missing;
  }

  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutMs = Number.isFinite(this.timeoutMs)
      ? this.timeoutMs
      : DEFAULT_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const previousTlsSetting = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (this.config.verifySsl === false) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        this.logDiagnostic("warn", "request.timeout", {
          timeoutMs,
        });
        throw new AppError("FileMaker Data API request timed out.", {
          statusCode: 504,
          code: "filemaker_timeout",
          details: {
            timeoutMs,
          },
          expose: true,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (this.config.verifySsl === false) {
        if (previousTlsSetting === undefined) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        } else {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTlsSetting;
        }
      }
    }
  }

  async login() {
    if (!this.hasCredentials()) {
      throw new AppError("FileMaker Data API credentials are incomplete.", {
        statusCode: 503,
        code: "filemaker_config_incomplete",
        details: {
          missing: this.getMissingCredentialKeys(),
        },
        expose: true,
      });
    }

    const endpoint = `${buildDataApiBase(this.config)}/sessions`;
    const response = await this.fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(
          `${this.config.username}:${this.config.password}`,
        ).toString("base64")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const payload = await response.json();
    const token = payload?.response?.token;
    const message = payload?.messages?.[0];

    if (!response.ok || message?.code !== "0" || !token) {
      this.logDiagnostic("error", "auth.failed", {
        responseStatus: response.status,
        dataApiCode: message?.code || "unknown",
      });
      throw new AppError("Unable to authenticate with FileMaker Data API.", {
        statusCode: 502,
        code: "filemaker_auth_failed",
        details: {
          message: message?.message || "Authentication failed",
          code: message?.code || "unknown",
        },
        expose: true,
      });
    }

    this.sessionToken = token;
    this.logDiagnostic("debug", "auth.success", {
      apiVersion: this.config.apiVersion,
      database: this.config.database,
    });
    return token;
  }

  shouldRetry(method, appError, attempt) {
    if (attempt >= this.maxRetries) return false;
    if (String(method).toUpperCase() !== "GET") return false;
    const retryableCodes = new Set([
      "filemaker_timeout",
      "filemaker_request_failed",
    ]);
    if (retryableCodes.has(appError?.code)) return true;
    return false;
  }

  async performWithRetry(method, relativePath, runner) {
    const normalizedMethod = String(method || "GET").toUpperCase();

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await runner();
      } catch (error) {
        if (!(error instanceof AppError) || !this.shouldRetry(normalizedMethod, error, attempt)) {
          throw error;
        }

        this.logDiagnostic("warn", "request.retry", {
          attempt: attempt + 1,
          method: normalizedMethod,
          relativePath,
          errorCode: error.code,
        });
      }
    }

    throw new AppError("FileMaker Data API request failed after retries.", {
      statusCode: 502,
      code: "filemaker_retry_exhausted",
      details: {
        method: normalizedMethod,
        relativePath,
      },
      expose: true,
    });
  }

  async request(method, relativePath, options = {}) {
    return this.performWithRetry(method, relativePath, async () => {
      const token = this.sessionToken || (await this.login());
      const endpoint = `${buildDataApiBase(this.config)}${relativePath}`;
      const headers = {
        authorization: `Bearer ${token}`,
        ...options.headers,
      };

      if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers["content-type"]
      ) {
        headers["content-type"] = "application/json";
      }

      const response = await this.fetchWithTimeout(endpoint, {
        method,
        headers,
        body:
          options.body instanceof FormData || typeof options.body === "string"
            ? options.body
            : options.body
              ? JSON.stringify(options.body)
              : undefined,
      });

      const isJson = response.headers
        .get("content-type")
        ?.includes("application/json");
      const payload = isJson ? await response.json() : await response.text();
      const message = payload?.messages?.[0];

      if (response.status === 401 && this.sessionToken) {
        this.sessionToken = "";
        this.logDiagnostic("warn", "auth.expired", {
          method,
          relativePath,
        });
        return this.request(method, relativePath, options);
      }

      if (!response.ok || (message && message.code !== "0")) {
        const messageText = String(message?.message || "").toLowerCase();
        const isLayoutFailure = messageText.includes("layout") || response.status === 404;
        throw new AppError("FileMaker Data API request failed.", {
          statusCode: isLayoutFailure ? 422 : 502,
          code: isLayoutFailure
            ? "filemaker_layout_not_found"
            : "filemaker_request_failed",
          details: {
            method,
            relativePath,
            responseStatus: response.status,
            message: message?.message || "FileMaker request failed",
            dataApiCode: message?.code || "unknown",
          },
          expose: true,
        });
      }

      return payload;
    });
  }

  async rawRequest(method, relativePath, options = {}) {
    return this.performWithRetry(method, relativePath, async () => {
      const token = this.sessionToken || (await this.login());
      const endpoint = `${buildDataApiBase(this.config)}${relativePath}`;
      const response = await this.fetchWithTimeout(endpoint, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...options.headers,
        },
        body: options.body,
      });

      if (response.status === 401 && this.sessionToken) {
        this.sessionToken = "";
        this.logDiagnostic("warn", "auth.expired", {
          method,
          relativePath,
        });
        return this.rawRequest(method, relativePath, options);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new AppError("FileMaker Data API request failed.", {
          statusCode: 502,
          code: "filemaker_request_failed",
          details: {
            method,
            relativePath,
            responseStatus: response.status,
            payload: errorText,
          },
          expose: true,
        });
      }

      return response;
    });
  }

  async listRecords(layoutName, options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 1;
    const payload = await this.request(
      "GET",
      `/layouts/${encodeURIComponent(layoutName)}/records?_limit=${limit}&_offset=${offset}`,
    );
    return payload.response?.data || [];
  }

  async find(layoutName, query, options = {}) {
    const payload = await this.request(
      "POST",
      `/layouts/${encodeURIComponent(layoutName)}/_find`,
      {
        body: {
          query: Array.isArray(query) ? query : [query],
          limit: String(options.limit || 100),
        },
      },
    );
    return payload.response?.data || [];
  }

  async createRecord(layoutName, body) {
    const payload = await this.request(
      "POST",
      `/layouts/${encodeURIComponent(layoutName)}/records`,
      { body },
    );
    return payload.response;
  }

  async editRecord(layoutName, recordId, body) {
    const payload = await this.request(
      "PATCH",
      `/layouts/${encodeURIComponent(layoutName)}/records/${encodeURIComponent(recordId)}`,
      { body },
    );
    return payload.response;
  }

  async getRecord(layoutName, recordId) {
    const payload = await this.request(
      "GET",
      `/layouts/${encodeURIComponent(layoutName)}/records/${encodeURIComponent(recordId)}`,
    );
    return payload.response?.data?.[0] || null;
  }

  async uploadContainer(layoutName, recordId, fieldName, file) {
    if (!file?.base64) return null;

    const bytes = Buffer.from(file.base64, "base64");
    const formData = new FormData();
    formData.append(
      "upload",
      new Blob([bytes], { type: file.mimeType || "application/octet-stream" }),
      file.name || "attachment",
    );

    return this.request(
      "POST",
      `/layouts/${encodeURIComponent(layoutName)}/records/${encodeURIComponent(recordId)}/containers/${encodeURIComponent(fieldName)}/1`,
      {
        body: formData,
      },
    );
  }

  async downloadContainer(layoutName, recordId, fieldName, repetition = 1) {
    const response = await this.rawRequest(
      "GET",
      `/layouts/${encodeURIComponent(layoutName)}/records/${encodeURIComponent(recordId)}/containers/${encodeURIComponent(fieldName)}/${encodeURIComponent(String(repetition))}`,
    );

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const fileName =
      parseDispositionFilename(response.headers.get("content-disposition")) ||
      `${fieldName}.bin`;
    const bytes = await response.arrayBuffer();

    return {
      fileName,
      contentType,
      body: Buffer.from(bytes),
    };
  }

  async probeConnectivity(layoutName) {
    const startedAt = Date.now();
    if (!this.hasCredentials()) {
      return {
        ok: false,
        configured: false,
        missing: this.getMissingCredentialKeys(),
        elapsedMs: Date.now() - startedAt,
      };
    }

    try {
      await this.listRecords(layoutName, { limit: 1, offset: 1 });
      return {
        ok: true,
        configured: true,
        elapsedMs: Date.now() - startedAt,
      };
    } catch (error) {
      const appError = error instanceof AppError ? error : new AppError("Probe failed.", {
        code: "filemaker_probe_failed",
        statusCode: 502,
        details: {
          message: error instanceof Error ? error.message : String(error),
        },
        expose: true,
      });

      return {
        ok: false,
        configured: true,
        errorCode: appError.code,
        errorMessage: appError.message,
        details: appError.details || null,
        elapsedMs: Date.now() - startedAt,
      };
    }
  }
}
