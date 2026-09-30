import { ShardingManager, time } from "discord.js";

const log = console.log;

console.log = function () {
	log.apply(console, [`${time(Math.floor(Date.now() / 1000))} `, ...arguments]);
}

const error = console.error;

console.error = function () {
	error.apply(console, [`${time(Math.floor(Date.now() / 1000))} `, ...arguments]);
}
const manager = new ShardingManager("./source/bot.ts", {
	token: (await import("./config/auth.json", { with: { type: "json" } })).default.token,
	shardArgs: process.argv.slice(2)
});

manager.on("shardCreate", shard => console.log(`Launched shard ${shard.id}`));

manager.spawn();
