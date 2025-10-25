const { ShardingManager } = require("discord.js");
const { discordTimestamp } = require("./source/shared");

const log = console.log;

console.log = function () {
	log.apply(console, [`${discordTimestamp(Math.floor(Date.now() / 1000))} `, ...arguments]);
}

const error = console.error;

console.error = function () {
	error.apply(console, [`${discordTimestamp(Math.floor(Date.now() / 1000))} `, ...arguments]);
}

const manager = new ShardingManager("./source/index.js", {
	token: require("./config/auth.json").token,
	shardArgs: require("node:process").argv
});

manager.on("shardCreate", shard => console.log(`Launched shard ${shard.id}`));

manager.spawn();
