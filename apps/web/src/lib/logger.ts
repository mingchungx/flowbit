type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LOG_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || "info";

interface LogContext {
  [key: string]: unknown;
}

interface Logger {
  debug: (msg: string, ctx?: LogContext) => void;
  info: (msg: string, ctx?: LogContext) => void;
  warn: (msg: string, ctx?: LogContext) => void;
  error: (msg: string, ctx?: LogContext) => void;
  child: (baseCtx: LogContext) => Logger;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_VALUES[level] >= LEVEL_VALUES[LOG_LEVEL];
}

function emit(level: LogLevel, msg: string, ctx?: LogContext) {
  if (!shouldLog(level)) return;
  const entry = {
    level,
    time: new Date().toISOString(),
    msg,
    ...ctx,
  };
  if (level === "error") {
    process.stderr.write(JSON.stringify(entry) + "\n");
  } else {
    process.stdout.write(JSON.stringify(entry) + "\n");
  }
}

function createLogger(baseCtx?: LogContext): Logger {
  const merge = (ctx?: LogContext) =>
    baseCtx ? { ...baseCtx, ...ctx } : ctx;

  return {
    debug: (msg, ctx?) => emit("debug", msg, merge(ctx)),
    info: (msg, ctx?) => emit("info", msg, merge(ctx)),
    warn: (msg, ctx?) => emit("warn", msg, merge(ctx)),
    error: (msg, ctx?) => emit("error", msg, merge(ctx)),
    child: (childCtx) => createLogger({ ...baseCtx, ...childCtx }),
  };
}

export const logger = createLogger();
