import { slashCommandsByName } from "./index";
import type { CommandContext } from "./types";
import { respond } from "./utils/interaction";

export const handleSlashCommand = async (context: CommandContext): Promise<void> => {
  const command = slashCommandsByName.get(context.interaction.commandName);

  if (!command) {
    await respond(context.interaction, {
      content: `Unknown command: ${context.interaction.commandName}`,
      ephemeral: true,
    });
    return;
  }

  try {
    if (!context.interaction.deferred && !context.interaction.replied) {
      await context.interaction.deferReply();
    }

    await command.execute(context);
  } catch (error) {
    console.error(`[Command:${context.interaction.commandName}]`, error);
    await respond(context.interaction, "Command execution failed.");
  }
};
