import {
  LUNACORD_PLUGIN_API_VERSION,
  type LunacordPlugin,
  type PluginContext,
  type PluginMetadata,
} from "../types";

export interface LoggerPluginOptions {
  includeEvents?: readonly string[];
}

export const createLoggerPlugin = (
  metadata: Omit<PluginMetadata, "apiVersion">,
  options: LoggerPluginOptions = {}
): LunacordPlugin => ({
  ...metadata,
  apiVersion: LUNACORD_PLUGIN_API_VERSION,
  observe: (event, context: PluginContext) => {
    if (options.includeEvents && !options.includeEvents.includes(event.type)) {
      return;
    }

    context.logger.debug(`Observed ${event.type}`, event);
  },
});
