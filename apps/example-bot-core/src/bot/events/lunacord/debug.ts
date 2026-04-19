import type { LunacordEventHandler } from "../../types";

export const debugEventHandler: LunacordEventHandler = (client) => {
  client.lunacord.on("debug", (event) => {
    const tag = event.nodeId ? `[${event.scope}:${event.nodeId}]` : `[${event.scope}]`;
    console.log(`${tag} ${event.message}`, event.data ?? "");
  });
};
