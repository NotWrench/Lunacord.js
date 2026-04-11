import type { Lunacord } from "../core/Lunacord";
import type { SearchResult } from "../domain/track/SearchResult";
import type {
  LunacordPlugin,
  LunacordPluginEvent,
  PluginContext,
  PluginDependency,
  PluginMetadata,
  PluginRestErrorHookContext,
  PluginRestRequestContext,
  PluginRestResponseContext,
  PluginSearchResultContext,
} from "../plugins/types";
import type { RestRequestPatch } from "../transports/rest/Rest";

/**
 * Fluent builder for registering typed Lunacord plugins.
 */
export class PluginBuilder {
  private readonly client: Lunacord;
  private readonly plugin: LunacordPlugin;

  constructor(client: Lunacord, metadata: PluginMetadata, plugin?: LunacordPlugin) {
    this.client = client;
    this.plugin = plugin ?? metadata;
  }

  capability(capability: string): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin, {
      ...this.plugin,
      capabilities: [...(this.plugin.capabilities ?? []), capability],
    });
  }

  dependsOn(name: string, version?: string): PluginBuilder {
    const dependency: PluginDependency = {
      name,
      version,
    };

    return new PluginBuilder(this.client, this.plugin, {
      ...this.plugin,
      dependencies: [...(this.plugin.dependencies ?? []), dependency],
    });
  }

  setup(hook: NonNullable<LunacordPlugin["setup"]>): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin, {
      ...this.plugin,
      setup: hook,
    });
  }

  start(hook: NonNullable<LunacordPlugin["start"]>): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin, {
      ...this.plugin,
      start: hook,
    });
  }

  stop(hook: NonNullable<LunacordPlugin["stop"]>): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin, {
      ...this.plugin,
      stop: hook,
    });
  }

  dispose(hook: NonNullable<LunacordPlugin["dispose"]>): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin, {
      ...this.plugin,
      dispose: hook,
    });
  }

  observe(
    observer: (event: LunacordPluginEvent, pluginContext: PluginContext) => Promise<void> | void
  ): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin, {
      ...this.plugin,
      observe: observer,
    });
  }

  beforeRestRequest(
    hook: (
      context: PluginRestRequestContext,
      pluginContext: PluginContext
    ) => Promise<RestRequestPatch | void> | RestRequestPatch | void
  ): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin, {
      ...this.plugin,
      beforeRestRequest: hook,
    });
  }

  afterRestResponse(
    hook: (
      context: PluginRestResponseContext,
      pluginContext: PluginContext
    ) => Promise<unknown | void> | unknown | void
  ): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin, {
      ...this.plugin,
      afterRestResponse: hook,
    });
  }

  onRestError(
    hook: (
      context: PluginRestErrorHookContext,
      pluginContext: PluginContext
    ) => Promise<void> | void
  ): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin, {
      ...this.plugin,
      onRestError: hook,
    });
  }

  transformSearchResult(
    hook: (
      context: PluginSearchResultContext,
      result: SearchResult,
      pluginContext: PluginContext
    ) => Promise<SearchResult> | SearchResult
  ): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin, {
      ...this.plugin,
      transformSearchResult: hook,
    });
  }

  build(): LunacordPlugin {
    return {
      ...this.plugin,
      capabilities: this.plugin.capabilities ? [...this.plugin.capabilities] : undefined,
      dependencies: this.plugin.dependencies ? [...this.plugin.dependencies] : undefined,
      timeouts: this.plugin.timeouts ? { ...this.plugin.timeouts } : undefined,
    };
  }

  use(): Lunacord {
    return this.client.use(this.build());
  }
}
