type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private formatMessage(entry: LogEntry): string {
    const { level, message, timestamp, context, error } = entry;
    let formatted = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    if (context && Object.keys(context).length > 0) {
      formatted += ` | Context: ${JSON.stringify(context)}`;
    }
    
    if (error) {
      formatted += ` | Error: ${error.message}`;
      if (this.isDevelopment && error.stack) {
        formatted += `\nStack: ${error.stack}`;
      }
    }
    
    return formatted;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error
    };

    // In development, always log to console
    if (this.isDevelopment) {
      const formatted = this.formatMessage(entry);
      
      switch (level) {
        case 'debug':
          console.log(formatted);
          break;
        case 'info':
          console.info(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'error':
          console.error(formatted);
          break;
      }
    } else {
      // In production, only log warnings and errors to console
      // This ensures Vercel/NextJS can capture important logs
      if (level === 'warn' || level === 'error') {
        const formatted = this.formatMessage(entry);
        
        if (level === 'warn') {
          console.warn(formatted);
        } else {
          console.error(formatted);
        }
      }
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>, error?: Error): void {
    this.log('warn', message, context, error);
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log('error', message, context, error);
  }

  // Helper method for API routes to log request/response info
  apiLog(method: string, path: string, status: number, duration?: number, context?: Record<string, any>): void {
    const message = `${method} ${path} - ${status}`;
    const logContext = {
      method,
      path,
      status,
      ...(duration && { duration: `${duration}ms` }),
      ...context
    };

    if (status >= 400) {
      this.error(message, logContext);
    } else if (status >= 300) {
      this.warn(message, logContext);
    } else {
      this.info(message, logContext);
    }
  }
}

// Export a singleton instance
export const logger = new Logger();

// Export the Logger class for testing or custom instances
export { Logger };
export type { LogLevel, LogEntry };