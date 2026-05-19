import { AppError } from "../lib/errors.js";

function isFallbackEligibleError(error) {
  if (!(error instanceof AppError)) return false;
  if (String(error.code || "").startsWith("filemaker_")) return true;
  return [502, 503, 504].includes(Number(error.statusCode || 0));
}

export class FallbackRequestRepository {
  constructor(options) {
    this.primary = options.primary;
    this.fallback = options.fallback;
    this.logger = options.logger || null;
    this.enableFallback = Boolean(options.enableFallback);
    this.requestedMode = options.requestedMode || "filemaker";
    this.fallbackActive = false;
    this.fallbackReason = null;
  }

  getRuntimeMode() {
    return this.fallbackActive ? "mock" : this.requestedMode;
  }

  activateFallback(reason) {
    if (this.fallbackActive) return;
    this.fallbackActive = true;
    this.fallbackReason = {
      at: new Date().toISOString(),
      operation: reason.operation,
      errorCode: reason.errorCode,
      message: reason.message,
    };

    if (this.logger?.warn) {
      this.logger.warn("repository.fallback.activated", {
        operation: reason.operation,
        errorCode: reason.errorCode,
      });
    }
  }

  async runOperation(operation, args = []) {
    if (this.fallbackActive) {
      return this.fallback[operation](...args);
    }

    try {
      return await this.primary[operation](...args);
    } catch (error) {
      if (!this.enableFallback || !isFallbackEligibleError(error)) {
        throw error;
      }

      this.activateFallback({
        operation,
        errorCode: error.code || "unknown",
        message: error.message,
      });
      return this.fallback[operation](...args);
    }
  }

  async list() {
    return this.runOperation("list");
  }

  async getById(id) {
    return this.runOperation("getById", [id]);
  }

  async save(request) {
    return this.runOperation("save", [request]);
  }

  async listParentRecords() {
    return this.runOperation("listParentRecords");
  }

  async downloadDocument(requestId, kind) {
    return this.runOperation("downloadDocument", [requestId, kind]);
  }

  getContainerMapping() {
    const mapping =
      this.fallbackActive && typeof this.fallback.getContainerMapping === "function"
        ? this.fallback.getContainerMapping()
        : typeof this.primary.getContainerMapping === "function"
          ? this.primary.getContainerMapping()
          : {};
    return {
      ...mapping,
    };
  }

  async getStatus() {
    const primaryStatus =
      typeof this.primary.getStatus === "function"
        ? await this.primary.getStatus()
        : { mode: this.requestedMode, ready: true };

    if (!this.fallbackActive && this.enableFallback && primaryStatus.ready === false) {
      this.activateFallback({
        operation: "health",
        errorCode: primaryStatus.errorCode || "filemaker_unavailable",
        message: primaryStatus.errorMessage || "FileMaker unavailable",
      });
    }

    const fallbackStatus =
      typeof this.fallback.getStatus === "function"
        ? await this.fallback.getStatus()
        : { mode: "mock", ready: true };

    const activeMode = this.getRuntimeMode();
    const ready = this.fallbackActive ? fallbackStatus.ready : primaryStatus.ready;

    return {
      mode: activeMode,
      ready,
      fallback: {
        allowed: this.enableFallback,
        active: this.fallbackActive,
        reason: this.fallbackReason,
      },
      filemaker: {
        ...(primaryStatus.filemaker || {}),
      },
      mock: {
        ...(fallbackStatus.mock || {}),
      },
    };
  }
}
