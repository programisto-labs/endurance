import type { Logger as PinoLogger, LogFn } from 'pino';

/** Hook shape required by Pino v9 (`hooks.logMethod`). */
export type PinoLogMethodHook = (
    this: PinoLogger,
    args: Parameters<LogFn>,
    method: LogFn,
    level: number
) => void;

/**
 * Port for optional remote log sinks (PostHog, future vendors).
 * Implementations adapt framework logging to an external API without coupling `core/logger` to vendors.
 */
export interface PinoRemoteLogSinkAdapter {
    isEnabled (): boolean;
    createPinoLogMethodHook (): PinoLogMethodHook | undefined;
}
