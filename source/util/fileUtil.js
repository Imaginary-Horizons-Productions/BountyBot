const { CommandInteraction } = require("discord.js");
const { SubcommandWrapper } = require("../classes");

/**
 * @param {string} mainId
 * @param {string[]} fileList
 */
function createSubcommandMappings(mainId, fileList) {
	const mappings = {
		/** @type {import("discord.js").BaseApplicationCommandData[]} */
		slashData: [],
		/** @type {Record<string, (interaction: CommandInteraction, runMode: string, ...args: [typeof import("../logic"), unknown]) => Promise<void>>} */
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

module.exports = {
	createSubcommandMappings
};
