import type { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js";

type ResponsePayload = InteractionReplyOptions | string;

const normalizePayload = (payload: ResponsePayload): InteractionReplyOptions => {
  if (typeof payload === "string") {
    return { content: payload };
  }

  return payload;
};

export const respond = async (
  interaction: ChatInputCommandInteraction,
  payload: ResponsePayload
): Promise<void> => {
  const options = normalizePayload(payload);

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(options);
    return;
  }

  await interaction.reply(options);
};
