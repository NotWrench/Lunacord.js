import { describe, expect, it } from "bun:test";
import { TypedEventEmitter } from "@lunacord/core";

interface TestEvents {
  value: { count: number };
}

describe("TypedEventEmitter", () => {
  it("should return whether listeners were called", () => {
    const emitter = new TypedEventEmitter<TestEvents>();

    expect(emitter.emit("value", { count: 1 })).toBe(false);

    emitter.on("value", () => {});

    expect(emitter.emit("value", { count: 2 })).toBe(true);
  });

  it("should report listenerCount", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = () => {};

    emitter.on("value", listener);
    emitter.on("value", () => {});

    expect(emitter.listenerCount("value")).toBe(2);

    emitter.off("value", listener);

    expect(emitter.listenerCount("value")).toBe(1);
  });
});
