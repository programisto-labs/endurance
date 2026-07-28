import { SeverityNumber, type LogRecord } from '@opentelemetry/api-logs';

const MAX_BODY_CHARS = 32_768;
const MAX_ATTR_CHARS = 4096;

const PINO_LEVEL_NAMES: Record<string, number> = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60
};

export function isPostHogLogsEnabled (): boolean {
    return process.env.POSTHOG_LOGS_ENABLED === 'true' &&
        Boolean(process.env.POSTHOG_API_KEY?.trim());
}

export function postHogIngestLogsUrl (): string {
    const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';
    const host = (process.env.POSTHOG_HOST || DEFAULT_POSTHOG_HOST).replace(/\/$/, '');
    return `${host}/i/v1/logs`;
}

export function postHogLogsServiceName (): string {
    return (
        process.env.POSTHOG_LOGS_SERVICE_NAME?.trim() ||
        process.env.npm_package_name ||
        'endurance'
    );
}

export function resolvePostHogMinPinoLevel (): number {
    const raw = process.env.POSTHOG_LOGS_MIN_LEVEL?.trim();
    if (raw) {
        const n = Number(raw);
        if (!Number.isNaN(n)) return n;
    }
    const logLevel = (process.env.LOG_LEVEL || 'info').trim().toLowerCase();
    return PINO_LEVEL_NAMES[logLevel] ?? 30;
}

export function mapPinoLevelToOtel (level: number): { severityNumber: SeverityNumber; severityText: string } {
    if (level >= 60) return { severityNumber: SeverityNumber.FATAL, severityText: 'fatal' };
    if (level >= 50) return { severityNumber: SeverityNumber.ERROR, severityText: 'error' };
    if (level >= 40) return { severityNumber: SeverityNumber.WARN, severityText: 'warn' };
    if (level >= 30) return { severityNumber: SeverityNumber.INFO, severityText: 'info' };
    if (level >= 20) return { severityNumber: SeverityNumber.DEBUG, severityText: 'debug' };
    return { severityNumber: SeverityNumber.TRACE, severityText: 'trace' };
}

function truncate (s: string, max: number): string {
    if (s.length <= max) return s;
    return `${s.slice(0, max)}…[truncated]`;
}

function serializeErrorLike (err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
        return {
            message: err.message,
            stack: err.stack,
            name: err.name,
            ...Object.getOwnPropertyNames(err).reduce<Record<string, unknown>>((acc, key) => {
                if (key !== 'message' && key !== 'stack' && key !== 'name') {
                    acc[key] = (err as unknown as Record<string, unknown>)[key];
                }
                return acc;
            }, {})
        };
    }
    return { value: err };
}

function safeStringify (val: unknown): string {
    const seen = new WeakSet<object>();
    try {
        return JSON.stringify(val, (_key, value) => {
            if (typeof value === 'bigint') return value.toString();
            if (value instanceof Error) return serializeErrorLike(value);
            if (value !== null && typeof value === 'object') {
                if (seen.has(value as object)) return '[Circular]';
                seen.add(value as object);
            }
            return value;
        });
    } catch {
        return '[Unserializable]';
    }
}

/** Maps Pino `logMethod` arguments to an OpenTelemetry log record for PostHog. */
export function mapPinoArgsToOtelLogRecord (level: number, args: unknown[]): LogRecord | null {
    if (args.length === 0) return null;

    const { severityNumber, severityText } = mapPinoLevelToOtel(level);
    const attributes: Record<string, string> = {
        'pino.level': String(level)
    };

    let body: string;

    if (args.length === 1) {
        const a = args[0];
        if (typeof a === 'string') {
            body = truncate(a, MAX_BODY_CHARS);
        } else if (a !== null && typeof a === 'object' && !Array.isArray(a)) {
            const o = a as Record<string, unknown>;
            if (typeof o.msg === 'string') {
                body = truncate(o.msg, MAX_BODY_CHARS);
            } else {
                body = truncate(safeStringify(a), MAX_BODY_CHARS);
            }
            if (o.err !== undefined) {
                attributes.error = truncate(safeStringify(serializeErrorLike(o.err)), MAX_ATTR_CHARS);
            }
            if (typeof o.caller === 'string') {
                attributes.caller = truncate(o.caller, MAX_ATTR_CHARS);
            }
        } else {
            body = truncate(safeStringify(a), MAX_BODY_CHARS);
        }
    } else {
        body = truncate(
            args
                .map((x) => (typeof x === 'object' ? safeStringify(x) : String(x)))
                .join(' '),
            MAX_BODY_CHARS
        );
    }

    return {
        severityNumber,
        severityText,
        body,
        attributes
    };
}
