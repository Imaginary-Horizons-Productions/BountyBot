const { CommandInteraction, ChatInputCommandInteraction } = require("discord.js");
const { SubcommandFunctionality, SelectOptionFunctionality, BuildError, InteractionTheater } = require("../classes");

/**
 * @param {string} mainId
 * @param {string[]} fileList
 */
function aggregateSubcommands(mainId, fileList) {
	const mappings = {
		/** @type {import("discord.js").BaseApplicationCommandData[]} */
		slashData: [],
		/** @type {Record<string, (interaction: CommandInteraction, isDevMode: boolean, ...args: [import("../../logic/index.js").LogicLayer, unknown]) => Promise<void>>} */
		executeDictionary: {}
	};
	for (const fileName of fileList) {
		/** @type {SubcommandFunctionality} */
		const subcommand = require(`../commands/${mainId}/${fileName}`);
		mappings.slashData.push(subcommand.data);
		mappings.executeDictionary[subcommand.data.name] = subcommand.procedure;
	};
	return mappings;
};

/**
 * @param {string} mainId
 * @param {string[]} fileList
 * @returns {Record<string, (interaction: ChatInputCommandInteraction, origin: InteractionTheater, isDevMode: boolean, logicLayer: import("../../logic/index.js").LogicLayer, args: unknown[]) => Promise<void>>}
 */
function aggregateSelectOptionMap(mainId, fileList) {
	const selectOptionMap = {};
	for (const fileName of fileList) {
		/** @type {SelectOptionFunctionality} */
		const option = require(`../selects/${mainId}/${fileName}`);
		if (option.name in selectOptionMap) {
			throw new BuildError(`duplicate select option name: ${option.name}`);
		}
		selectOptionMap[option.name] = option.execute;
	};
	return selectOptionMap;
}

module.exports = {
	aggregateSubcommands,
	aggregateSelectOptionMap
}
