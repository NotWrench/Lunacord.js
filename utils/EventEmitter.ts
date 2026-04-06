// utils/EventEmitter.ts

type Listener<T> = (data: T) => void;

export class TypedEventEmitter<TEvents extends { [K in keyof TEvents]: TEvents[K] }> {
  private readonly listeners = new Map<keyof TEvents, Set<Listener<never>>>();

  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): this {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as Listener<never>);
    this.listeners.set(event, set);
    return this;
  }

  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): this {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as Listener<never>);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): boolean {
    const set = this.listeners.get(event);
    if (!set) {
      return false;
    }
    for (const listener of [...set]) {
      (listener as Listener<TEvents[K]>)(data);
    }
    return set.size > 0;
  }

  listenerCount<K extends keyof TEvents>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  once<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): this {
    const wrapper: Listener<TEvents[K]> = (data) => {
      this.off(event, wrapper);
      listener(data);
    };
    this.on(event, wrapper);
    return this;
  }

  removeAllListeners<K extends keyof TEvents>(event?: K): this {
    if (event === undefined) {
      this.listeners.clear();
    } else {
      this.listeners.delete(event);
    }
    return this;
  }
}

export default TypedEventEmitter;
