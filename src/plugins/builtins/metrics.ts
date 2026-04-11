import type { LunacordPlugin, PluginContext, PluginMetadata } from "../types";

export const createMetricsPlugin = (
  metadata: Omit<PluginMetadata, "apiVersion">
): LunacordPlugin => {
  const counters = new Map<string, number>();

  return {
    ...metadata,
    apiVersion: "1",
    setup: (context: PluginContext) => {
      context.registerMetric({
        name: "plugin.events.observed",
        description: "Total observed Lunacord events",
        collect: () => [...counters.values()].reduce((total, current) => total + current, 0),
      });
    },
    observe: (event) => {
      counters.set(event.type, (counters.get(event.type) ?? 0) + 1);
    },
  };
};
