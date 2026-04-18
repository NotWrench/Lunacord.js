import { describe, expect, it } from "bun:test";
import { createStubWebSocketFactory } from "../src";

describe("createStubWebSocketFactory", () => {
  it("captures sent messages and can trigger lifecycle events", () => {
    const { factory, instances } = createStubWebSocketFactory();
    const ws = factory({
      url: "ws://example/",
      headers: {
        Authorization: "p",
        "User-Id": "u",
        "Num-Shards": "1",
        "Client-Name": "test/1.0.0",
      },
    });

    let opened = false;
    ws.onopen = () => {
      opened = true;
    };
    ws.send(JSON.stringify({ op: "ping" }));

    instances[0]?.triggerOpen();
    expect(opened).toBe(true);
    expect(instances[0]?.sentMessages).toEqual(['{"op":"ping"}']);
  });
});
