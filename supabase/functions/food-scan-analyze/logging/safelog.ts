/**
 * Safe logging utilities.
 * Logs structured data without exposing sensitive information.
 */

const SENSITIVE_PATTERNS = [
    /key/i,
    /token/i,
    /password/i,
    /secret/i,
    /authorization/i,
    /cookie/i,
];

/**
 * Redact sensitive fields from an object.
 */
export function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(key))) {
            result[key] = "[REDACTED]";
        } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            result[key] = redactSensitive(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Create a safe log entry.
 */
export function safeLog(
    level: "info" | "warn" | "error",
    message: string,
    context?: Record<string, unknown>
): void {
    const timestamp = new Date().toISOString();
    const prefix = `[food-scan-analyze] [${level.toUpperCase()}]`;

    const safeContext = context ? redactSensitive(context) : undefined;

    const logFn = level === "error" ? console.error : level === "warn" ? console.warn : console.info;

    if (safeContext) {
        logFn(`${timestamp} ${prefix} ${message}`, JSON.stringify(safeContext));
    } else {
        logFn(`${timestamp} ${prefix} ${message}`);
    }
}

/**
 * Log info message.
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
    safeLog("info", message, context);
}

/**
 * Log warning message.
 */
export function logWarn(message: string, context?: Record<string, unknown>): void {
    safeLog("warn", message, context);
}

/**
 * Log error message.
 */
export function logError(message: string, context?: Record<string, unknown>): void {
    safeLog("error", message, context);
}
