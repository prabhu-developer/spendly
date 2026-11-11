/**
 * Structured server logging. Emits single-line JSON so hosting log drains
 * (Netlify, Datadog, etc.) can index and alert on it. Swap `report` for an
 * error-monitoring SDK (e.g. Sentry.captureException) when one is configured.
 */
type Fields = Record<string, unknown>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function emit(level: "info" | "warn" | "error", event: string, fields: Fields) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function logInfo(event: string, fields: Fields = {}) {
  emit("info", event, fields);
}

export function logWarn(event: string, fields: Fields = {}) {
  emit("warn", event, fields);
}

export function logError(event: string, error: unknown, fields: Fields = {}) {
  emit("error", event, { ...fields, error: serializeError(error) });
}
