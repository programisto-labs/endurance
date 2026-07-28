import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import type { Logger as PinoLogger, LogFn } from 'pino';

import type { PinoLogMethodHook, PinoRemoteLogSinkAdapter } from './pino-remote-log-sink.port.js';
import {
    isPostHogLogsEnabled,
    mapPinoArgsToOtelLogRecord,
    postHogIngestLogsUrl,
    postHogLogsServiceName,
    resolvePostHogMinPinoLevel
} from './posthog-log.mapper.js';

/**
 * Adapter: bridges Endurance’s Pino logging surface to PostHog Logs (OTLP/HTTP).
 * Config is env-only so consuming apps do not register anything beyond `.env`.
 */
export class PostHogLogsAdapter implements PinoRemoteLogSinkAdapter {
    private provider: LoggerProvider | null = null;
    private otelLogger: ReturnType<typeof logs.getLogger> | null = null;
    private pipelineStarted = false;
    private shutdownHandlersRegistered = false;

    isEnabled (): boolean {
        return isPostHogLogsEnabled();
    }

    private registerShutdownHandlers (): void {
        if (this.shutdownHandlersRegistered) return;
        this.shutdownHandlersRegistered = true;
        const flush = (): void => {
            if (this.provider) {
                this.provider.shutdown().catch(() => {});
            }
        };
        process.once('SIGTERM', flush);
        process.once('SIGINT', flush);
        process.once('beforeExit', flush);
    }

    /** Idempotent — starts OpenTelemetry LoggerProvider + PostHog OTLP exporter (logs only, no traces). */
    ensurePipelineStarted (): void {
        if (this.pipelineStarted) return;
        if (!this.isEnabled()) return;

        const apiKey = process.env.POSTHOG_API_KEY!.trim();
        const exporter = new OTLPLogExporter({
            url: postHogIngestLogsUrl(),
            headers: {
                Authorization: `Bearer ${apiKey}`
            }
        });

        const processor = new BatchLogRecordProcessor(exporter);
        const resource = new Resource({
            'service.name': postHogLogsServiceName()
        });

        this.provider = new LoggerProvider({
            resource,
            mergeResourceWithDefaults: true
        });
        this.provider.addLogRecordProcessor(processor);
        logs.setGlobalLoggerProvider(this.provider);
        this.otelLogger = logs.getLogger('endurance');

        this.pipelineStarted = true;
        this.registerShutdownHandlers();
    }

    forwardPinoLog (level: number, args: unknown[]): void {
        if (!this.otelLogger) return;
        const min = resolvePostHogMinPinoLevel();
        if (level < min) return;
        const record = mapPinoArgsToOtelLogRecord(level, args);
        if (record) {
            this.otelLogger.emit(record);
        }
    }

    /**
     * Pino `hooks.logMethod`: forwards to PostHog, then delegates to Pino so transports still run.
     */
    createPinoLogMethodHook (): PinoLogMethodHook | undefined {
        if (!this.isEnabled()) return undefined;
        this.ensurePipelineStarted();
        const sink = this;
        return function postHogPinoHook (this: PinoLogger, args: Parameters<LogFn>, method: LogFn, level: number) {
            try {
                sink.forwardPinoLog(level, args as unknown[]);
            } catch {
                // never break local logging
            }
            method.apply(this, args);
        };
    }
}

const defaultAdapter = new PostHogLogsAdapter();

/** Factory used by `core/logger` — single shared adapter instance per process. */
export function createPostHogPinoLogMethodHook (): PinoLogMethodHook | undefined {
    return defaultAdapter.createPinoLogMethodHook();
}
