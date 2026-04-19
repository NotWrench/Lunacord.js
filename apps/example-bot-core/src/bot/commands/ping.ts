import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../types";

export const pingCommand: BotCommand = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Pong."),
  execute: async (ctx) => ctx.reply("Pong!"),
};
