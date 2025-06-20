const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../shared');

/** @type {typeof import("../../../logic")} */
let logicLayer;

const mainId = "raffle";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"announce-upcoming.js",
	"by-level.js",
	"by-rank.js"
]);
module.exports = new CommandWrapper(mainId, "Randomly select a bounty hunter from a variety of pools", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	(interaction, origin, runMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, origin, runMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
