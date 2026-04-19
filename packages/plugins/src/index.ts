// Convenience re-exports of the plugin types / builder / manager from core

export type {
  LunacordPlugin,
  LunacordPluginEvent,
  PluginApiVersion,
  PluginCommand,
  PluginContext,
  PluginDependency,
  PluginErrorEvent,
  PluginHookName,
  PluginHookTimeouts,
  PluginLogger,
  PluginMetadata,
  PluginMetric,
  PluginRestErrorHookContext,
  PluginRestRequestContext,
  PluginRestResponseContext,
  PluginSearchResultContext,
} from "@lunacord/core";
export {
  LUNACORD_PLUGIN_API_VERSION,
  LUNACORD_PLUGIN_SUPPORTED_API_VERSIONS,
  PluginBuilder,
  PluginManager,
} from "@lunacord/core";
export type {
  AutoplayContext,
  AutoplayPluginOptions,
  DebugPluginOptions,
  LoggerPluginOptions,
  StatsReporterPluginOptions,
} from "./builtins";
// Builtins
export {
  createAutoplayPlugin,
  createDebugPlugin,
  createLoggerPlugin,
  createMetricsPlugin,
  createStatsReporterPlugin,
  summarizePluginObserveEvent,
} from "./builtins";
