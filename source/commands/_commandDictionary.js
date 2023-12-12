const { CommandWrapper } = require('../classes');

/** @type {string[]} */
exports.commandFiles = [
	"about.js",
	"bounty",
	"commands.js",
	"config-premium.js",
	"config-server.js",
	"create-default",
	"data-policy.js",
	"evergreen",
	"feedback.js",
	"festival",
	"moderation",
	"premium.js",
	"raffle",
	"rank",
	"reset",
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
