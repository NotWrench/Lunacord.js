import { Lunacord } from "../core/Lunacord";

const client = new Lunacord({
  nodes: [],
  numShards: 1,
  userId: "user-123",
});

const readyPlayerBuilder = client
  .createPlayer()
  .setGuild("guild-1")
  .setVoiceChannel("voice-1")
  .setTextChannel("text-1");

void readyPlayerBuilder.connect;

// @ts-expect-error connect must not be callable before required fields are set
client.createPlayer().connect();

// @ts-expect-error connect must not be callable before the text channel is set
client.createPlayer().setGuild("guild-1").setVoiceChannel("voice-1").connect();

const readyNodeBuilder = client.createNode().setHost("localhost").setPort(2333).setPassword("pass");

void readyNodeBuilder.register;

// @ts-expect-error register must not be callable before required node fields are set
client.createNode().setHost("localhost").register();
