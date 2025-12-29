export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  userId?: string;
  handle?: string;
  path?: string;
  method?: string;
  durationMs?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

type OutputMode = "json" | "pretty";

class Logger {
  private context: LogContext = {};
  private mode: OutputMode = "json";

  setMode(mode: OutputMode): void {
    this.mode = mode;
  }

  child(context: LogContext): Logger {
    const child = new Logger();
    child.context = { ...this.context, ...context };
    child.mode = this.mode;
    return child;
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  private formatLog(
    level: LogLevel,
    message: string,
    extra?: LogContext,
    error?: Error,
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    const combinedContext = { ...this.context, ...extra };
    if (Object.keys(combinedContext).length > 0) {
      entry.context = combinedContext;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack }),
      };
    }

    return entry;
  }

  private formatPretty(entry: LogEntry): string {
    const levelColors: Record<LogLevel, string> = {
      debug: "\x1b[36m", // cyan
      info: "\x1b[32m", // green
      warn: "\x1b[33m", // yellow
      error: "\x1b[31m", // red
    };
    const reset = "\x1b[0m";
    const dim = "\x1b[2m";

    const color = levelColors[entry.level];
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const time =
      entry.timestamp.split("T")[1]?.replace("Z", "") || entry.timestamp;

    let output = `${dim}${time}${reset} ${color}${levelStr}${reset} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = Object.entries(entry.context)
        .map(
          ([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`,
        )
        .join(" ");
      output += ` ${dim}${contextStr}${reset}`;
    }

    if (entry.error) {
      output += `\n  ${color}${entry.error.name}: ${entry.error.message}${reset}`;
      if (entry.error.stack) {
        const stackLines = entry.error.stack.split("\n").slice(1, 4);
        output += `\n${dim}${stackLines.join("\n")}${reset}`;
      }
    }

    return output;
  }

  private output(entry: LogEntry): void {
    const formatted =
      this.mode === "pretty" ? this.formatPretty(entry) : JSON.stringify(entry);

    switch (entry.level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.output(this.formatLog("debug", message, context));
  }

  info(message: string, context?: LogContext): void {
    this.output(this.formatLog("info", message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.output(this.formatLog("warn", message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : undefined;
    const errContext =
      error && !(error instanceof Error)
        ? { ...context, errorValue: String(error) }
        : context;
    this.output(this.formatLog("error", message, errContext, err));
  }

  startOperation(operation: string, context?: LogContext): () => void {
    const start = Date.now();
    this.info(`${operation} started`, context);

    return () => {
      const durationMs = Date.now() - start;
      this.info(`${operation} completed`, { ...context, durationMs });
    };
  }

  async wrapAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext,
  ): Promise<T> {
    const start = Date.now();
    this.info(`${operation} started`, context);

    try {
      const result = await fn();
      const durationMs = Date.now() - start;
      this.info(`${operation} completed`, { ...context, durationMs });
      return result;
    } catch (error) {
      const durationMs = Date.now() - start;
      this.error(`${operation} failed`, error, { ...context, durationMs });
      throw error;
    }
  }
}

export const logger = new Logger();

export function initLogger(environment: string): void {
  logger.setMode(environment === "production" ? "json" : "pretty");
}

export function createRequestLogger(
  requestId: string,
  path: string,
  method: string,
): Logger {
  return logger.child({ requestId, path, method });
}

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}
