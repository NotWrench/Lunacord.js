import { LunacordBaseError } from "./LunacordError";

export type PluginTimeoutErrorCode = "PLUGIN_HOOK_TIMEOUT";

export interface PluginTimeoutErrorContext {
  hook: string;
  pluginName: string;
  timeoutMs: number;
}

export class PluginTimeoutError extends LunacordBaseError<
  PluginTimeoutErrorCode,
  PluginTimeoutErrorContext
> {}
