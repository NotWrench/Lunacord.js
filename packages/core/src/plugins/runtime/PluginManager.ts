import type { Node } from "../../core/Node";
import type { SearchResult } from "../../domain/track/SearchResult";
import { PluginTimeoutError } from "../../errors/PluginTimeoutError";
import { PluginValidationError } from "../../errors/PluginValidationError";
import type {
  LunacordPlugin,
  LunacordPluginEvent,
  PluginCommand,
  PluginContext,
  PluginErrorEvent,
  PluginHookName,
  PluginManagerOptions,
  PluginMetric,
  PluginSearchResultContext,
} from "../types";
import { LUNACORD_PLUGIN_API_VERSION, LUNACORD_PLUGIN_SUPPORTED_API_VERSIONS } from "../types";

const PLUGIN_VERSION_REGEX = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const DEFAULT_LIFECYCLE_TIMEOUT_MS = 5000;
const DEFAULT_RUNTIME_TIMEOUT_MS = 2000;
const LIFECYCLE_HOOKS = new Set<PluginHookName>(["dispose", "setup", "start", "stop"]);

interface PluginState {
  context: PluginContext;
  name: string;
  plugin: LunacordPlugin;
  setupPromise?: Promise<void>;
  setupRan: boolean;
  started: boolean;
  startPromise?: Promise<void>;
  stopped: boolean;
}

export class PluginManager {
  private readonly commands = new Map<string, PluginCommand[]>();
  private readonly metrics = new Map<string, PluginMetric[]>();
  private readonly options: PluginManagerOptions;
  private readonly registeredNodeIds = new Set<string>();
  private readonly plugins: PluginState[] = [];
  private runtimeStarted = false;

  constructor(options: PluginManagerOptions) {
    this.options = options;
  }

  use(plugin: LunacordPlugin): void {
    this.validatePlugin(plugin);
    const state = this.createState(plugin);
    this.plugins.push(state);

    if (this.runtimeStarted) {
      state.setupPromise = this.setupAndStartPlugin(state);
    }

    for (const node of this.options.getNodes()) {
      this.attachNode(node);
    }
  }

  list(): readonly LunacordPlugin[] {
    return this.plugins.map(({ plugin }) => plugin);
  }

  async setupAll(): Promise<void> {
    await Promise.all(this.plugins.map((state) => this.setupPlugin(state)));
  }

  async startAll(): Promise<void> {
    this.runtimeStarted = true;
    await Promise.all(this.plugins.map((state) => this.startPlugin(state)));
  }

  async stopAll(): Promise<void> {
    this.runtimeStarted = false;
    for (const state of [...this.plugins].reverse()) {
      if (!state.started || state.stopped) {
        continue;
      }

      await this.runHook(state, "stop", () => state.plugin.stop?.(state.context));
      state.stopped = true;
      state.started = false;
    }
  }

  async disposeAll(): Promise<void> {
    for (const state of [...this.plugins].reverse()) {
      await this.runHook(state, "dispose", () => state.plugin.dispose?.(state.context));
    }
  }

  attachNode(node: Node): void {
    if (this.registeredNodeIds.has(node.id)) {
      return;
    }

    this.registeredNodeIds.add(node.id);
    node.rest.use({
      beforeRequest: (context) =>
        this.chainBeforeRestRequest({
          ...context,
          nodeId: node.id,
        }),
      afterResponse: (context) =>
        this.chainAfterRestResponse({
          ...context,
          nodeId: node.id,
        }),
      onError: (context) =>
        this.notifyRestError({
          ...context,
          nodeId: node.id,
        }),
    });
    node.setSearchResultTransformer((context, result) =>
      this.transformSearchResult(
        {
          ...context,
          nodeId: node.id,
        },
        result
      )
    );
  }

  dispatch(event: LunacordPluginEvent): void {
    for (const state of this.plugins) {
      this.runHook(state, "observe", () => state.plugin.observe?.(event, state.context), {
        guildId: "guildId" in event ? event.guildId : undefined,
        nodeId: "node" in event && "id" in event.node ? event.node.id : undefined,
      }).catch(() => {
        // runHook already routes errors to onPluginError; swallow double-report here.
      });
    }
  }

