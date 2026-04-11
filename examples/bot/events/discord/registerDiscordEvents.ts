import type { Client } from "discord.js";
import type { Lunacord } from "../../../../src/index";
import { handleSlashCommand } from "../../commands/handleSlashCommand";
import { respond } from "../../commands/utils/interaction";

interface RegisterDiscordEventsOptions {
  client: Client;
  getLunacord: () => Lunacord | null;
}

export const registerDiscordEvents = ({
  client,
  getLunacord,
}: RegisterDiscordEventsOptions): void => {
  // Forward all Discord raw packets so Lunacord can manage VOICE_* state internally.
  client.on("raw", (packet) => {
    const lunacord = getLunacord();
    if (!lunacord) {
      return;
    }

    lunacord.handleVoicePacket(packet);
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const lunacord = getLunacord();
    if (!lunacord) {
      await respond(interaction, {
        content: "Lunacord is still starting up. Try again in a few seconds.",
        ephemeral: true,
      });
      return;
    }

    await handleSlashCommand({ interaction, lunacord });
  });
};
