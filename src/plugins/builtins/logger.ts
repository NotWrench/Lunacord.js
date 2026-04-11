import type { LunacordPlugin, PluginContext, PluginMetadata } from "../types";

export interface LoggerPluginOptions {
  includeEvents?: readonly string[];
}

export const createLoggerPlugin = (
  metadata: Omit<PluginMetadata, "apiVersion">,
  options: LoggerPluginOptions = {}
): LunacordPlugin => ({
  ...metadata,
  apiVersion: "1",
  observe: (event, context: PluginContext) => {
    if (options.includeEvents && !options.includeEvents.includes(event.type)) {
      return;
    }

    context.logger.debug(`Observed ${event.type}`, event);
  },
});