  private createState(plugin: LunacordPlugin): PluginState {
    const logger = {
      debug: (message: string, data?: unknown) => {
        this.options.logger?.debug?.(`[plugin:${plugin.name}] ${message}`, data);
      },
      error: (message: string, data?: unknown) => {
        this.options.logger?.error?.(`[plugin:${plugin.name}] ${message}`, data);
      },
      warn: (message: string, data?: unknown) => {
        this.options.logger?.warn?.(`[plugin:${plugin.name}] ${message}`, data);
      },
    };

    return {
      name: plugin.name,
      plugin,
      setupRan: false,
      started: false,
      stopped: false,
      context: {
        apiVersion: LUNACORD_PLUGIN_API_VERSION,
        cache: this.options.cacheNamespace(`plugin:${plugin.name}`),
        events: this.options.events,
        logger,
        getPlayer: this.options.getPlayer,
        registerCommand: (command) => {
          const commands = this.commands.get(plugin.name) ?? [];
          commands.push(command);
          this.commands.set(plugin.name, commands);
        },
        registerMetric: (metric) => {
          const metrics = this.metrics.get(plugin.name) ?? [];
          metrics.push(metric);
          this.metrics.set(plugin.name, metrics);
        },
      },
    };
  }

  private validatePlugin(plugin: LunacordPlugin): void {
    if (!plugin.name.trim()) {
      throw new PluginValidationError({
        code: "PLUGIN_INVALID_NAME",
        message: "Plugin name must not be empty",
        context: {
          pluginName: plugin.name,
          pluginVersion: plugin.version,
        },
      });
    }

    if (!PLUGIN_VERSION_REGEX.test(plugin.version)) {
      throw new PluginValidationError({
        code: "PLUGIN_INVALID_VERSION",
        message: `Plugin ${plugin.name} has an invalid version`,
        context: {
          pluginName: plugin.name,
          pluginVersion: plugin.version,
        },
      });
    }

    const supportedVersions: readonly string[] = LUNACORD_PLUGIN_SUPPORTED_API_VERSIONS;
    if (!supportedVersions.includes(plugin.apiVersion)) {
      throw new PluginValidationError({
        code: "PLUGIN_API_VERSION_UNSUPPORTED",
        message: `Plugin ${plugin.name} targets unsupported apiVersion ${plugin.apiVersion}`,
        context: {
          pluginName: plugin.name,
          pluginVersion: plugin.version,
          pluginApiVersion: plugin.apiVersion,
        },
      });
    }
    if (plugin.apiVersion !== LUNACORD_PLUGIN_API_VERSION) {
      this.options.logger?.warn?.(
        `Plugin ${plugin.name} targets apiVersion ${plugin.apiVersion}; the current version is ${LUNACORD_PLUGIN_API_VERSION}. Please upgrade — v1 support will be removed in the next major.`,
        { pluginName: plugin.name, pluginApiVersion: plugin.apiVersion }
      );
    }

    if (this.plugins.some((state) => state.name === plugin.name)) {
      throw new PluginValidationError({
        code: "PLUGIN_DUPLICATE_NAME",
        message: `Plugin ${plugin.name} is already registered`,
        context: {
          pluginName: plugin.name,
          pluginVersion: plugin.version,
        },
      });
    }

    for (const dependency of plugin.dependencies ?? []) {
      const registeredDependency = this.plugins.find((state) => state.name === dependency.name);
      if (!registeredDependency) {
        throw new PluginValidationError({
          code: "PLUGIN_DEPENDENCY_MISSING",
          message: `Plugin ${plugin.name} requires ${dependency.name}`,
          context: {
            pluginName: plugin.name,
            pluginVersion: plugin.version,
            dependencyName: dependency.name,
            dependencyVersion: dependency.version,
          },
        });
      }

      if (dependency.version && registeredDependency.plugin.version !== dependency.version) {
        throw new PluginValidationError({
          code: "PLUGIN_DEPENDENCY_VERSION_MISMATCH",
          message: `Plugin ${plugin.name} requires ${dependency.name}@${dependency.version}`,
          context: {
            pluginName: plugin.name,
            pluginVersion: plugin.version,
            dependencyName: dependency.name,
            dependencyVersion: dependency.version,
          },
        });
      }
    }
  }

  private getTimeoutMs(plugin: LunacordPlugin, hook: PluginHookName): number {
    const configured = plugin.timeouts?.[hook];
    if (configured !== undefined) {
      return configured;
    }

    return LIFECYCLE_HOOKS.has(hook) ? DEFAULT_LIFECYCLE_TIMEOUT_MS : DEFAULT_RUNTIME_TIMEOUT_MS;
  }

  private normalizeError(error: unknown, plugin: LunacordPlugin, hook: PluginHookName): Error {
    if (error instanceof Error) {
      return error;
    }

    return new Error(`Plugin ${plugin.name} failed during ${hook}: ${String(error)}`);
  }

