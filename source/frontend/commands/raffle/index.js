const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { aggregateSubcommands } = require('../../shared');

/** @type {import('../../../logic').LogicLayer} */
let logicLayer;

const mainId = "raffle";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = aggregateSubcommands(mainId, [
	"announce-upcoming.js",
	"by-level.js",
	"by-rank.js"
]);
module.exports = new CommandWrapper(mainId, "Randomly select a bounty hunter from a variety of pools", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
