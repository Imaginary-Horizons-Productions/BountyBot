const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { aggregateSubcommands } = require('../../shared');

/** @type {import('../../../logic').LogicLayer} */
let logicLayer;

const mainId = "rank";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = aggregateSubcommands(mainId, [
	"add.js",
	"edit.js",
	"remove.js"
]);
module.exports = new CommandWrapper(mainId, "Seasonal Ranks distinguish bounty hunters who have above average season XP", PermissionFlagsBits.ManageRoles, true, [InteractionContextType.Guild], 3000,
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
