const { CommandWrapper } = require('../classes');

/** @type {string[]} */
exports.commandFiles = [
	"about.js",
	"bounty.js",
	"commands.js",
	"create-bounty-board.js",
	"feedback.js",
	"premium.js",
	"scoreboard.js",
	"stats.js",
	"toast.js",
	"version.js"
];
/** @type {Record<string, CommandWrapper>} */
const commandDictionary = {};
exports.slashData = [];

for (const file of exports.commandFiles) {
	const command = require(`./${file}`);
	commandDictionary[command.customId] = command;
	exports.slashData.push(command.data.toJSON());
}

/**
 * @param {string} commandName
 */
exports.getCommand = function (commandName) {
	return commandDictionary[commandName];
}
