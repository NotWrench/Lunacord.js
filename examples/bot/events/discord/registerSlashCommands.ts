import type { Client } from "discord.js";
import { slashCommandData } from "../../commands";

export const registerSlashCommandsForGuild = async (
  client: Client,
  guildId: string
): Promise<void> => {
  if (!client.application) {
    throw new Error("Discord application is not ready; cannot register slash commands.");
  }

  const registered = await client.application.commands.set(slashCommandData, guildId);
  console.log(`[Discord] Registered ${registered.size} slash commands for guild ${guildId}`);
};
