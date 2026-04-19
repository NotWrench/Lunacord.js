import { CoreBotClient } from "./bot/CoreBotClient";
import { registerDefaultCommands } from "./bot/commands";
import { discordEventHandlers } from "./bot/events/discord";
import { lunacordEventHandlers } from "./bot/events/lunacord";
import { loadConfig } from "./config";

const config = loadConfig();

const bot = new CoreBotClient(config);

registerDefaultCommands((command) => {
  bot.commands.register(command);
});

bot.registerDiscordEvents(discordEventHandlers);
bot.registerLunacordEvents(lunacordEventHandlers);

await bot.login(config.discordToken);
