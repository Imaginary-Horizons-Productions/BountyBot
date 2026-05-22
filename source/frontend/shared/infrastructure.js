const { CommandInteraction } = require("discord.js");
const { SubcommandWrapper, SelectOptionWrapper } = require("../classes");

/**
 * @param {string} mainId
 * @param {string[]} fileList
 */
function aggregateSubcommands(mainId, fileList) {
	const mappings = {
		/** @type {import("discord.js").BaseApplicationCommandData[]} */
		slashData: [],
		/** @type {Record<string, (interaction: CommandInteraction, runMode: string, ...args: [typeof import("../../logic"), unknown]) => Promise<void>>} */
		executeDictionary: {}
	};
	for (const fileName of fileList) {
		/** @type {SubcommandWrapper} */
		const subcommand = require(`../commands/${mainId}/${fileName}`);
		mappings.slashData.push(subcommand.data);
		mappings.executeDictionary[subcommand.data.name] = subcommand.executeSubcommand;
	};
	return mappings;
};

/**
 * @param {string} mainId
 * @param {string[]} fileList
 * @returns {Map<string, SelectOptionWrapper>}
 */
function aggregateSelectOptionMap(mainId, fileList) {
	const selectOptionMap = new Map();
	for (const fileName of fileList) {
		/** @type {SelectOptionWrapper} */
		const option = require(`../selects/${mainId}/${fileName}`);
		selectOptionMap.set(option.name, option.execute);
	};
	return selectOptionMap;
}

module.exports = {
	aggregateSubcommands,
	aggregateSelectOptionMap
}
