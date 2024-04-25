const { CommandInteraction } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { Sequelize } = require('sequelize');

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
	"use-item.js",
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

/**
 * @param {string} commandName
 * @param {string} optionName
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @returns {Promise<{name: string, value: string}[]>}}
 */
exports.useAutocompleteFilter = function (commandName, optionName, interaction, database) {
	return commandDictionary[commandName].autocompleteFilters[optionName](interaction, database).then(allOptions => {
		return allOptions.slice(0, 25);
	});
}
