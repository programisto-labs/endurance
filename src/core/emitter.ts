import { EventEmitter } from 'events';

interface EventTypes {
  [key: string]: string;
}

type AnyListener = (eventName: string | symbol, ...args: unknown[]) => void;

class EnduranceEventEmitter extends EventEmitter {
  private anyListeners: AnyListener[] = [];

  public onAny(callback: AnyListener): void {
    this.anyListeners.push(callback);
  }

  public offAny(callback: AnyListener): void {
    const index = this.anyListeners.indexOf(callback);
    if (index !== -1) {
      this.anyListeners.splice(index, 1);
    }
  }

  public emit(eventName: string | symbol, ...args: unknown[]): boolean {
    this.anyListeners.forEach((callback) => {
      callback(eventName, ...args);
    });
    return super.emit(eventName, ...args);
  }
}

const createEmitter = (): {
  emitter: EnduranceEventEmitter;
  eventTypes: EventTypes;
} => {
  const emitter = new EnduranceEventEmitter();

  const eventTypes: EventTypes = {};

  const eventTypesProxy = new Proxy(eventTypes, {
    get: (target, name: string) => {
      const upperName = name.toUpperCase();
      if (!(upperName in target)) {
        target[upperName] = upperName;
      }
      return target[upperName];
    }
  });

  return { emitter, eventTypes: eventTypesProxy };
};

const emitterInstance = createEmitter();

export const enduranceEmitter = emitterInstance.emitter;
export const enduranceEventTypes = emitterInstance.eventTypes;
