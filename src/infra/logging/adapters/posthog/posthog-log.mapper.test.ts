import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { LogFn, Logger } from 'pino';

describe('posthog-log.mapper', () => {
    const envSnapshot: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const key of [
            'POSTHOG_LOGS_ENABLED',
            'POSTHOG_API_KEY',
            'POSTHOG_HOST',
            'POSTHOG_LOGS_SERVICE_NAME',
            'POSTHOG_LOGS_MIN_LEVEL',
            'LOG_LEVEL',
            'npm_package_name'
        ]) {
            envSnapshot[key] = process.env[key];
            delete process.env[key];
        }
        jest.resetModules();
    });

    afterEach(() => {
        for (const [key, val] of Object.entries(envSnapshot)) {
            if (val === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = val;
            }
        }
    });

    it('isPostHogLogsEnabled is false without flag', async () => {
        process.env.POSTHOG_API_KEY = 'phc_x';
        const { isPostHogLogsEnabled } = await import('./posthog-log.mapper.js');
        expect(isPostHogLogsEnabled()).toBe(false);
    });

    it('isPostHogLogsEnabled is false without API key', async () => {
        process.env.POSTHOG_LOGS_ENABLED = 'true';
        const { isPostHogLogsEnabled } = await import('./posthog-log.mapper.js');
        expect(isPostHogLogsEnabled()).toBe(false);
    });

    it('isPostHogLogsEnabled is true when flag and key are set', async () => {
        process.env.POSTHOG_LOGS_ENABLED = 'true';
        process.env.POSTHOG_API_KEY = 'phc_test_123';
        const { isPostHogLogsEnabled } = await import('./posthog-log.mapper.js');
        expect(isPostHogLogsEnabled()).toBe(true);
    });

    it('resolvePostHogMinPinoLevel uses POSTHOG_LOGS_MIN_LEVEL when set', async () => {
        process.env.POSTHOG_LOGS_MIN_LEVEL = '40';
        const { resolvePostHogMinPinoLevel } = await import('./posthog-log.mapper.js');
        expect(resolvePostHogMinPinoLevel()).toBe(40);
    });

    it('resolvePostHogMinPinoLevel falls back to LOG_LEVEL name', async () => {
        process.env.LOG_LEVEL = 'warn';
        const { resolvePostHogMinPinoLevel } = await import('./posthog-log.mapper.js');
        expect(resolvePostHogMinPinoLevel()).toBe(40);
    });

    it('mapPinoLevelToOtel maps info level', async () => {
        const { mapPinoLevelToOtel } = await import('./posthog-log.mapper.js');
        const { SeverityNumber } = await import('@opentelemetry/api-logs');
        expect(mapPinoLevelToOtel(30)).toEqual({
            severityNumber: SeverityNumber.INFO,
            severityText: 'info'
        });
    });

    it('mapPinoArgsToOtelLogRecord handles string message', async () => {
        const { mapPinoArgsToOtelLogRecord } = await import('./posthog-log.mapper.js');
        const rec = mapPinoArgsToOtelLogRecord(30, ['hello']);
        expect(rec?.body).toBe('hello');
        expect(rec?.severityText).toBe('info');
    });

    it('mapPinoArgsToOtelLogRecord uses msg and err from object', async () => {
        const { mapPinoArgsToOtelLogRecord } = await import('./posthog-log.mapper.js');
        const err = new Error('boom');
        const rec = mapPinoArgsToOtelLogRecord(50, [{ msg: 'failed', err }]);
        expect(rec?.body).toBe('failed');
        expect(rec?.severityText).toBe('error');
        expect(rec?.attributes?.error).toContain('boom');
    });
});

describe('PostHogLogsAdapter', () => {
    const envSnapshot: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const key of ['POSTHOG_LOGS_ENABLED', 'POSTHOG_API_KEY']) {
            envSnapshot[key] = process.env[key];
            delete process.env[key];
        }
        jest.resetModules();
    });

    afterEach(() => {
        for (const [key, val] of Object.entries(envSnapshot)) {
            if (val === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = val;
            }
        }
    });

    it('createPostHogPinoLogMethodHook returns undefined when disabled', async () => {
        const { createPostHogPinoLogMethodHook } = await import('./posthog-logs.adapter.js');
        expect(createPostHogPinoLogMethodHook()).toBeUndefined();
    });

    it('createPostHogPinoLogMethodHook calls method.apply for pino', async () => {
        process.env.POSTHOG_LOGS_ENABLED = 'true';
        process.env.POSTHOG_API_KEY = 'phc_test_key';
        const { createPostHogPinoLogMethodHook } = await import('./posthog-logs.adapter.js');
        const hook = createPostHogPinoLogMethodHook();
        expect(hook).toBeDefined();
        const method = jest.fn() as unknown as LogFn;
        const self = { x: 1 } as unknown as Logger;
        hook!.call(self, ['hello'] as Parameters<LogFn>, method, 30);
        expect(method).toHaveBeenCalledTimes(1);
        expect(method).toHaveBeenCalledWith('hello');
    });
});
