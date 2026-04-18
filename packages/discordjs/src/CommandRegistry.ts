import { REST, Routes } from "discord.js";
import type { MusicKit } from "./MusicKit";
import type {
  ApplicationCommandsJsonBody,
  CommandContext,
  CommandMiddleware,
  MusicCommand,
} from "./types";

export type DefaultCommandName =
  | "play"
  | "pause"
  | "resume"
  | "stop"
  | "skip"
  | "previous"
  | "seek"
  | "volume"
  | "queue"
  | "nowplaying"
  | "shuffle"
  | "repeat"
  | "filter"
  | "lyrics"
  | "autoplay"
  | "join"
  | "leave"
  | "clear";

export interface InstallDefaultsOptions {
  /** Exclude these default commands from the install. */
  except?: readonly DefaultCommandName[];
  /** Required when `scope: "guild"`. */
  guildId?: string;
  /** Subset of default commands. Omit to install them all. */
  only?: readonly DefaultCommandName[];
  /** `"global"` publishes to all guilds (up to 1h rollout); `"guild"` is instant. Default: `"global"`. */
  scope?: "global" | "guild";
  /**
   * Skip the REST publish — just register the handlers locally. Useful if you publish
   * commands yourself (e.g. via a bootstrap script).
   */
  skipPublish?: boolean;
  /** Discord bot token override (defaults to `client.token`). */
  token?: string;
}

interface CommandEntry {
  command: MusicCommand;
  middleware: CommandMiddleware[];
}

export class CommandRegistry {
  private readonly music: MusicKit;
  private readonly commands = new Map<string, CommandEntry>();

  constructor(music: MusicKit) {
    this.music = music;
  }

  /** Register a custom command. Replaces any command with the same name. */
  register(name: string, command: MusicCommand): this {
    const key = name || command.data.name;
    this.commands.set(key, { command, middleware: [] });
    return this;
  }

  /** Replace an existing command's execute handler (keeps middleware). */
  override(name: string, handler: MusicCommand["execute"]): this {
    const existing = this.commands.get(name);
    if (!existing) {
      throw new Error(`Cannot override "${name}": command is not registered.`);
    }
    this.commands.set(name, {
      command: { ...existing.command, execute: handler },
      middleware: existing.middleware,
    });
    return this;
  }

  /** Add middleware that runs before a specific command's execute. */
  extend(name: string, middleware: CommandMiddleware): this {
    const existing = this.commands.get(name);
    if (!existing) {
      throw new Error(`Cannot extend "${name}": command is not registered.`);
    }
    existing.middleware.push(middleware);
    return this;
  }

  /** Install one or more built-in defaults. Returns the registry for chaining. */
  install(
    names: readonly DefaultCommandName[],
    options: Omit<InstallDefaultsOptions, "only" | "except"> = {}
  ): Promise<this> {
    return this.installDefaults({ ...options, only: names });
  }

  /** Install all built-in default commands. */
  async installDefaults(options: InstallDefaultsOptions = {}): Promise<this> {
    const allDefaults = await import("./commands").then((m) => m.getDefaultCommands());
    const only = options.only ? new Set(options.only) : null;
    const except = options.except ? new Set(options.except) : new Set<DefaultCommandName>();

    for (const command of allDefaults) {
      const name = command.data.name as DefaultCommandName;
      if (only && !only.has(name)) {
        continue;
      }
      if (except.has(name)) {
        continue;
      }
      if (!this.commands.has(name)) {
        this.commands.set(name, { command, middleware: [] });
      }
    }

    if (!options.skipPublish) {
      await this.publish(options);
    }
    return this;
  }

  /** Remove a command (both handler + publication on next publish). */
  unregister(name: string): this {
    this.commands.delete(name);
    return this;
  }

  /** Lookup a command by name. */
  get(name: string): MusicCommand | undefined {
    return this.commands.get(name)?.command;
  }

  /** List registered commands. */
  list(): MusicCommand[] {
    return [...this.commands.values()].map((entry) => entry.command);
  }

  /** Publish commands to Discord. */
  async publish(
    options: Pick<InstallDefaultsOptions, "scope" | "guildId" | "token"> = {}
  ): Promise<void> {
    const token = options.token ?? this.music.client.token;
    if (!token) {
      throw new Error(
        "@lunacord/discordjs: cannot publish commands before the client has logged in (no token available)."
      );
    }
    const applicationId = this.music.client.application?.id ?? this.music.client.user?.id;
    if (!applicationId) {
      throw new Error(
        "@lunacord/discordjs: client.application is not populated yet. Call installDefaults() inside the client 'ready' handler, or after `await client.login()`."
      );
    }

    const body: ApplicationCommandsJsonBody[] = this.list().map(
      (command) => command.data.toJSON() as unknown as ApplicationCommandsJsonBody
    );

    const rest = new REST().setToken(token);

    if (options.scope === "guild") {
      if (!options.guildId) {
        throw new Error(
          "@lunacord/discordjs: scope 'guild' requires a guildId. Pass installDefaults({ scope: 'guild', guildId })."
        );
      }
      await rest.put(Routes.applicationGuildCommands(applicationId, options.guildId), { body });
    } else {
      await rest.put(Routes.applicationCommands(applicationId), { body });
    }
  }

  /** Dispatch a command with middleware composition. */
  dispatch(name: string, ctx: CommandContext): Promise<unknown> {
    const entry = this.commands.get(name);
    if (!entry) {
      return Promise.resolve(undefined);
    }

    const chain = [...entry.middleware];
    let index = -1;
    const runner = (): Promise<unknown> => {
      index += 1;
      if (index < chain.length) {
        const middleware = chain[index];
        if (middleware) {
          return Promise.resolve(middleware(ctx, runner));
        }
      }
      return Promise.resolve(entry.command.execute(ctx));
    };
    return runner();
  }
}
