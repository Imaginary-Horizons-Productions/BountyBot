const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../shared');

/** @type {typeof import("../../../logic")} */
let logicLayer;

const mainId = "create-default";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"bounty-board-forum.js",
	"scoreboard-reference.js",
	"rank-roles.js"
]);
module.exports = new CommandWrapper(mainId, "Create a Discord resource for use by BountyBot", PermissionFlagsBits.ManageChannels, false, [InteractionContextType.Guild], 30000,
	(interaction, origin, runMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, origin, runMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
