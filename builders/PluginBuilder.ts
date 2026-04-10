import type { Lunacord, LunacordPlugin, LunacordPluginEvent } from "../core/Lunacord";
import type { Node } from "../core/Node";
import type { Player } from "../core/Player";
import type {
  RestErrorContext,
  RestRequestContext,
  RestRequestPatch,
  RestResponseContext,
} from "../rest/Rest";
import type { SearchResult } from "../structures/SearchResult";
import type { SearchProviderInput } from "../types";

/**
 * Fluent builder for registering typed Lunacord plugins.
 */
export class PluginBuilder {
  private readonly client: Lunacord;
  private readonly plugin: LunacordPlugin;

  constructor(client: Lunacord, name: string, plugin?: LunacordPlugin) {
    this.client = client;
    this.plugin = plugin ?? { name };
  }

  /**
   * Observes manager events with full event-payload inference.
   */
  observe(observer: (event: LunacordPluginEvent) => Promise<void> | void): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin.name, {
      ...this.plugin,
      observe: observer,
    });
  }

  /**
   * Intercepts REST requests for managed nodes.
   */
  beforeRestRequest(
    hook: (
      context: RestRequestContext & { node: Node }
    ) => Promise<RestRequestPatch | void> | RestRequestPatch | void
  ): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin.name, {
      ...this.plugin,
      beforeRestRequest: hook,
    });
  }

  /**
   * Observes REST responses for managed nodes.
   */
  afterRestResponse(
    hook: (
      context: RestResponseContext & { node: Node }
    ) => Promise<unknown | void> | unknown | void
  ): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin.name, {
      ...this.plugin,
      afterRestResponse: hook,
    });
  }

  /**
   * Observes REST errors for managed nodes.
   */
  onRestError(
    hook: (context: RestErrorContext & { node: Node }) => Promise<void> | void
  ): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin.name, {
      ...this.plugin,
      onRestError: hook,
    });
  }

  /**
   * Transforms player search results before they are returned to consumers.
   */
  transformSearchResult(
    hook: (
      context: {
        guildId: string;
        node: Node;
        player: Player;
        provider?: SearchProviderInput;
        query: string;
      },
      result: SearchResult
    ) => Promise<SearchResult> | SearchResult
  ): PluginBuilder {
    return new PluginBuilder(this.client, this.plugin.name, {
      ...this.plugin,
      transformSearchResult: hook,
    });
  }

  /**
   * Returns the typed plugin object without registering it.
   */
  build(): LunacordPlugin {
    return { ...this.plugin };
  }

  /**
   * Registers the built plugin on the client.
   */
  use(): Lunacord {
    return this.client.use(this.build());
  }
}
