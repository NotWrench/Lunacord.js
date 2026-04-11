import type { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { Lunacord } from "../../../src/index";

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  lunacord: Lunacord;
}

export interface SlashCommand {
  data: SlashCommandBuilder;
  execute: (context: CommandContext) => Promise<void>;
}
