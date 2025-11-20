import { enduranceEmitter } from './emitter.js';

type EventCallback = (...args: unknown[]) => void;

class EnduranceEventListener {
  public createListener(eventName: string, callback: EventCallback): void {
    const upperEventName = eventName.toUpperCase();
    enduranceEmitter.on(upperEventName, callback);
  }

  public removeListener(eventName: string, callback: EventCallback): void {
    const upperEventName = eventName.toUpperCase();
    enduranceEmitter.off(upperEventName, callback);
  }

  public onceListener(eventName: string, callback: EventCallback): void {
    const upperEventName = eventName.toUpperCase();
    enduranceEmitter.once(upperEventName, callback);
  }

  public createAnyListener(callback: EventCallback): void {
    enduranceEmitter.onAny(callback);
  }

  public removeAnyListener(callback: EventCallback): void {
    enduranceEmitter.offAny(callback);
  }
}

export const enduranceListener = new EnduranceEventListener();
