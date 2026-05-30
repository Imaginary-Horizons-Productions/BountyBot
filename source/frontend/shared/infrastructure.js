const { CommandInteraction, ChatInputCommandInteraction } = require("discord.js");
const { SubcommandWrapper, SelectOptionWrapper, BuildError, InteractionOrigin } = require("../classes");

/**
 * @param {string} mainId
 * @param {string[]} fileList
 */
function aggregateSubcommands(mainId, fileList) {
	const mappings = {
		/** @type {import("discord.js").BaseApplicationCommandData[]} */
		slashData: [],
		/** @type {Record<string, (interaction: CommandInteraction, runMode: import("../../shared/types.js").RunModeKindMember, ...args: [typeof import("../../logic"), unknown]) => Promise<void>>} */
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
 * @returns {Record<string, (interaction: ChatInputCommandInteraction, origin: InteractionOrigin, runMode: import("../../shared/types.js").RunModeKindMember, logicLayer: typeof import("../../logic/index.js"), args: unknown[]) => Promise<void>>}
 */
function aggregateSelectOptionMap(mainId, fileList) {
	const selectOptionMap = {};
	for (const fileName of fileList) {
		/** @type {SelectOptionWrapper} */
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
