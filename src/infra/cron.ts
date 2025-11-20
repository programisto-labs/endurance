import { enduranceEmitter } from '../core/emitter.js';
import logger from '../core/logger.js';
import pkg from 'node-cron';
const { schedule, validate } = pkg;

interface ScheduledTask {
  stop: () => void;
}

class EnduranceCron {
  private scheduledTasks: Map<string, ScheduledTask> = new Map();

  public loadCronJob(name: string, cronTime: string, taskFunction: () => Promise<void>): void {
    if (!validate(cronTime)) {
      throw new Error('Invalid cron time format');
    }

    const upperName = name.toUpperCase();

    const task = schedule(cronTime, async () => {
      enduranceEmitter.emit(`${upperName}_CRONSTART`);
      try {
        await taskFunction();
      } catch (error) {
        logger.error(`Error executing task for ${upperName}:`, error);
      } finally {
        enduranceEmitter.emit(`${upperName}_CRONEND`);
      }
    });

    this.scheduledTasks.set(upperName, task);
  }
}

export const enduranceCron = new EnduranceCron();
