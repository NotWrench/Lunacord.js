import { DEFAULT_ERROR_MESSAGE } from "../../constants";
import type { DiscordEventHandler } from "../../types";

export const interactionCreateEventHandler: DiscordEventHandler = (client) => {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      return;
    }

    const ctx = client.buildCommandContext(interaction);

    try {
      await client.commands.dispatch(command.data.name, ctx);
    } catch (error) {
      const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;
      await ctx.error(message);
    }
  });
};
