const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../shared');

/** @type {typeof import("../../../logic")} */
let logicLayer;

const mainId = "evergreen";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"post.js",
	"edit.js",
	"swap.js",
	"showcase.js",
	"complete.js",
	"take-down.js"
]);
module.exports = new CommandWrapper(mainId, "Evergreen Bounties are not closed after completion; ideal for server-wide objectives", PermissionFlagsBits.ManageChannels, true, [InteractionContextType.Guild], 3000,
	(interaction, runMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, runMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
