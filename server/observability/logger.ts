type LogLevel = "debug" | "info" | "warn" | "error";

function writeLog(level: LogLevel, event: string, payload: Record<string, unknown> = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function createLogger(bindings: Record<string, unknown> = {}) {
  return {
    debug: (event: string, payload?: Record<string, unknown>) => writeLog("debug", event, { ...bindings, ...payload }),
    info: (event: string, payload?: Record<string, unknown>) => writeLog("info", event, { ...bindings, ...payload }),
    warn: (event: string, payload?: Record<string, unknown>) => writeLog("warn", event, { ...bindings, ...payload }),
    error: (event: string, payload?: Record<string, unknown>) => writeLog("error", event, { ...bindings, ...payload }),
  };
}
