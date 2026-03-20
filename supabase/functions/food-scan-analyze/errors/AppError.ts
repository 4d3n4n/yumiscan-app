import { ErrorCode, ERROR_HTTP_STATUS, ERROR_USER_MESSAGES } from "./codes.ts";

/**
 * Custom error class for the YumiScan Edge Function.
 * Provides structured error handling with codes, HTTP status, and user-friendly messages.
 */
export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly httpStatus: number;
    public readonly userMessage: string;
    public readonly internalMessage: string;

    constructor(
        code: ErrorCode,
        internalMessage?: string,
        overrideUserMessage?: string
    ) {
        const userMessage = overrideUserMessage ?? ERROR_USER_MESSAGES[code];
        super(userMessage);

        this.name = "AppError";
        this.code = code;
        this.httpStatus = ERROR_HTTP_STATUS[code];
        this.userMessage = userMessage;
        this.internalMessage = internalMessage ?? userMessage;
    }

    /**
     * Convert to JSON response format.
     */
    toJSON(): { error: string; code: ErrorCode } {
        return {
            error: this.userMessage,
            code: this.code,
        };
    }

    /**
     * Create a Response object for this error.
     */
    toResponse(corsHeaders: HeadersInit): Response {
        return new Response(
            JSON.stringify(this.toJSON()),
            {
                status: this.httpStatus,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }

    /**
     * Wrap an unknown error into an AppError.
     */
    static from(error: unknown): AppError {
        if (error instanceof AppError) {
            return error;
        }

        const message = error instanceof Error ? error.message : String(error);

        // Map known error messages to specific codes
        if (message.includes("Authorization") || message.includes("token") || message.includes("authenticated")) {
            return new AppError(ErrorCode.NOT_AUTHENTICATED, message);
        }
        if (message.includes("pass")) {
            return new AppError(ErrorCode.NO_ACTIVE_PASS, message);
        }
        if (message.includes("payload") || message.includes("Invalid JSON")) {
            return new AppError(ErrorCode.INVALID_PAYLOAD, message);
        }
        if (message.includes("IMAGE_NOT_INGREDIENTS")) {
            return new AppError(ErrorCode.NOT_INGREDIENTS_IMAGE, message);
        }
        if (message.includes("No text") || message.includes("no text") || message.includes("NO_TEXT")) {
            return new AppError(ErrorCode.NO_TEXT_IN_IMAGE, message);
        }

        return new AppError(ErrorCode.INTERNAL_ERROR, message);
    }
}
