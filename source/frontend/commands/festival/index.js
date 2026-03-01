const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { aggregateSubcommands } = require('../../shared');

/** @type {typeof import("../../../logic")} */
let logicLayer;

const mainId = "festival";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = aggregateSubcommands(mainId, [
	"start.js",
	"close.js"
]);
module.exports = new CommandWrapper(mainId, "Manage a server-wide festival to multiply XP of bounty completions, toast reciepts, and crit toasts", PermissionFlagsBits.ManageGuild, true, [InteractionContextType.Guild], 3000,
	/** Allow users to manage an XP multiplier festival */
	(interaction, origin, runMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, origin, runMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
