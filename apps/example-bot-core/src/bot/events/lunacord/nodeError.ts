import type { LunacordEventHandler } from "../../types";

export const nodeErrorEventHandler: LunacordEventHandler = (client) => {
  client.lunacord.on("nodeError", ({ node, message }) => {
    console.error(`[node:${node.id}] ${message}`);
  });
};
