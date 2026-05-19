const LEVELS = ["debug", "info", "warn", "error"];

export function createLogger(options = {}) {
  const level = options.level || "info";
  const namespace = options.namespace || "excessland";
  const threshold = LEVELS.indexOf(level);

  function write(kind, event, meta = {}) {
    if (LEVELS.indexOf(kind) < threshold) return;

    const payload = {
      ts: new Date().toISOString(),
      level: kind,
      namespace,
      event,
      ...meta
    };

    const line = JSON.stringify(payload);
    if (kind === "error") {
      console.error(line);
      return;
    }

    if (kind === "warn") {
      console.warn(line);
      return;
    }

    console.log(line);
  }

  return {
    debug: (event, meta) => write("debug", event, meta),
    info: (event, meta) => write("info", event, meta),
    warn: (event, meta) => write("warn", event, meta),
    error: (event, meta) => write("error", event, meta)
  };
}
