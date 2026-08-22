import { ShardingManager } from "discord.js";
import { discordTimestamp } from "./source/shared/index.ts";

const log = console.log;

console.log = function () {
	log.apply(console, [`${discordTimestamp(Math.floor(Date.now() / 1000))} `, ...arguments]);
}

const error = console.error;

console.error = function () {
	error.apply(console, [`${discordTimestamp(Math.floor(Date.now() / 1000))} `, ...arguments]);
}
const manager = new ShardingManager("./source/bot.ts", {
	token: (await import("./config/auth.json", { with: { type: "json" } })).default.token,
	shardArgs: process.argv.slice(2)
});

manager.on("shardCreate", shard => console.log(`Launched shard ${shard.id}`));

manager.spawn();
