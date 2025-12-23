/**
 * Structured logging utility for The Wire
 * Outputs JSON logs that are captured by Cloudflare's observability
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  handle?: string;
  path?: string;
  method?: string;
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
  duration?: number;
}

class Logger {
  private context: LogContext = {};

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const child = new Logger();
    child.context = { ...this.context, ...context };
    return child;
  }

  /**
   * Set context for this logger instance
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  private formatLog(level: LogLevel, message: string, extra?: LogContext, error?: Error): LogEntry {
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

  private output(entry: LogEntry): void {
    const json = JSON.stringify(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(json);
        break;
      case 'info':
        console.info(json);
        break;
      case 'warn':
        console.warn(json);
        break;
      case 'error':
        console.error(json);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.output(this.formatLog('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    this.output(this.formatLog('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.output(this.formatLog('warn', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.output(this.formatLog('error', message, context, err));
  }

  /**
   * Log the start of an operation and return a function to log completion
   */
  startOperation(operation: string, context?: LogContext): () => void {
    const start = Date.now();
    this.info(`${operation} started`, context);

    return () => {
      const duration = Date.now() - start;
      this.info(`${operation} completed`, { ...context, durationMs: duration });
    };
  }

  /**
   * Wrap an async function with logging
   */
  async wrapAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const start = Date.now();
    this.info(`${operation} started`, context);

    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.info(`${operation} completed`, { ...context, durationMs: duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${operation} failed`, error, { ...context, durationMs: duration });
      throw error;
    }
  }
}

// Singleton instance
export const logger = new Logger();

// Helper to create request-scoped logger
export function createRequestLogger(requestId: string, path: string, method: string): Logger {
  return logger.child({ requestId, path, method });
}

// Generate a unique request ID
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}
