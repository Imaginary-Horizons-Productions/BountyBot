const { CommandWrapper } = require('../classes');

/** @type {string[]} */
exports.commandFiles = [
	"about.js",
	"bounty.js",
	"commands.js",
	"config-premium.js",
	"config-server.js",
	"create-default.js",
	"data-policy.js",
	"evergreen.js",
	"feedback.js",
	"festival.js",
	"moderation.js",
	"premium.js",
	"raffle.js",
	"rank.js",
	"reset.js",
	"scoreboard.js",
	"season-end.js",
	"server-bonuses.js",
	"stats.js",
	"toast.js",
	"tutorial.js",
	"version.js"
];
/** @type {Record<string, CommandWrapper>} */
const commandDictionary = {};
/** @type {import('discord.js').RESTPostAPIChatInputApplicationCommandsJSONBody[]} */
exports.slashData = [];

for (const file of exports.commandFiles) {
	/** @type {CommandWrapper} */
	const command = require(`./${file}`);
	commandDictionary[command.mainId] = command;
	exports.slashData.push(command.builder.toJSON());
}

/** @param {string} commandName */
exports.getCommand = function (commandName) {
	return commandDictionary[commandName];
}
