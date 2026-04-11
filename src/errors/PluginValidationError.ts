import { LunacordBaseError } from "./LunacordError";

export type PluginValidationErrorCode =
  | "PLUGIN_API_VERSION_UNSUPPORTED"
  | "PLUGIN_DEPENDENCY_MISSING"
  | "PLUGIN_DEPENDENCY_VERSION_MISMATCH"
  | "PLUGIN_DUPLICATE_NAME"
  | "PLUGIN_INVALID_NAME"
  | "PLUGIN_INVALID_VERSION";

export interface PluginValidationErrorContext {
  dependencyName?: string;
  dependencyVersion?: string;
  pluginApiVersion?: string;
  pluginName: string;
  pluginVersion?: string;
}

export class PluginValidationError extends LunacordBaseError<
  PluginValidationErrorCode,
  PluginValidationErrorContext
> {}