  private async withTimeout<T>(
    plugin: LunacordPlugin,
    hook: PluginHookName,
    task: Promise<T>
  ): Promise<T> {
    const timeoutMs = this.getTimeoutMs(plugin, hook);
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        task,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new PluginTimeoutError({
                code: "PLUGIN_HOOK_TIMEOUT",
                message: `Plugin ${plugin.name} timed out in ${hook} after ${timeoutMs}ms`,
                context: {
                  pluginName: plugin.name,
                  hook,
                  timeoutMs,
                },
              })
            );
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async runHook<T>(
    state: PluginState,
    hook: PluginHookName,
    task: () => Promise<T | undefined> | T | undefined,
    metadata: { guildId?: string; nodeId?: string } = {}
  ): Promise<T | undefined> {
    try {
      const result = await this.withTimeout(
        state.plugin,
        hook,
        Promise.resolve(task()) as Promise<T>
      );
      return result;
    } catch (error) {
      const normalizedError = this.normalizeError(error, state.plugin, hook);
      const event: PluginErrorEvent = {
        error: normalizedError,
        guildId: metadata.guildId,
        hook,
        nodeId: metadata.nodeId,
        plugin: {
          apiVersion: state.plugin.apiVersion,
          name: state.plugin.name,
          version: state.plugin.version,
        },
      };
      this.options.onPluginError(event);
      state.context.logger.error(`Hook ${hook} failed`, {
        error: normalizedError.message,
        guildId: metadata.guildId,
        nodeId: metadata.nodeId,
      });
      return undefined;
    }
  }

  private async setupAndStartPlugin(state: PluginState): Promise<void> {
    await this.setupPlugin(state);
    await this.startPlugin(state);
  }

  private async setupPlugin(state: PluginState): Promise<void> {
    if (state.setupRan) {
      return;
    }

    if (!state.setupPromise) {
      state.setupPromise = (async () => {
        await this.runHook(state, "setup", () => state.plugin.setup?.(state.context));
        state.setupRan = true;
      })();
    }

    await state.setupPromise;
  }

  private async startPlugin(state: PluginState): Promise<void> {
    if (state.started) {
      return;
    }

    await this.setupPlugin(state);

    if (!state.startPromise) {
      state.startPromise = (async () => {
        await this.runHook(state, "start", () => state.plugin.start?.(state.context));
        state.started = true;
        state.stopped = false;
      })();
    }

    await state.startPromise;
  }

  private async chainBeforeRestRequest(
    context: Parameters<NonNullable<Node["rest"]["use"]>>[0] extends never
      ? never
      : {
          body?: unknown;
          method: string;
          nodeId: string;
          path: string;
          url: string;
        }
  ): Promise<{ body?: unknown; method?: string; path?: string } | undefined> {
    let patch:
      | {
          body?: unknown;
          method?: string;
          path?: string;
        }
      | undefined;

    for (const state of this.plugins) {
      const nextPatch = await this.runHook(
        state,
        "beforeRestRequest",
        () => state.plugin.beforeRestRequest?.(context, state.context),
        { nodeId: context.nodeId }
      );

      if (!nextPatch) {
        continue;
      }

      patch = {
        ...(patch ?? {}),
        ...nextPatch,
      };
    }

    return patch;
  }

  private async chainAfterRestResponse(context: {
    data: unknown;
    nodeId: string;
    request: {
      body?: unknown;
      method: string;
      path: string;
      url: string;
    };
    response: Awaited<ReturnType<typeof fetch>>;
  }): Promise<unknown | undefined> {
    let nextData = context.data;

    for (const state of this.plugins) {
      const transformed = await this.runHook(
        state,
        "afterRestResponse",
        () =>
          state.plugin.afterRestResponse?.(
            {
              ...context,
              data: nextData,
            },
            state.context
          ),
        { nodeId: context.nodeId }
      );

      if (transformed !== undefined) {
        nextData = transformed;
      }
    }

    return nextData === context.data ? undefined : nextData;
  }

  private async notifyRestError(context: {
    error: unknown;
    nodeId: string;
    request: {
      body?: unknown;
      method: string;
      path: string;
      url: string;
    };
  }): Promise<void> {
    for (const state of this.plugins) {
      await this.runHook(
        state,
        "onRestError",
        () => state.plugin.onRestError?.(context, state.context),
        { nodeId: context.nodeId }
      );
    }
  }

  private async transformSearchResult(
    context: PluginSearchResultContext,
    result: SearchResult
  ): Promise<SearchResult> {
    let nextResult = result;

    for (const state of this.plugins) {
      const transformed = await this.runHook(
        state,
        "transformSearchResult",
        () => state.plugin.transformSearchResult?.(context, nextResult, state.context),
        {
          guildId: context.guildId,
          nodeId: context.nodeId,
        }
      );

      if (transformed) {
        nextResult = transformed;
      }
    }

    return nextResult;
  }
}
