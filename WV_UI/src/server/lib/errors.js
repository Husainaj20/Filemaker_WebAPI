export class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = options.statusCode || 500;
    this.code = options.code || "internal_error";
    this.details = options.details || null;
    this.expose = options.expose ?? this.statusCode < 500;
  }
}

export function asAppError(error, fallbackMessage = "Unexpected server error") {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError(fallbackMessage, {
    statusCode: 500,
    code: "internal_error",
    details: {
      originalMessage: error instanceof Error ? error.message : String(error)
    },
    expose: false
  });
}
