const { CommandSet, CommandWrapper } = require('../classes');

// A maximum of 25 command sets are supported by /commands to conform with MessageEmbed limit of 25 fields
exports.commandSets = [
	new CommandSet("General Commands", "These are the bot's default commands that are available to everyone.", false, ["scoreboard.js", "feedback.js", "version.js"]),
	new CommandSet("Configuration Commands", "These commands change how the bot operates on your server. They require bot management permission (a role above the bot's roles).", true, ["create-bounty-board.js"]),
];

/** @type {string[]} */
exports.commandFiles = exports.commandSets.reduce((allFiles, set) => allFiles.concat(set.fileNames), []);
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
