import type { Lunacord, Player } from "@lunacord/core";
import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { CoreBotClient } from "./CoreBotClient";

export type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;

export interface CommandContext {
  readonly client: CoreBotClient;
  error(message: string): Promise<unknown>;
  getPlayer(): Promise<Player | undefined>;
  readonly interaction: ChatInputCommandInteraction;
  joinAndGetPlayer(): Promise<Player | undefined>;
  readonly lunacord: Lunacord;
  reply(payload: string | InteractionReplyOptions): Promise<unknown>;
  resolveVoiceChannel(): Promise<string | undefined>;
}

export interface BotCommand {
  data: CommandData;
  execute: (ctx: CommandContext) => Promise<unknown>;
}

export interface CommandPublishOptions {
  applicationId: string;
  guildId?: string;
}

export interface ApplicationCommandsJsonBody
  extends RESTPostAPIChatInputApplicationCommandsJSONBody {}

export type DiscordEventHandler = (client: CoreBotClient) => void;
export type LunacordEventHandler = (client: CoreBotClient) => void;
