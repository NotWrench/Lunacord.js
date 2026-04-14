import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { Lunacord } from "../../../src/index";

type SlashCommandDataBuilder =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  lunacord: Lunacord;
}

export interface SlashCommand {
  data: SlashCommandDataBuilder;
  execute: (context: CommandContext) => Promise<void>;
}
