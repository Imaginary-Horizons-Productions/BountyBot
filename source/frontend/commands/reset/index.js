const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { aggregateSubcommands } = require('../../shared');

/** @type {import('../../../shared/types').LogicLayer} */
let logicLayer;

const mainId = "reset";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = aggregateSubcommands(mainId, [
	"all-hunter-stats.js",
	"server-settings.js"
]);
module.exports = new CommandWrapper(mainId, "Reset all bounty hunter stats, bounties, or server configs", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.Guild], 3000,
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
