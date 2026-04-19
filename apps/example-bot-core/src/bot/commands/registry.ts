import { REST, Routes } from "discord.js";
import type { CoreBotClient } from "../CoreBotClient";
import type {
  ApplicationCommandsJsonBody,
  BotCommand,
  CommandContext,
  CommandPublishOptions,
} from "../types";

export class BotCommandRegistry {
  private readonly client: CoreBotClient;
  private readonly commands = new Map<string, BotCommand>();

  constructor(client: CoreBotClient) {
    this.client = client;
  }

  register(command: BotCommand): this {
    this.commands.set(command.data.name, command);
    return this;
  }

  get(name: string): BotCommand | undefined {
    return this.commands.get(name);
  }

  list(): BotCommand[] {
    return [...this.commands.values()];
  }

  toJSON(): ApplicationCommandsJsonBody[] {
    return this.list().map(
      (command) => command.data.toJSON() as unknown as ApplicationCommandsJsonBody
    );
  }

  dispatch(name: string, ctx: CommandContext): Promise<unknown> {
    const command = this.commands.get(name);
    if (!command) {
      return Promise.resolve(undefined);
    }
    return command.execute(ctx);
  }

  async publish(options: CommandPublishOptions): Promise<void> {
    const token = this.client.token;
    if (!token) {
      throw new Error("Cannot publish commands before the client has logged in.");
    }

    const body = this.toJSON();
    const rest = new REST().setToken(token);

    if (options.guildId) {
      await rest.put(Routes.applicationGuildCommands(options.applicationId, options.guildId), {
        body,
      });
      return;
    }

    await rest.put(Routes.applicationCommands(options.applicationId), { body });
  }
}
