const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { aggregateSubcommands } = require('../../shared');

/** @type {import('../../../shared/types').LogicLayer} */
let logicLayer;

const mainId = "evergreen";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = aggregateSubcommands(mainId, [
	"post.js",
	"edit.js",
	"swap.js",
	"showcase.js",
	"complete.js",
	"take-down.js"
]);
module.exports = new CommandWrapper(mainId, "Evergreen Bounties are not closed after completion; ideal for server-wide objectives", PermissionFlagsBits.ManageChannels, true, [InteractionContextType.Guild], 3000,
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
