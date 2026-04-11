import {
  LUNACORD_PLUGIN_API_VERSION,
  type LunacordPlugin,
  type PluginContext,
  type PluginMetadata,
} from "../types";

export const createMetricsPlugin = (
  metadata: Omit<PluginMetadata, "apiVersion">
): LunacordPlugin => {
  const counters = new Map<string, number>();

  return {
    ...metadata,
    apiVersion: LUNACORD_PLUGIN_API_VERSION,
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
