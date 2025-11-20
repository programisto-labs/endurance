import { jest } from '@jest/globals';
import type { ScheduledTask } from 'node-cron';

const mockValidate = jest.fn();
const mockSchedule = jest.fn();
const mockEmit = jest.fn();

jest.unstable_mockModule('node-cron', () => ({
  default: {
    validate: mockValidate,
    schedule: mockSchedule
  }
}));

jest.unstable_mockModule('../src/core/emitter', () => ({
  enduranceEmitter: {
    emit: mockEmit
  }
}));

const cronModule = await import('../src/infra/cron');
const enduranceCron = cronModule.enduranceCron;

const mockScheduledTask = {
  start: jest.fn(),
  stop: jest.fn(),
  now: jest.fn()
} as unknown as ScheduledTask;

describe('EnduranceCron', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw on invalid cron', () => {
    mockValidate.mockReturnValue(false);
    expect(() =>
      enduranceCron.loadCronJob('fail', 'bad', async () => { })
    ).toThrow('Invalid cron time format');
  });

  it('should run and emit events', async () => {
    mockValidate.mockReturnValue(true);
    let capturedFn: () => Promise<void> = async () => { };

    mockSchedule.mockImplementation((_, fn) => {
      capturedFn = fn as () => Promise<void>;
      return mockScheduledTask;
    });

    const job = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    enduranceCron.loadCronJob('run', '* * * * *', job);
    await capturedFn();

    expect(mockEmit).toHaveBeenCalledWith('RUN_CRONSTART');
    expect(job).toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith('RUN_CRONEND');
  });

  it('should handle error in job and still emit end', async () => {
    mockValidate.mockReturnValue(true);
    let capturedFn: () => Promise<void> = async () => { };

    mockSchedule.mockImplementation((_, fn) => {
      capturedFn = fn as () => Promise<void>;
      return mockScheduledTask;
    });

    const job = jest
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('Fail'));
    enduranceCron.loadCronJob('failjob', '* * * * *', job);
    await capturedFn();

    expect(mockEmit).toHaveBeenCalledWith('FAILJOB_CRONSTART');
    expect(mockEmit).toHaveBeenCalledWith('FAILJOB_CRONEND');
  });
});
