import {
  type DebugEvent,
  LUNACORD_PLUGIN_API_VERSION,
  type LunacordPlugin,
  type PluginMetadata,
} from "@lunacord/core";

export interface DebugPluginOptions {
  /** Optional custom printer. Defaults to `console.debug`. */
  print?: (event: DebugEvent) => void;
  /** Filter by scope. Default: all scopes. */
  scopes?: readonly DebugEvent["scope"][];
}

/**
 * Pretty-prints every unified `debug` event Lunacord emits. Useful during development.
 * In production, subscribe to `lunacord.on("debug", ...)` directly and ship to your logger.
 */
export const createDebugPlugin = (
  metadata: Omit<PluginMetadata, "apiVersion">,
  options: DebugPluginOptions = {}
): LunacordPlugin => {
  const scopeAllowlist = options.scopes ? new Set(options.scopes) : null;
  const print =
    options.print ??
    ((event: DebugEvent): void => {
      const prefix = event.nodeId ? `[${event.scope}:${event.nodeId}]` : `[${event.scope}]`;
      // This plugin's whole purpose is to print debug events to the user's console.
      const log = (globalThis as { console?: { debug?: (...args: unknown[]) => void } }).console;
      log?.debug?.(prefix, event.message, event.data ?? "");
    });

  return {
    ...metadata,
    apiVersion: LUNACORD_PLUGIN_API_VERSION,
    setup: (ctx) => {
      ctx.events.on("debug", (event: DebugEvent) => {
        if (scopeAllowlist && !scopeAllowlist.has(event.scope)) {
          return;
        }
        print(event);
      });
    },
  };
};
